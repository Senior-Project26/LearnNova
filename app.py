# ============================================================================
# IMPORTS
# ============================================================================

# Standard Library
import io
import json
import os
import re
import time
import unicodedata

# Third-Party: Flask & Extensions
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

# Third-Party: Environment & Configuration
from dotenv import load_dotenv
load_dotenv()


# Third-Party: Google & AI
from google import genai
from google.cloud import vision
from google.auth.exceptions import DefaultCredentialsError
from google import genai

# Third-Party: Firebase
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

# Third-Party: Database
import psycopg2

# Third-Party: PDF & Image Processing
import pdfplumber
from pdf2image import convert_from_bytes
from PIL import Image
from PyPDF2 import PdfReader


# ============================================================================
# FLASK APP SETUP
# ============================================================================

app = Flask(__name__)
CORS(app, supports_credentials=True)

# Load environment for local dev
load_dotenv()
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,
)


# ============================================================================
# API CLIENTS INITIALIZATION
# ============================================================================

# Initialize API clients (Study Buddy)
gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))


# ============================================================================
# FIREBASE ADMIN SETUP
# ============================================================================

try:
    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)
    print("Firebase Admin connected")
except Exception as e:
    print(f"Firebase Admin connection failed: {e}")


# ============================================================================
# DATABASE CONNECTION
# ============================================================================

def get_connection():
    try:
        return psycopg2.connect(os.getenv("DATABASE_URL"))
    except Exception as e:
        print("Database connection failed:", e, flush=True)
        return None


# ============================================================================
# UTILITY FUNCTIONS - TEXT PROCESSING
# ============================================================================

def sanitize_katex(s: str) -> str:
    """Fix common issues from LLM output that break KaTeX.
    - Remove ASCII control chars (except \n, \t)
    - Restore missing backslashes for common LaTeX commands like frac, binom, sqrt, sum, Greek letters, etc.
    - Convert HTML entities &gt; &lt; back to literal > <
    """
    try:
        if not isinstance(s, str):
            return s
        out = s
        # 1) Remove problematic control characters (keep \n, \t)
        out = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", out)
        # 2) Replace HTML entities for inequalities
        out = out.replace("&gt;", ">").replace("&lt;", "<")

        # 2b) Clean up some malformed math patterns commonly produced by the LLM
        #     a) Collapse duplicated scalar equalities like "A=A=" -> "A = "
        out = re.sub(r"\b([A-Za-z])\s*=\s*\1\s*=", r"\\1 = ", out)

        #     b) If there's an odd number of "$$" delimiters, drop the last one to avoid
        #        leaving a stray closing display-math marker which breaks KaTeX.
        try:
            dbl_count = out.count("$$")
            if dbl_count % 2 == 1:
                last_idx = out.rfind("$$")
                if last_idx != -1:
                    out = out[:last_idx] + out[last_idx + 2 :]
        except Exception:
            pass

        #     c) Fix patterns like "\\begin{pmatrix}...\\end{pmatrix}$$" that are missing
        #        the opening "$$" by wrapping them as a proper display block.
        out = re.sub(
            r"(?<!\$)\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}\s*\$\$",
            r"$$\\begin{pmatrix}\1\\end{pmatrix}$$",
            out,
        )

        # 3) Normalize common command forms
        #    3a) Fix square roots written as /sqrt(...) or sqrt(...)-> \sqrt{...}
        out = re.sub(r"/\s*sqrt\s*\(", r"\\sqrt{", out, flags=re.IGNORECASE)
        out = re.sub(r"(?<!\\)\bsqrt\s*\(", r"\\sqrt{", out)
        out = re.sub(r"\\sqrt\s*\(", r"\\sqrt{", out)
        #    3b) Replace matching closing parenthesis after sqrt{...} with a brace if present
        #        This is a light heuristic: only replace the first unmatched ')' after a recently opened '{'
        out = re.sub(r"(\\sqrt\{[^\}\n\r]*?)\)", r"\1}", out)

        #    3c) Add missing backslashes for common LaTeX commands if not already escaped
        cmds = [
            "frac", "binom", "sqrt", "sum", "prod", "alpha", "beta", "gamma", "delta", "epsilon",
            "theta", "lambda", "mu", "sigma", "pi", "phi", "omega", "Omega", "ldots", "cdot",
            "times", "leq", "geq", "neq", "pm", "mp", "overline", "underline", "hat", "bar",
        ]
        pattern = r"(?<!\\)\b(" + "|".join(cmds) + r")\b"
        out = re.sub(pattern, r"\\\1", out)
        return out
    except Exception:
        return s


def estimate_tokens(s: str) -> int:
    """Estimate the number of tokens in a string."""
    return max(1, int(len(s) / 4))


def split_by_tokens(s: str, max_tokens: int) -> list[str]:
    """Split text into chunks by token limit."""
    parts = [p for p in s.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf: list[str] = []
    cur = 0
    for p in parts:
        t = estimate_tokens(p)
        if cur + t > max_tokens and buf:
            chunks.append("\n\n".join(buf))
            buf = [p]
            cur = t
        else:
            buf.append(p)
            cur += t
    if buf:
        chunks.append("\n\n".join(buf))
    return chunks


def _mask_math_segments(s: str) -> tuple[str, list[str]]:
    """Mask LaTeX math ($...$, $$...$$) to avoid accidental normalization within math."""
    if not s:
        return s, []
    patterns = [r"\$\$[\s\S]*?\$\$", r"\$[^$\n][\s\S]*?\$"]
    originals: list[str] = []
    out = s
    for pat in patterns:
        def repl(m):
            originals.append(m.group(0))
            return f"__MATH{len(originals)-1}__"
        out = re.sub(pat, repl, out)
    return out, originals


def _unmask_math_segments(s: str, originals: list[str]) -> str:
    """Restore masked LaTeX math segments."""
    if not originals:
        return s
    out = s
    for i, orig in enumerate(originals):
        out = out.replace(f"__MATH{i}__", orig)
    return out


def format_readable_text(s: str) -> str:
    """Normalize OCR output for readability."""
    if not s:
        return s
    try:
        masked, originals = _mask_math_segments(s)
        t = unicodedata.normalize("NFKC", masked)
        t = re.sub(r"^\s*made with\s+goodnotes\s*$", "", t, flags=re.IGNORECASE | re.MULTILINE)
        t = t.replace("||", "\n").replace("|", " ")
        lines: list[str] = []
        for ln in t.splitlines():
            raw = ln.strip()
            if not raw:
                lines.append("")
                continue
            raw = re.sub(r"^[\-\u2022\u00B7\u2219\u25E6\u25CF\u2013\u2014]+\s*", "- ", raw)
            raw = raw.replace("·", "- ")
            raw = re.sub(r"\s+", " ", raw)
            lines.append(raw)
        t = "\n".join(lines)
        t = re.sub(r"\n{3,}", "\n\n", t)
        t = _unmask_math_segments(t, originals)
        return t.strip()
    except Exception:
        return s


def sanitize_summary(s: str) -> str:
    """Remove unwanted phrases from LLM-generated summaries."""
    if not s:
        return s
    banned = [
        "if you'd like", "i can turn this", "would you like", "let me know",
        "i can ", "we can ", "contact", "reach out", "tailor it",
        "practice exam", "one-page study sheet",
    ]
    keep: list[str] = []
    for ln in (s.splitlines()):
        low = ln.strip().lower()
        if not low:
            keep.append(ln)
            continue
        if any(p in low for p in banned):
            continue
        keep.append(ln)
    return "\n".join(keep).strip()


def parse_json_lenient(s: str):
    """Parse JSON with fallback extraction."""
    try:
        return json.loads(s)
    except Exception:
        arr_match = re.search(r"\[[\s\S]*\]", s)
        obj_match = re.search(r"\{[\s\S]*\}", s)
        candidate = None
        if arr_match and obj_match:
            candidate = arr_match.group(0) if len(arr_match.group(0)) > len(obj_match.group(0)) else obj_match.group(0)
        elif arr_match:
            candidate = arr_match.group(0)
        elif obj_match:
            candidate = obj_match.group(0)
        if candidate:
            try:
                return json.loads(candidate)
            except Exception:
                return {}
        return {}


# ============================================================================
# UTILITY FUNCTIONS - OCR
# ============================================================================

def ocr_quality_score(text: str) -> float:
    """Calculate quality score for OCR text."""
    t = (text or "").strip()
    if not t:
        return 0.0
    total = len(t)
    alnum = sum(ch.isalnum() for ch in t)
    alnum_ratio = alnum / total if total else 0.0
    lines = [ln for ln in t.splitlines() if ln.strip()]
    if not lines:
        return 0.0
    words = t.split()
    avg_words_line = (len(words) / max(1, len(lines)))
    short_lines = sum(1 for ln in lines if len(ln.strip()) < 4)
    short_ratio = short_lines / max(1, len(lines))
    uniq_words = len(set(w.lower().strip(".,:;!?()[]{}'\"") for w in words))
    uniq_ratio = uniq_words / max(1, len(words))
    score = 0.45 * alnum_ratio + 0.35 * min(1.0, avg_words_line / 6.0) + 0.20 * uniq_ratio - 0.20 * short_ratio
    return max(0.0, min(1.0, score))


def vision_ocr_from_images(images: list[Image.Image] | bytes) -> tuple[str, float]:
    """Perform OCR using Google Vision API."""
    contents: list[bytes] = []
    if isinstance(images, bytes):
        try:
            pil = Image.open(io.BytesIO(images)).convert("RGB")
            buf = io.BytesIO()
            pil.save(buf, format="PNG")
            contents.append(buf.getvalue())
        except Exception:
            pass
    else:
        for im in images:
            try:
                pil = im.convert("RGB")
                buf = io.BytesIO()
                pil.save(buf, format="PNG")
                contents.append(buf.getvalue())
            except Exception:
                continue
    texts: list[str] = []
    confidences: list[float] = []
    # Lazy-initialize Google Vision client to avoid import-time failures
    try:
        client = vision.ImageAnnotatorClient()
    except DefaultCredentialsError:
        return "", 0.0
    except Exception:
        return "", 0.0
    for content in contents:
        try:
            vimg = vision.Image(content=content)
            resp = client.document_text_detection(image=vimg)
            if resp.error.message:
                continue
            txt = getattr(resp.full_text_annotation, "text", "") or ""
            if txt:
                texts.append(txt)
            fta = resp.full_text_annotation
            if fta and getattr(fta, "pages", None):
                for page in fta.pages:
                    for block in getattr(page, "blocks", []) or []:
                        for para in getattr(block, "paragraphs", []) or []:
                            for word in getattr(para, "words", []) or []:
                                conf = getattr(word, "confidence", None)
                                if conf is not None:
                                    confidences.append(float(conf))
        except Exception:
            continue
    full_text = ("\n".join(texts)).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else (0.0 if not full_text else 0.5)
    return full_text, avg_conf


def clean_text_with_gemini(text: str) -> str:
    """Use Gemini Flash Lite to clean text artifacts (OCR or otherwise)."""
    t = (text or "").strip()
    if not t:
        return t
    snippet = t if len(t) <= 30000 else t[:30000]
    system_msg = (
        "You are a text cleanup assistant. Clean OCR text: fix broken line wraps and hyphenations, "
        "remove stray characters like '|' and duplicated bullets, merge split words, normalize bullets to '- ', "
        "preserve headings and section structure, and output clean, readable study notes. "
        "Preserve LaTeX math expressions (like $...$, $$...$$, \\frac, \\binom) exactly as-is without alteration. "
        "Do not add commentary or extra sections; do not hallucinate new content."
    )
    prompt = (
        "CLEAN AND FORMAT THIS TEXT INTO READABLE NOTES.\n"
        "- Keep all original information.\n"
        "- Use section headers if present.\n"
        "- Normalize bullets to '- '.\n"
        "- Remove watermark lines like 'Made with Goodnotes'.\n"
        "- Remove table pipes and merge wrapped lines properly.\n\n"
        f"TEXT:\n{snippet}"
    )
    try:
        resp = gemini_client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=system_msg + "\n\n" + prompt,
        )
        out = (getattr(resp, "text", None) or "").strip()
        print("Was not cleaned properly" if out == t else "Was cleaned properly", flush=True)
        return out or t
    except Exception as e:
        print(f"Failed to clean text: {e}", flush=True)
        return t


# ============================================================================
# UTILITY FUNCTIONS - PDF PROCESSING
# ============================================================================

def extract_pdf_text_and_tables(file_bytes: bytes) -> tuple[str, list[list[list[str]]]]:
    """Extract text and tables from PDF."""
    extracted_text = ""
    extracted_tables: list[list[list[str]]] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
            tables = page.extract_tables()
            for table in tables:
                extracted_tables.append(table)
    return extracted_text.strip(), extracted_tables


def walk_outlines(items, level, reader: PdfReader, page_map, results: list[tuple[str, int, int]]):
    """Recursively walk PDF outline structure."""
    for it in items:
        if isinstance(it, list):
            walk_outlines(it, level + 1, reader, page_map, results)
            continue
        title = getattr(it, "title", None) or it.get("/Title", "Untitled")
        dest = (
            it.get("destination", None)
            or it.get("page", None)
            or it.get("/Destination", None)
            or it.get("Destination", None)
            or it.get("Page", None)
            or it.get("/Page", None)
        )
        if dest is None:
            continue
        if hasattr(dest, "get_object"):
            dest = dest.get_object()
        pg_idx = None
        if hasattr(dest, "indirect_reference") and dest.indirect_reference in page_map:
            pg_idx = page_map[dest.indirect_reference]
        else:
            for i, p in enumerate(reader.pages):
                if p is dest:
                    pg_idx = i
                    break
        if pg_idx is not None:
            results.append((str(title).strip(), pg_idx, level))


def get_pdf_outlines(file_bytes: bytes) -> list[tuple[str, int]]:
    """Extract PDF bookmarks/outlines."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        outlines = getattr(reader, "outlines", None) or getattr(reader, "outline", None)
        results: list[tuple[str, int, int]] = []
        page_map = {getattr(p, "indirect_reference", None): i for i, p in enumerate(reader.pages)}
        if outlines:
            walk_outlines(outlines, 0, reader, page_map, results)
        results = [r for r in results if r[2] <= 1]
        results.sort(key=lambda x: x[1])
        uniq: list[tuple[str, int]] = []
        seen = set()
        for t, p, lvl in results:
            key = (t.lower(), p)
            if key not in seen:
                uniq.append((t, p))
                seen.add(key)
        return uniq
    except Exception:
        return []


def extract_sections_by_bookmarks(file_bytes: bytes) -> tuple[list[tuple[str, str]], str | None]:
    """Extract PDF sections based on bookmarks."""
    marks = get_pdf_outlines(file_bytes)
    if len(marks) < 1:
        return [], None
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdfx:
            n_pages = len(pdfx.pages)
            ranges: list[tuple[str, int, int]] = []
            for i, (title, start) in enumerate(marks):
                end = (marks[i + 1][1] - 1) if i + 1 < len(marks) else (n_pages - 1)
                start = max(0, min(start, n_pages - 1))
                end = max(start, min(end, n_pages - 1))
                ranges.append((title.strip(), start, end))
            sections: list[tuple[str, str]] = []
            for title, s, e in ranges:
                buf: list[str] = []
                for pi in range(s, e + 1):
                    txtp = pdfx.pages[pi].extract_text() or ""
                    if txtp:
                        buf.append(txtp)
                text_sec = ("\n".join(buf)).strip()
                if text_sec:
                    sections.append((title, text_sec))
            if sections:
                parts: list[str] = []
                for title, body in sections:
                    parts.append(f"=== SECTION START ===\nTitle: {title}\n\n{body}\n=== SECTION END ===")
                delineated = "\n\n".join(parts)
            else:
                delineated = None
            return sections, delineated
    except Exception:
        return [], None


def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract and clean text from PDF using best available method."""
    structured_text, _ = extract_pdf_text_and_tables(file_bytes)
    structured_text = (structured_text or "").strip()
    score_struct = ocr_quality_score(structured_text)
    vision_text = ""

    conf = 0.0
    try:
        pages = convert_from_bytes(file_bytes, dpi=300)
        vision_text, conf = vision_ocr_from_images(pages)
    except Exception:
        vision_text, conf = "", 0.0
    vision_text = (vision_text or "").strip()
    score_vision = ocr_quality_score(vision_text)
    prefer_vision = (conf >= 0.55) or (score_vision >= score_struct + 0.05)
    chosen = vision_text if prefer_vision else structured_text
    if prefer_vision and chosen:
        cleaned = clean_text_with_gemini(chosen)
        return format_readable_text(cleaned)
    return format_readable_text(chosen)


# ============================================================================
# UTILITY FUNCTIONS - SUMMARY GENERATION
# ============================================================================

def summarize_once(content: str, system_msg: str = "You are a helpful assistant that writes succinct study notes.", model: str = "gemini-2.5-flash-lite") -> str:
    """Generate a single summary using Gemini."""
    prompt = (
        "Summarize the following content into clear, concise bullet points. "
        "If the content contains sections, delineate your summary with section headers. "
        "Focus on the main ideas. Do not include meta commentary, offers, or follow-ups. "
        "Output only the summary.\n\nCONTENT:\n" + content
    )
    try:
        resp = gemini_client.models.generate_content(
            model=model,
            contents=system_msg + "\n\n" + prompt,
        )
        out = (getattr(resp, "text", None) or "").strip()
        if out:
            return sanitize_summary(out)
    except Exception:
        pass
    strict_prompt = (
        "Output exactly 5 concise bullet points summarizing the content. "
        "No intro or outro, bullets only. No meta commentary or offers.\n\nCONTENT:\n" + content
    )
    try:
        resp2 = gemini_client.models.generate_content(
            model=model,
            contents=system_msg + "\n\n" + strict_prompt,
        )
        out2 = (getattr(resp2, "text", None) or "").strip()
        if out2:
            return sanitize_summary(out2)
    except Exception:
        pass
    return content[:1200]


def summarize_text(text: str) -> str:
    """Summarize text with chunking for large inputs."""
    txt = (text or "").strip()
    if not txt:
        return ""
    try:
        total_tokens = estimate_tokens(txt)
        if total_tokens > 200000:
            chunks = split_by_tokens(txt, max_tokens=10000)
            partial_summaries: list[str] = []
            for ch in chunks:
                try:
                    partial = summarize_once(ch, model="gemini-2.5-flash-lite")
                except Exception:
                    raise RuntimeError("file too large to be summarized.")
                partial_summaries.append(partial)
                time.sleep(1)
            combined = "\n\n".join(partial_summaries)
            try:
                return summarize_once(combined, system_msg="You write concise combined summaries of bullet-point notes.", model="gemini-2.5-flash-lite")
            except Exception:
                raise RuntimeError("file too large to be summarized.")
        else:
            try:
                return summarize_once(txt, model="gemini-2.5-flash-lite")
            except Exception:
                raise RuntimeError("file too large to be summarized.")
    except Exception:
        return txt[:1200]


# ============================================================================
# UTILITY FUNCTIONS - QUIZ GENERATION
# ============================================================================

def ensure_minimum_summary(summary: str, size: str) -> tuple[bool, str]:
    """Validate summary length for quiz generation."""
    tokens = estimate_tokens(summary)
    min_requirements = {
        "small": 200,
        "medium": 600,
        "large": 3000,
        "comprehensive": 8000,
    }
    need = min_requirements.get(size, 60)
    if tokens < need:
        return False, f"Summary too short for '{size}' quiz (need >= {need} tokens, have ~{tokens}). Consider merging multiple notes."
    return True, ""


def to_index_from_answer(ans: str | int | None, options: list[str]) -> int | None:
    """Convert answer to option index."""
    if ans is None:
        return None
    if isinstance(ans, int):
        return ans if 0 <= ans < len(options) else None
    s = str(ans).strip()
    if not s:
        return None
    letters = {"a": 0, "b": 1, "c": 2, "d": 3}
    low = s.lower()
    if low in letters:
        return letters[low]
    if low.startswith("option "):
        try:
            n = int(low.split("option ", 1)[1]) - 1
            return n if 0 <= n < len(options) else None
        except Exception:
            pass
    try:
        return options.index(s)
    except ValueError:
        return None


def generate_quiz_with_gemini(
    summary: str,
    count: int,
    topics: list[str] | None = None,
    topic_stats: dict[str, list[float | int]] | None = None,
) -> list[dict]:
    """Generate quiz questions using Gemini.

    - topics: optional list of topic strings that questions should be assigned to.
    - topic_stats: optional mapping { topic: [avg_difficulty (0-1), existing_count] } describing
      how hard questions for that topic currently are and how many already exist.
    """

    topics_desc = ""
    if topics:
        safe_topics = [str(t).strip() for t in topics if str(t).strip()]
        if safe_topics:
            topics_desc = (
                "\n\nTOPIC LIST (use these exact strings):\n- "
                + "\n- ".join(sorted(set(safe_topics)))
                + "\nFor EACH question, choose exactly one topic from this list and include it as the `topic` field."
            )

    stats_desc = ""
    if topic_stats:
        try:
            # Build a compact JSON-like description for the model
            lines = []
            for k, v in topic_stats.items():
                try:
                    avg_d = float(v[0]) if len(v) > 0 else 0.0
                except Exception:
                    avg_d = 0.0
                try:
                    cnt = int(v[1]) if len(v) > 1 else 0
                except Exception:
                    cnt = 0
                lines.append(f'  "{k}": [ {avg_d:.3f}, {cnt} ]')
            if lines:
                stats_desc = (
                    "\n\nTOPIC DIFFICULTY/COUNTS (JSON map: topic -> [avg_difficulty, existing_count]):\n{\n"
                    + ",\n".join(lines)
                    + "\n}\n"
                    + "Use avg_difficulty to tune hardness (higher -> make questions harder). "
                    + "Use existing_count to keep topic coverage roughly uniform by giving slightly more questions to topics with lower counts."
                )
        except Exception:
            stats_desc = ""

    user_prompt = (
        "Create a multiple-choice quiz from the SUMMARY below. "
        f"Return exactly {count} questions. "
        "Each question must have exactly 4 options and a single correctIndex (0..3). "
        "Return JSON only. "
        "Do NOT copy or reword examples, data, names, or numbers from the SUMMARY. "
        # Math safety
        "When using math, use LaTeX/KaTeX-safe syntax (e.g., x^{2}, \\sqrt{...}, \\frac{...}{...}, \\sum, Greek letters as \\alpha). "
        "Ensure expressions are KaTeX-parseable: escape special characters when needed and avoid HTML entities like &gt; or &lt;. "
        "Use literal '>' and '<' characters (not &gt; or &lt;). "
        # Difficulty rubric & novelty/variety constraints
        "\n\nDIFFICULTY RUBRIC (D in [0,1]):\n"
        "- 0.2: basic recall/definition.\n"
        "- 0.4: single-step application with straightforward numbers.\n"
        "- 0.6: multi-step, subtle distractor based on common misconception.\n"
        "- 0.8: novel scenario, integrates subtopics, careful reasoning.\n"
        "- 1.0: multi-step + traps/edge-cases; requires deeper insight.\n"
        "\nNOVELTY & VARIETY CONSTRAINTS:\n"
        "- Do NOT rephrase or lightly modify prior questions; use new scenarios, variables, constraints, and structures.\n"
        "- Balance conceptual vs computational vs edge-case questions; avoid repeating templates.\n"
        "- Distractors must be plausible and tied to specific misconceptions; avoid trivial variants.\n"
        "Do not include prose outside of JSON."
        + topics_desc
        + stats_desc
        + "\n\nSUMMARY:\n" + summary
    )

    resp = gemini_client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=user_prompt,
        config={
            "temperature": 1.0,
            "response_mime_type": "application/json",
            "response_schema": {
                "type": "array",
                "minItems": max(1, min(count, 80)),
                "maxItems": count,
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {"type": "string"},
                        "options": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 4,
                            "maxItems": 4,
                        },
                        "correctIndex": {"type": "integer", "minimum": 0, "maximum": 3},
                        "topic": {"type": "string"},
                    },
                    "required": ["question", "options", "correctIndex", "topic"],
                },
            },
        },
    )
    raw = (getattr(resp, "text", None) or "").strip()
    data = parse_json_lenient(raw or "{}")
    items = data if isinstance(data, list) else (data.get("items") if isinstance(data, dict) else [])
    cleaned: list[dict] = []
    for q in items:
        if not isinstance(q, dict):
            continue
        question = (
            str(
                q.get("question")
                or q.get("prompt")
                or q.get("q")
                or ""
            )
        ).strip()
        opts = q.get("options") or q.get("choices") or q.get("answers") or []
        if not isinstance(opts, list):
            opts = []
        options = [str(o).strip() for o in opts if str(o).strip()]
        if len(options) >= 4:
            options = options[:4]
        elif len(options) == 3:
            options.append("None of the above")
        else:
            continue
        ci = q.get("correctIndex")
        if not isinstance(ci, int):
            ci = (
                q.get("answerIndex")
                if isinstance(q.get("answerIndex"), int)
                else to_index_from_answer(q.get("answer"), options)
            )
        if not isinstance(ci, int):
            ci = to_index_from_answer(q.get("correct"), options)
        if not isinstance(ci, int) or not (0 <= ci <= 3):
            ci = to_index_from_answer(q.get("correctOption"), options)
        if not isinstance(ci, int) or not (0 <= ci <= 3):
            continue
        if not question or any(not o for o in options):
            continue
        topic_val = q.get("topic")
        topic_str = None
        if topic_val is not None:
            try:
                topic_str = str(topic_val).strip() or None
            except Exception:
                topic_str = None
        cleaned.append({
            "question": sanitize_katex(question),
            "options": [sanitize_katex(o) for o in options],
            "correctIndex": ci,
            "topic": topic_str,
        })
        if len(cleaned) >= count:
            break
    if not cleaned:
        retry_prompt = (
            "Create a multiple-choice quiz as JSON only. "
            f"Return exactly {count} questions. "
            "Each question must have exactly 4 options and a single correctIndex (0..3). "
            "Do NOT copy or reword examples, data, names, or numbers from the SUMMARY. "
            "When using math, use LaTeX/KaTeX-safe syntax (e.g., x^{2}, \\sqrt{...}, \\frac{...}{...}, \\sum, Greek letters as \\alpha). "
            "Ensure expressions are KaTeX-parseable: escape special characters when needed and avoid HTML entities like &gt; or &lt;. Use literal '>' and '<'. "
            "\nDIFFICULTY RUBRIC (D in [0,1]): 0.2 recall, 0.4 single-step, 0.6 multi-step with subtle distractor, 0.8 novel/integrated, 1.0 multi-step + traps.\n"
            "NOVELTY: Do NOT rephrase prior questions; change scenario, variables, constraints, and structure.\n"
            "VARIETY: Mix conceptual/computational/edge-cases; avoid repeating templates. Distractors must be plausible misconceptions.\n"
            "Do not include prose outside of JSON.\n\nSUMMARY:\n" + summary
        )
        try:
            retry_resp = gemini_client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=retry_prompt,
                config={
                    "temperature": 1.0,
                    "response_mime_type": "application/json",
                    "response_schema": {
                        "type": "array",
                        "minItems": max(1, min(count, 80)),
                        "maxItems": count,
                        "items": {
                            "type": "object",
                            "properties": {
                                "question": {"type": "string"},
                                "options": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "minItems": 4,
                                    "maxItems": 4,
                                },
                                "correctIndex": {"type": "integer", "minimum": 0, "maximum": 3},
                            },
                            "required": ["question", "options", "correctIndex"],
                        },
                    },
                },
            )
            retry_raw = (getattr(retry_resp, "text", None) or "").strip()
            data = parse_json_lenient(retry_raw or "{}")
            items = []
            if isinstance(data, dict):
                if isinstance(data.get("questions"), list):
                    items = data.get("questions") or []
            elif isinstance(data, list):
                items = data
            for q in items:
                if not isinstance(q, dict):
                    continue
                question = (
                    str(q.get("question") or q.get("prompt") or q.get("q") or "")
                ).strip()
                opts = q.get("options") or q.get("choices") or q.get("answers") or []
                if not isinstance(opts, list):
                    opts = []
                options = [str(o).strip() for o in opts if str(o).strip()]
                if len(options) >= 4:
                    options = options[:4]
                elif len(options) == 3:
                    options.append("None of the above")
                else:
                    continue
                ci = q.get("correctIndex")
                if not isinstance(ci, int):
                    ci = (
                        q.get("answerIndex")
                        if isinstance(q.get("answerIndex"), int)
                        else to_index_from_answer(q.get("answer"), options)
                    )
                if not isinstance(ci, int):
                    ci = to_index_from_answer(q.get("correct"), options)
                if not isinstance(ci, int) or not (0 <= ci <= 3):
                    ci = to_index_from_answer(q.get("correctOption"), options)
                if not isinstance(ci, int) or not (0 <= ci <= 3):
                    continue
                if not question or any(not o for o in options):
                    continue
                cleaned.append({
                    "question": sanitize_katex(question),
                    "options": [sanitize_katex(o) for o in options],
                    "correctIndex": ci,
                })
                if len(cleaned) >= count:
                    break
        except Exception:
            pass
    return cleaned
    
# ============================================================================
# UTILITY FUNCTIONS - STUDY GUIDE GENERATION
# ============================================================================

def generate_study_guide(text: str) -> str:
    """Use Gemini to expand notes into a structured study guide."""
    prompt = (
        "Transform the following notes into a comprehensive STUDY GUIDE with clear structure.\n"
        "Requirements:\n"
        "- Use section headings and concise bullet points.\n"
        "- Expand briefly on key concepts (definitions, axioms, theorems, formulas).\n"
        "- Add short examples where helpful.\n"
        "- When giving examples, invent fresh/original ones; do not copy or lightly paraphrase examples from the notes.\n"
        "- Avoid meta commentary and instructions. Output the study guide only.\n\n"
        f"NOTES:\n{text}"
    )

    try:
        resp = gemini_client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )
        out = (getattr(resp, "text", None) or "").strip()
        return sanitize_katex(out)
    except Exception:
        return text


# ============================================================================
# UTILITY FUNCTIONS - FLASHCARD GENERATION
# ============================================================================

def estimate_flashcard_count(text: str) -> int:
    """Heuristic to pick number of flashcards proportional to input size."""
    t = estimate_tokens(text or "")
    if t <= 0:
        return 10
    # Roughly 1 card per ~80 tokens, clamp to [10, 80]
    return max(10, min(80, t // 50))

def generate_flashcards_with_gemini(text: str, count: int) -> list[dict]:
    """Ask Gemini for JSON list of {question, answer} pairs.
    Ensures valid structure and trims to requested count.
    """

    prompt = (
        "Generate flashcards as a JSON array only (no prose, no markdown). "
        f"Return exactly {count} items. Each item must be an object with 'question' and 'answer' strings. "
        "Keep answers brief and simple: aim for 1–2 short sentences and <= 200 characters. Avoid long derivations or full proofs; provide the key idea or formula only. "
        "If math is involved, write LaTeX delimited by $...$ (inline) or $$...$$ (block). "
        "When writing math, use KaTeX/LaTeX syntax for exponents, square roots, fractions, summations, and Greek letters (e.g., x^{2}, \\sqrt{...}, \\frac{...}{...}, \\sum, \\alpha). Do not use the caret '^' for exponents, plain 'sqrt', ASCII fractions, or plain Greek names. "
        "For inequalities, use the literal '>' and '<' characters, not HTML entities like &gt; or &lt;. "
        "Do NOT copy or reword examples, data, names, or numbers from the SUMMARY. "
        "If chemistry is involved, use mhchem syntax like \\ce{H2O}, \\ce{Na+}. "
        "Do not include citations, references, or meta commentary.\n\nCONTENT:\n" + (text or "")
    )

    try:
        resp = gemini_client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": {
                    "type": "array",
                    "minItems": max(1, min(count, 80)),
                    "maxItems": count,
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string"},
                            "answer": {"type": "string"},
                        },
                        "required": ["question", "answer"],
                    },
                },
            },
        )
        raw = (getattr(resp, "text", None) or "").strip()
        try:
            data = json.loads(raw)
        except Exception:
            data = parse_json_lenient(raw or "[]")
        items = data if isinstance(data, list) else (data.get("items") if isinstance(data, dict) else [])
        flashcards: list[dict] = []
        if isinstance(items, list):
            for it in items:
                if not isinstance(it, dict):
                    continue
                q = sanitize_katex(str(it.get("question") or "").strip())
                a = sanitize_katex(str(it.get("answer") or "").strip())
                if not q or not a:
                    continue
                flashcards.append({"question": q, "answer": a})
                if len(flashcards) >= count:
                    break
        return flashcards
    except Exception as e:
        print(e, flush=True)
        return []


# ============================================================================
# ROUTES - AUTHENTICATION
# ============================================================================

@app.route("/api/firebase-login", methods=["POST"])
def firebase_login():
    """Firebase login verification (for Google sign-in)."""
    data = request.get_json()
    token = data.get("idToken")
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        user_email = decoded_token.get("email")
        user_name = decoded_token.get("name", "NoName")
        if not user_email:
            return jsonify({"error": "email missing from firebase token"}), 400

        conn = get_connection()
        if not conn:
            # No DB available; create a session from Firebase token for local dev
            session["user_id"] = decoded_token.get("uid") or user_email
            session["username"] = user_name or (user_email.split("@")[0])
            return jsonify({"message": "Firebase login verified (no DB)", "username": session["username"]}), 200
        cur = conn.cursor()
        try:
            cur.execute('SELECT id, username FROM users WHERE email = %s', (user_email,))
            row = cur.fetchone()
            if row:
                user_id, username = row
            else:
                base_username = (user_name or user_email.split("@")[0] or "user").strip()[:32]
                cur.execute(
                    'INSERT INTO users (username, email) VALUES (%s, %s) RETURNING id',
                    (base_username, user_email),
                )
                user_id = cur.fetchone()[0]
                username = base_username
                conn.commit()
            session["user_id"] = user_id
            session["username"] = username
            return jsonify({"message": "Firebase login verified", "user_id": user_id, "username": username}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 401


@app.route("/api/login", methods=["POST"])
def login():
    """Standard email/username + password login."""
    data = request.get_json()
    input_value = data.get("input_value")
    password = data.get("password")

    conn = get_connection()
    if not conn:
        return jsonify({"error": "Database connection error"}), 500

    cur = conn.cursor()
    if "@" in input_value:
        cur.execute('SELECT id, username, password_hash FROM users WHERE email = %s', (input_value,))
    else:
        cur.execute('SELECT id, username, password_hash FROM users WHERE username = %s', (input_value,))
    user = cur.fetchone()

    cur.close()
    conn.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_id, username, password_hash = user
    pw_ok = check_password_hash(password_hash, password)
    if not pw_ok:
        return jsonify({"error": "Incorrect password"}), 401

    session["user_id"] = user_id
    session["username"] = username
    return jsonify({"message": "Login successful", "username": username})


@app.route("/api/logout", methods=["POST"])
def logout():
    """Clear session and log out user."""
    session.clear()
    return jsonify({"message": "Logged out successfully"})


@app.route("/api/signup", methods=["POST"])
def signup():
    """Create new user account."""
    data = request.get_json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    hashed_pw = generate_password_hash(password)
    conn = get_connection()
    if not conn:
        return jsonify({"error": "Database connection error"}), 500

    cur = conn.cursor()
    try:
        cur.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING id',
            (username, email, hashed_pw),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"message": "User created", "user_id": user_id}), 201
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"error": "Username or email already exists"}), 409
    finally:
        cur.close()
        conn.close()


# ============================================================================
# ROUTES - STUDY PAGE
# ============================================================================

@app.get("/api/recent_sets")
def list_recent_sets():
    """Return recent study sets and study guides for the current user ordered by created_at DESC.
    Output items: [{ type: 'study_set'|'study_guide', id, name?, title?, created_at }]
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # study sets
        try:
            cur.execute(
                "SELECT id, name, created_at FROM study_sets WHERE user_id = %s",
                (user_id,),
            )
            ss_rows = cur.fetchall()
        except Exception:
            ss_rows = []
        # study guides
        try:
            cur.execute(
                "SELECT id, title, created_at FROM study_guides WHERE user_id = %s",
                (user_id,),
            )
            sg_rows = cur.fetchall()
        except Exception:
            sg_rows = []
        # notes
        try:
            cur.execute(
                "SELECT id, title, created_at FROM notes WHERE user_id = %s",
                (user_id,),
            )
            note_rows = cur.fetchall()
        except Exception:
            note_rows = []
        # summaries
        try:
            cur.execute(
                "SELECT id, title, created_at FROM summaries WHERE user_id = %s",
                (user_id,),
            )
            sum_rows = cur.fetchall()
        except Exception:
            sum_rows = []
        cur.close()
        items = (
            [
                {"type": "study_set", "id": r[0], "name": r[1], "created_at": (r[2].isoformat() if r[2] else None)}
                for r in ss_rows
            ]
            + [
                {"type": "study_guide", "id": r[0], "title": r[1], "created_at": (r[2].isoformat() if r[2] else None)}
                for r in sg_rows
            ]
            + [
                {"type": "note", "id": r[0], "title": r[1], "created_at": (r[2].isoformat() if r[2] else None)}
                for r in note_rows
            ]
            + [
                {"type": "summary", "id": r[0], "title": r[1], "created_at": (r[2].isoformat() if r[2] else None)}
                for r in sum_rows
            ]
        )
        # Sort by created_at DESC, nulls last, and limit to top 5
        items.sort(key=lambda x: (x.get("created_at") is None, x.get("created_at") or ""), reverse=True)
        items = items[:5]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.get("/api/course_progress")
def course_progress():
    """Compute mastery-based progress for a given course for the current user.

    Query params:
      - course_id: integer id of the course

    For each topic in this course, we look at quiz_questions that belong to quizzes
    for this course and current user, where quiz_questions.topic matches the topic title
    (case-insensitive). For each question we define a per-question score:

      if max_streak < 3 OR avg_confidence < 3.5: use mastery (0-5)
      else: 1.0

    where avg_confidence is taken as the stored confidence (0-5) on the question.

    Per-topic score is the average of these question scores for that topic.
    Overall progress is the average of per-topic scores across topics in the course,
    treating topics with no questions as 0. The final overall_percent is scaled to 0-100
    by dividing by 5 and multiplying by 100.
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401

    try:
        raw_course_id = request.args.get("course_id")
        if raw_course_id is None:
            return jsonify(error="course_id required"), 400
        try:
            course_id = int(raw_course_id)
        except Exception:
            return jsonify(error="course_id must be an integer"), 400

        conn = get_connection()
        if not conn:
            return jsonify(error="Database connection error"), 500

        cur = conn.cursor()
        # Ensure course belongs to current user
        cur.execute(
            "SELECT id FROM courses WHERE id = %s AND created_by = %s",
            (course_id, user_id),
        )
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return jsonify(error="not found"), 404

        # For each topic in this course, compute average question score.
        # Include questions from quizzes in this course AND quizzes with no course (course_id IS NULL)
        # when their topic matches the topic title.
        cur.execute(
            """
            SELECT
              t.id,
              t.title,
              COALESCE(
                AVG(
                  CASE
                    WHEN qq.max_streak < 3
                         OR COALESCE(qq.confidence, 0) < 3.5
                    THEN COALESCE(qq.mastery, 0)
                    ELSE 1.0
                  END
                ),
                0
              ) AS topic_score
            FROM topics t
            LEFT JOIN quizzes q
              ON q.created_by = %s
             AND (q.course_id = t.course_id OR q.course_id IS NULL)
            LEFT JOIN quiz_questions qq
              ON qq.quiz_id = q.id
             AND lower(TRIM(COALESCE(qq.topic, ''))) = lower(TRIM(t.title))
             AND qq.topic IS NOT NULL
             AND qq.topic != ''
            WHERE t.course_id = %s
            GROUP BY t.id, t.title
            ORDER BY t.id
            """,
            (user_id, course_id),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        per_topic = []
        total_score = 0.0
        topic_count = 0
        for tid, title, topic_score in rows:
            score = float(topic_score) if topic_score is not None else 0.0
            per_topic.append({"topic_id": tid, "title": title, "score": score})
            total_score += score
            topic_count += 1

        overall_mastery = 0.0
        overall_percent = 0.0
        if topic_count > 0:
            overall_mastery = total_score / float(topic_count)
            # mastery is 0-5; scale to 0-100
            overall_percent = max(0.0, min(100.0, (overall_mastery / 5.0) * 100.0))

        return (
            jsonify(
                per_topic=per_topic,
                overall_mastery=overall_mastery,
                overall_percent=overall_percent,
            ),
            200,
        )
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/course_low_mastery_topics")
def course_low_mastery_topics():
    """Return topics in a course whose mastery-based score is below 3.5.

    Uses the same scoring rule and topic aggregation as /api/course_progress,
    but filters the per-topic list on the backend and only returns topics with
    score < 3.5 for the current user and given course.
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401

    conn = None
    try:
        raw_course_id = request.args.get("course_id")
        if raw_course_id is None:
            return jsonify(error="course_id required"), 400
        try:
            course_id = int(raw_course_id)
        except Exception:
            return jsonify(error="course_id must be an integer"), 400

        conn = get_connection()
        if not conn:
            return jsonify(error="Database connection error"), 500

        cur = conn.cursor()
        # Ensure course belongs to current user
        cur.execute(
            "SELECT id FROM courses WHERE id = %s AND created_by = %s",
            (course_id, user_id),
        )
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return jsonify(error="not found"), 404

        # Reuse the same aggregation query as course_progress to compute
        # per-topic scores for this course.
        cur.execute(
            """
            SELECT
              t.id,
              t.title,
              COALESCE(
                AVG(
                  CASE
                    WHEN qq.max_streak < 3
                         OR COALESCE(qq.confidence, 0) < 3.5
                    THEN COALESCE(qq.mastery, 0)
                    ELSE 1.0
                  END
                ),
                0
              ) AS topic_score
            FROM topics t
            LEFT JOIN quizzes q
              ON q.created_by = %s
             AND (q.course_id = t.course_id OR q.course_id IS NULL)
            LEFT JOIN quiz_questions qq
              ON qq.quiz_id = q.id
             AND lower(TRIM(COALESCE(qq.topic, ''))) = lower(TRIM(t.title))
             AND qq.topic IS NOT NULL
             AND qq.topic != ''
            WHERE t.course_id = %s
            GROUP BY t.id, t.title
            ORDER BY t.id
            """,
            (user_id, course_id),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        items = []
        for tid, title, topic_score in rows:
            score = float(topic_score) if topic_score is not None else 0.0
            if score < 3.5:
                items.append({"topic_id": tid, "title": title, "score": score})

        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        try:
            if conn is not None:
                conn.close()
        except Exception:
            pass


@app.get("/api/course_progress_all")
def course_progress_all():
    """Compute mastery-based progress across all topics for the current user.

    Uses the same per-question scoring rule as course_progress, but aggregates
    over all quizzes created by the user (including quizzes with no course).

    For each distinct non-empty topic string on quiz_questions for this user,
    we compute:

      per-question score = mastery (0-5) if max_streak < 3 OR confidence < 3.5
                         = 1.0 otherwise

    Per-topic score is the average of these per-question scores.
    Overall progress is the average of per-topic scores across all topics.
    The API returns overall_percent as a 0-1 decimal, consistent with the
    front-end's scaling to 0-100.
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401

    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              NULLIF(TRIM(COALESCE(qq.topic, '')), '') AS title,
              AVG(
                CASE
                  WHEN qq.max_streak < 3
                       OR COALESCE(qq.confidence, 0) < 3.5
                  THEN COALESCE(qq.mastery, 0)
                  ELSE 1.0
                END
              ) AS topic_score
            FROM quizzes q
            JOIN quiz_questions qq
              ON qq.quiz_id = q.id
            WHERE q.created_by = %s
              AND NULLIF(TRIM(COALESCE(qq.topic, '')), '') IS NOT NULL
            GROUP BY NULLIF(TRIM(COALESCE(qq.topic, '')), '')
            ORDER BY title
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        per_topic = []
        total_score = 0.0
        topic_count = 0
        for title, topic_score in rows:
            score = float(topic_score) if topic_score is not None else 0.0
            per_topic.append({"title": title, "score": score})
            total_score += score
            topic_count += 1

        overall_mastery = 0.0
        overall_percent = 0.0
        if topic_count > 0:
            overall_mastery = total_score / float(topic_count)
            # mastery is 0-5; expose as 0-1 decimal for the client
            overall_percent = max(0.0, min(1.0, overall_mastery / 5.0))

        return (
            jsonify(
                per_topic=per_topic,
                overall_mastery=overall_mastery,
                overall_percent=overall_percent,
            ),
            200,
        )
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/course_progress_by_course")
def course_progress_by_course():
    """Return per-course mastery-based progress for the current user, including 'no course'.

    Uses the same scoring rule as course_progress:
      per-question score = mastery (0-5) if max_streak < 3 OR confidence < 3.5, else 1.0.

    For each distinct (course_id, topic) pair we compute the average question score for that
    topic in that course, then average topic scores per course to get a course-level score.
    The response exposes overall_percent as a 0-1 decimal per course.
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401

    # IMPORTANT: only compute progress for the single course specified
    # by course_id in the query string. Do not include any other courses.
    raw_course_id = request.args.get("course_id")
    if raw_course_id is None:
        return jsonify(error="course_id required"), 400
    try:
        course_id = int(raw_course_id)
    except Exception:
        return jsonify(error="course_id must be an integer"), 400

    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # Pull raw per-question data only for quizzes that belong to this course.
        # Special case: course_id == 0 represents the 'no course' bucket (q.course_id IS NULL).
        if course_id == 0:
            cur.execute(
                """
                SELECT
                  q.course_id,
                  NULLIF(TRIM(COALESCE(qq.topic, '')), '') AS topic,
                  qq.mastery,
                  qq.max_streak,
                  qq.confidence
                FROM quizzes q
                JOIN quiz_questions qq
                  ON qq.quiz_id = q.id
                WHERE q.created_by = %s
                  AND q.course_id IS NULL
                  AND NULLIF(TRIM(COALESCE(qq.topic, '')), '') IS NOT NULL
                """,
                (user_id,),
            )
        else:
            cur.execute(
                """
                SELECT
                  q.course_id,
                  NULLIF(TRIM(COALESCE(qq.topic, '')), '') AS topic,
                  qq.mastery,
                  qq.max_streak,
                  qq.confidence
                FROM quizzes q
                JOIN quiz_questions qq
                  ON qq.quiz_id = q.id
                WHERE q.created_by = %s
                  AND q.course_id = %s
                  AND NULLIF(TRIM(COALESCE(qq.topic, '')), '') IS NOT NULL
                """,
                (user_id, course_id),
            )
        rows = cur.fetchall()

        # Build per-course, per-topic score lists in Python.
        # course_topic_scores[cid][topic] = [per-question scores]
        course_topic_scores: dict[object, dict[str, list[float]]] = {}
        for cid, topic, mastery, max_streak, confidence in rows:
            if (cid is None and course_id != 0) or topic is None:
                continue
            try:
                m_val = float(mastery) if mastery is not None else 0.0
            except Exception:
                m_val = 0.0
            try:
                streak = int(max_streak) if max_streak is not None else 0
            except Exception:
                streak = 0
            try:
                conf = float(confidence) if confidence is not None else 0.0
            except Exception:
                conf = 0.0

            if streak < 3 or conf < 3.5:
                score = m_val  # use mastery 0-5
            else:
                score = 1.0

            bucket = course_topic_scores.setdefault(cid, {})
            lst = bucket.setdefault(str(topic), [])
            lst.append(score)


        # Now compute per-course mastery: average topic scores per course.

        course_scores: dict[object, float] = {}
        for cid, topics in course_topic_scores.items():
            topic_scores: list[float] = []
            for _, scores in topics.items():
                if not scores:
                    continue
                topic_scores.append(sum(scores) / float(len(scores)))
            if not topic_scores:
                continue
            course_scores[cid] = sum(topic_scores) / float(len(topic_scores))

        # Fetch the name for this specific course_id
        name = ""
        if course_id == 0:
            # Synthetic 'No course' bucket
            name = "No course"
        elif course_scores:
            cur.execute(
                "SELECT name FROM courses WHERE created_by = %s AND id = %s",
                (user_id, course_id),
            )
            for s in cur.fetchall():
                name = s[0]

        # Build a single result entry for this course (if we have any data).
        key_id = None if course_id == 0 else course_id
        if key_id not in course_scores:
            # No questions/topics yet for this course -> 0 progress
            overall_mastery = 0.0
        else:
            overall_mastery = course_scores[key_id]


        overall_percent = max(0.0, min(1.0, overall_mastery / 5.0))

        return (
            jsonify(
                course_id=None if course_id == 0 else course_id,
                course_name=name,
                overall_mastery=overall_mastery,
                overall_percent=overall_percent,
            ),
            200,
        )
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/dashboard_recent_sets")
def list_recent_dashboard_sets():
    """Return only recent study sets and study guides for the current user ordered by created_at DESC.
    Output items: [{ type: 'study_set'|'study_guide', id, name?, title?, created_at }].
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # study sets
        cur.execute(
            "SELECT id, name, created_at FROM study_sets WHERE user_id = %s",
            (user_id,),
        )
        ss_rows = cur.fetchall()
        # study guides
        try:
            cur.execute(
                "SELECT id, title, created_at FROM study_guides WHERE user_id = %s",
                (user_id,),
            )
            sg_rows = cur.fetchall()
        except Exception:
            sg_rows = []
        cur.close()
        items = (
            [
                {"type": "study_set", "id": r[0], "name": r[1], "created_at": (r[2].isoformat() if r[2] else None)}
                for r in ss_rows
            ]
            + [
                {"type": "study_guide", "id": r[0], "title": r[1], "created_at": (r[2].isoformat() if r[2] else None)}
                for r in sg_rows
            ]
        )
        items.sort(key=lambda x: (x.get("created_at") is None, x.get("created_at") or ""), reverse=True)
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


# ============================================================================
# ROUTES - COURSES
# ============================================================================

@app.post("/api/courses")
def create_course():
    """Create a course with { name, description } for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    if not name or not description:
        return jsonify(error="name and description are required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO courses (name, description, created_by) VALUES (%s, %s, %s) RETURNING id",
            (name, description, user_id),
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return jsonify(course={"id": new_id, "name": name, "description": description, "created_by": user_id}), 201
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/courses")
def list_courses():
    """List courses for the current session user, ordered by id ASC."""
    try:
        user_id = session.get("user_id")
        if not user_id:
            return jsonify(error="unauthorized"), 401
        conn = get_connection()
        if not conn:
            return jsonify(error="Database connection error"), 500
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, description, created_by FROM courses WHERE created_by = %s ORDER BY id ASC",
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        items = [
            {"id": r[0], "name": r[1], "description": r[2], "created_by": r[3]}
            for r in rows
        ]
        return jsonify(courses=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500


# ============================================================================
# ROUTES - STUDY SETS
# ============================================================================


@app.patch("/api/study_sets/<int:sid>")
def update_study_set(sid: int):
    """Update properties of a study set (currently only name) for the current user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    new_name = str(data.get("name") or "").strip()
    if not new_name:
        return jsonify(error="name is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM study_sets WHERE id = %s AND user_id = %s", (sid, user_id))
        row = cur.fetchone()
        if not row:
            return jsonify(error="not found"), 404
        cur.execute("UPDATE study_sets SET name = %s WHERE id = %s", (new_name, sid))
        conn.commit()
        cur.close()
        return jsonify(id=sid, name=new_name), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/study_sets")
def create_study_set():
    """Create a study set for the current user. Body: { name, course_id? }"""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    course_id = data.get("course_id")
    cards = data.get("cards")
    if not name:
        return jsonify(error="name is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # Validate cards if provided (store only question/answer)
        norm_cards = []
        if isinstance(cards, list):
            for c in cards:
                try:
                    q = str((c or {}).get("question", "")).strip()
                    a = str((c or {}).get("answer", "")).strip()
                    if q or a:
                        norm_cards.append({"question": q, "answer": a})
                except Exception:
                    continue
        cur.execute(
            """
            INSERT INTO study_sets (name, course_id, user_id, cards)
            VALUES (%s, %s, %s, %s)
            RETURNING id, created_at
            """,
            (name, course_id, user_id, json.dumps(norm_cards)),
        )
        sid, created_at = cur.fetchone()
        conn.commit()
        cur.close()
        return jsonify(id=sid, name=name, course_id=course_id, created_at=(created_at.isoformat() if created_at else None), cards=norm_cards), 201
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/study_sets")
def list_study_sets():
    """List study sets for the current user. Optional query: course_id=..."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    course_id = request.args.get("course_id", type=int)
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        if course_id is not None:
            cur.execute(
                "SELECT id, name, course_id, created_at, cards FROM study_sets WHERE user_id = %s AND course_id = %s ORDER BY id ASC",
                (user_id, course_id),
            )
        else:
            cur.execute(
                "SELECT id, name, course_id, created_at, cards FROM study_sets WHERE user_id = %s ORDER BY id ASC",
                (user_id,),
            )
        rows = cur.fetchall()
        cur.close()
        items = [
            {
                "id": r[0],
                "name": r[1],
                "course_id": r[2],
                "created_at": (r[3].isoformat() if r[3] else None),
                "cards": r[4] or [],
            }
            for r in rows
        ]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/study_sets/<int:sid>/cards")
def add_card_to_study_set(sid: int):
    """Append a single card to a study set owned by the current user. Body: { question, answer, title? }"""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    question = str((data.get("question") or "").strip())
    answer = str((data.get("answer") or "").strip())
    if not (question or answer):
        return jsonify(error="question or answer required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, cards FROM study_sets WHERE id = %s AND user_id = %s", (sid, user_id))
        row = cur.fetchone()
        if not row:
            return jsonify(error="not found"), 404
        existing = row[1] or []
        try:
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []
        payload = {"question": question, "answer": answer}
        existing.append(payload)
        # Also refresh created_at to bubble this set to recent
        cur.execute("UPDATE study_sets SET cards = %s, created_at = NOW() WHERE id = %s", (json.dumps(existing), sid))
        conn.commit()
        cur.close()
        return jsonify(id=sid, added=payload, count=len(existing)), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.delete("/api/study_sets/<int:sid>/cards/<int:card_index>")
def delete_card_from_study_set(sid: int, card_index: int):
    """Delete a card by index from a study set owned by the current user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, cards FROM study_sets WHERE id = %s AND user_id = %s", (sid, user_id))
        row = cur.fetchone()
        if not row:
            return jsonify(error="not found"), 404
        existing = row[1] or []
        try:
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []
        if not (0 <= card_index < len(existing)):
            return jsonify(error="invalid index"), 400
        # remove the item
        del existing[card_index]
        cur.execute("UPDATE study_sets SET cards = %s WHERE id = %s", (json.dumps(existing), sid))
        conn.commit()
        cur.close()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/study_sets/<int:sid>")
def get_study_set(sid: int):
    """Fetch a single study set by id for the current user, including cards."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, course_id, created_at, cards FROM study_sets WHERE id = %s AND user_id = %s",
            (sid, user_id),
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return jsonify(error="not found"), 404
        sid_f, name, course_id, created_at, cards_json = row
        try:
            cards = json.loads(cards_json) if isinstance(cards_json, str) else (cards_json or [])
        except Exception:
            cards = []
        return jsonify(id=sid_f, name=name, course_id=course_id, created_at=(created_at.isoformat() if created_at else None), cards=cards), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.delete("/api/study_sets/<int:sid>")
def delete_study_set(sid: int):
    """Delete a study set owned by the current user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM study_sets WHERE id = %s AND user_id = %s RETURNING id", (sid, user_id))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


# ============================================================================
# ROUTES - FLASHCARDS (AI GENERATION)
# ============================================================================

@app.post("/api/flashcards")
def create_flashcards_from_text():
    """Generate flashcards from input text using Gemini and save as a study set.
    Body: { title: str, text: str, course_id?: int }
    Returns: { id, name, cards }
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "Flashcards").strip()[:120]
    text = (data.get("text") or "").strip()
    course_id = data.get("course_id", None)
    if not text:
        return jsonify(error="missing text"), 400
    try:
        n = estimate_flashcard_count(text)
        items = generate_flashcards_with_gemini(text, n)
        if not items:
            return jsonify(error="failed to generate flashcards"), 500
        conn = get_connection()
        if not conn:
            return jsonify(error="Database connection error"), 500
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO study_sets (name, course_id, user_id, cards)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (title or "Flashcards", course_id, user_id, json.dumps(items)),
            )
            sid = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return jsonify(id=sid, name=title or "Flashcards", cards=items), 200
        except Exception as e:
            conn.rollback()
            return jsonify(error=str(e)), 500
        finally:
            conn.close()
    except Exception as e:
        return jsonify(error=str(e)), 500


# ============================================================================
# ROUTES - NOTES
# ============================================================================

@app.post("/api/notes")
def create_note():
    """Create a note for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "Untitled").strip() or "Untitled"
    content = (data.get("content") or "").strip()
    course_id = data.get("course_id")
    topics = data.get("topics")
    if isinstance(topics, list):
        try:
            topics = [str(t).strip() for t in topics if str(t).strip()]
        except Exception:
            topics = []
    else:
        topics = []
    if not content:
        return jsonify(error="content is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO notes (title, course_id, topics, user_id, content)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, updated_at
            """,
            (title, course_id, topics, user_id, content),
        )
        nid, updated_at = cur.fetchone()
        conn.commit()
        cur.close()
        return jsonify(id=nid, title=title, updated_at=(updated_at.isoformat() if updated_at else None)), 201
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.delete("/api/notes/<int:nid>")
def delete_note(nid: int):
    """Delete a note owned by the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM notes WHERE id = %s AND user_id = %s RETURNING id", (nid, user_id))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/all_notes")
def list_all_notes():
    """List ALL notes for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, title, updated_at
            FROM notes
            WHERE user_id = %s
            ORDER BY updated_at DESC NULLS LAST, id DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
        items = [
            {"id": r[0], "title": r[1], "updated_at": (r[2].isoformat() if r[2] else None)} for r in rows
        ]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/notes/<int:nid>")
def get_note(nid: int):
    """Fetch a single note (title, content) for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, title, content, updated_at FROM notes WHERE id = %s AND user_id = %s",
            (nid, user_id),
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return jsonify(error="not found"), 404
        return jsonify(id=row[0], title=row[1], content=row[2], updated_at=(row[3].isoformat() if row[3] else None)), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.patch("/api/notes/<int:nid>")
def rename_note(nid: int):
    """Rename a note's title owned by the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify(error="title is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("UPDATE notes SET title = %s WHERE id = %s AND user_id = %s RETURNING id", (title, nid, user_id))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        return jsonify(id=nid, title=title), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


# ============================================================================
# ROUTES - QUIZZES
# ============================================================================


def generate_topics_from_text(text: str, count: int = 10) -> list[str]:
    t = (text or "").strip()
    if not t:
        return []
    prompt = (
        "Extract exactly "
        + str(count)
        + " distinct topics from the CONTENT below as a JSON array of strings. "
          "Topics should mix single words (e.g., 'derivatives', 'velocity', 'matrices') and short phrases (e.g., 'integration by parts', 'matrix multiplication', 'states of matter'). "
          "No explanations; JSON array only.\n\nCONTENT:\n"
        + t[:30000]
    )
    try:
        resp = gemini_client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": {
                    "type": "array",
                    "minItems": count,
                    "maxItems": count,
                    "items": {"type": "string"},
                },
            },
        )
        raw = (getattr(resp, "text", None) or "").strip()
        data = parse_json_lenient(raw or "[]")
        arr = data if isinstance(data, list) else []
        topics: list[str] = []
        seen = set()
        for s in arr:
            try:
                item = str(s).strip()
            except Exception:
                continue
            if not item:
                continue
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            topics.append(item[:80])
            if len(topics) >= count:
                break
        return topics
    except Exception:
        return []


@app.delete("/api/quizzes/<int:qid>")
def delete_quiz(qid: int):
    """Delete a quiz owned by the current session user along with its questions."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM quizzes WHERE id = %s AND created_by = %s", (qid, user_id))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(error="not found"), 404
        cur.execute("DELETE FROM quiz_questions WHERE quiz_id = %s", (qid,))
        cur.execute("DELETE FROM quizzes WHERE id = %s", (qid,))
        conn.commit()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/quizzes/<int:qzid>")
def get_quiz(qzid: int):
    """Return a quiz with its questions for the session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, created_at, COALESCE(score,0), COALESCE(original_count, 0), COALESCE(source_summary, '') FROM quizzes WHERE id = %s AND created_by = %s", (qzid, user_id))
        q = cur.fetchone()
        if not q:
            return jsonify(error="not found"), 404
        # Determine if quiz is completed (no unanswered questions)
        cur.execute(
            """
            SELECT
              SUM(CASE WHEN (user_answer IS NULL OR TRIM(user_answer) = '') THEN 1 ELSE 0 END) AS unanswered_count
            FROM quiz_questions
            WHERE quiz_id = %s
            """,
            (qzid,),
        )
        unanswered_row = cur.fetchone()
        unanswered_count = int(unanswered_row[0] or 0)
        completed = unanswered_count == 0
        # Fallback: if the stored score already matches or exceeds
        # original_count, treat the quiz as completed for purposes of review
        # even if unanswered_count is non-zero due to edge cases. If
        # original_count is missing/zero (older quizzes), fall back to the
        # actual number of quiz_questions for this quiz.
        try:
            score_val = int(q[2] or 0)
        except Exception:
            score_val = 0
        try:
            orig_count = int(q[3] or 0)
        except Exception:
            orig_count = 0
        if orig_count <= 0:
            cur.execute("SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = %s", (qzid,))
            row_cnt = cur.fetchone()
            try:
                orig_count = int((row_cnt[0] if row_cnt else 0) or 0)
            except Exception:
                orig_count = 0
        if not completed and orig_count > 0 and score_val >= orig_count:
            completed = True
        # Determine if spaced repetition is active for this quiz (any next_review set)
        cur.execute("SELECT EXISTS (SELECT 1 FROM quiz_questions WHERE quiz_id = %s AND next_review IS NOT NULL)", (qzid,))
        has_spaced = bool(cur.fetchone()[0])

        # Always compute due set (for practice we will further filter to original_count block)
        cur.execute(
            """
            SELECT id, question_number, question, options, correct_answer, user_answer, is_correct, confidence,
                   COALESCE(times_correct,0), COALESCE(times_seen,0), COALESCE(correct_streak,0), COALESCE(option_counts, '{}')
            FROM quiz_questions
            WHERE quiz_id = %s AND next_review IS NOT NULL AND next_review <= NOW()
            ORDER BY next_review ASC, COALESCE(confidence, 999) ASC
            """,
            (qzid,),
        )
        due_rows = cur.fetchall()

        # Backfill if needed when practicing (completed or spaced active).
        # orig_count here is the effective quiz length computed above.
        # Cap current due rows to original_count if defined
        if orig_count > 0 and len(due_rows) > orig_count:
            due_rows = due_rows[:orig_count]
        source_summary = str(q[4] or "")
        # Only enter spaced/practice mode when the quiz is fully completed.
        # In-progress quizzes should continue with the original flow (ordered by question_number).
        practice_mode = completed
        if practice_mode and orig_count > 0 and len(due_rows) < orig_count and source_summary.strip():
            need = orig_count - len(due_rows)
            # Collect existing texts and topics
            cur.execute(
                """
                SELECT question, COALESCE(topic, '') FROM quiz_questions
                WHERE quiz_id = %s
                ORDER BY question_number ASC
                """,
                (qzid,),
            )
            all_qs = cur.fetchall()
            existing_texts = set()
            existing_topics = set()
            topic_counts: dict[str, int] = {}
            for question_text, topic in all_qs:
                tnorm = (question_text or '').strip().lower()
                existing_texts.add(tnorm)
                if topic:
                    tkey = str(topic).strip()
                    if tkey:
                        existing_topics.add(tkey)
                        topic_counts[tkey] = topic_counts.get(tkey, 0) + 1

            topic_list = sorted(t for t in existing_topics if t)
            # Load per-quiz topic difficulty map
            cur.execute("SELECT COALESCE(topic_difficulty, '{}'::jsonb) FROM quizzes WHERE id = %s", (qzid,))
            td_map_row = cur.fetchone()
            td_map = {}
            try:
                if td_map_row and td_map_row[0]:
                    td_map = dict(td_map_row[0]) if isinstance(td_map_row[0], dict) else json.loads(td_map_row[0])
            except Exception:
                td_map = {}
            difficulty_lines = []
            harder_topics: list[str] = []
            topic_stats: dict[str, list[float | int]] = {}
            for t in topic_list:
                dval = td_map.get(t, None)
                avg_d = 0.0
                if isinstance(dval, (int, float)):
                    try:
                        avg_d = max(0.0, min(1.0, float(dval)))
                    except Exception:
                        avg_d = 0.0
                cnt = int(topic_counts.get(t, 0))
                topic_stats[t] = [avg_d, cnt]
                if avg_d > 0.0:
                    boosted = max(0.0, min(1.0, avg_d + 0.10))
                    difficulty_lines.append(f"- {t}: target difficulty {boosted:.2f} (previous {avg_d:.2f})")
                    harder_topics.append(t)
            diff_note = ("\n\nDIFFICULTY TARGETS (by topic):\n" + "\n".join(difficulty_lines)) if difficulty_lines else ""
            topic_note = ("\n\nONLY create questions about these topics (balance coverage, maximize variety, avoid duplicates): " + ", ".join(topic_list)) if topic_list else ""
            harder_note = ("\n\nFOR THESE TOPICS, make each new question strictly harder than prior ones for that topic: " + ", ".join(harder_topics)) if harder_topics else ""
            # Build a compact list of prior question stems to avoid reusing/paraphrasing
            prior_stems: list[str] = []
            for qtext, _tp in all_qs:
                s = (qtext or "").strip()
                if not s:
                    continue
                s = re.sub(r"\s+", " ", s)
                if len(s) > 160:
                    s = s[:157] + "..."
                prior_stems.append(f"- {s}")
                if len(prior_stems) >= 10:
                    break
            avoid_note = (
                "\n\nDO NOT ECHO CONTEXT OR INSTRUCTIONS. RETURN JSON ONLY.\n"
                "AVOID REPEATS: Do NOT rephrase or lightly modify any of these prior questions.\n"
                "Do NOT include any content from the following block in your output; it is for avoidance only.\n"
                + "```\n" + "\n".join(prior_stems) + "\n```\n"
            ) if prior_stems else ""
            variety_note = "\n\nVARY question styles (conceptual, computational, edge cases), and increase complexity according to target difficulty."
            gen_input_summary = source_summary + topic_note + diff_note + harder_note + avoid_note + variety_note
            try:
                fresh = generate_quiz_with_gemini(gen_input_summary, max(need * 2, need + 2), topic_list, topic_stats)
            except Exception:
                fresh = []
            # Simple token-overlap de-dup (no regex): lowercase, strip basic punctuation, split on whitespace
            def _norm_tokens(txt: str) -> set:
                s = (txt or "").lower()
                s = s.translate(str.maketrans('', '', 
                    ".,;:!?()[]{}<>\"'`|\\/+-*=^_%$#@&"))
                return set(t for t in s.split() if len(t) > 2)

            existing_token_sets = [_norm_tokens(qtext) for qtext, _tp in all_qs]

            new_cleaned = []
            new_token_sets = []
            for qd in fresh:
                qt = (qd.get('question') or '').strip()
                if not qt:
                    continue
                tnorm = qt.lower()
                if tnorm in existing_texts:
                    continue
                # reject paraphrases by token-set Jaccard similarity vs prior questions
                toks = _norm_tokens(qt)
                is_similar = False
                for etoks in existing_token_sets:
                    union = len(toks | etoks) or 1
                    jacc = len(toks & etoks) / union
                    if jacc >= 0.5:
                        is_similar = True
                        break
                if is_similar:
                    continue
                # also prevent duplicates within this generated batch
                for btoks in new_token_sets:
                    union = len(toks | btoks) or 1
                    jacc = len(toks & btoks) / union
                    if jacc >= 0.5:
                        is_similar = True
                        break
                if is_similar:
                    continue
                assigned_topic = None
                for t in topic_list:
                    if t and t.lower() in tnorm:
                        assigned_topic = t
                        break
                if not assigned_topic and topic_list:
                    idx_rr = len(new_cleaned) % len(topic_list)
                    assigned_topic = topic_list[idx_rr]
                qd['_assigned_topic'] = assigned_topic
                new_cleaned.append(qd)
                new_token_sets.append(toks)
                if len(new_cleaned) >= need:
                    break
            # Retry generation if we still need more unique items
            attempts = 0
            while len(new_cleaned) < need and attempts < 2:
                attempts += 1
                try:
                    more = generate_quiz_with_gemini(
                        gen_input_summary,
                        max((need - len(new_cleaned)) * 3, (need - len(new_cleaned)) + 2),
                        topic_list,
                        topic_stats,
                    )
                except Exception:
                    more = []
                for qd in more:
                    qt = (qd.get('question') or '').strip()
                    if not qt:
                        continue
                    tnorm = qt.lower()
                    if tnorm in existing_texts:
                        continue
                    toks = _norm_tokens(qt)
                    is_similar = False
                    for etoks in existing_token_sets:
                        union = len(toks | etoks) or 1
                        jacc = len(toks & etoks) / union
                        if jacc >= 0.5:
                            is_similar = True
                            break
                    if is_similar:
                        continue
                    for btoks in new_token_sets:
                        union = len(toks | btoks) or 1
                        jacc = len(toks & btoks) / union
                        if jacc >= 0.5:
                            is_similar = True
                            break
                    if is_similar:
                        continue
                    assigned_topic = None
                    for t in topic_list:
                        if t and t.lower() in tnorm:
                            assigned_topic = t
                            break
                    if not assigned_topic and topic_list:
                        idx_rr = len(new_cleaned) % len(topic_list)
                        assigned_topic = topic_list[idx_rr]
                    qd['_assigned_topic'] = assigned_topic
                    new_cleaned.append(qd)
                    new_token_sets.append(toks)
                    if len(new_cleaned) >= need:
                        break

            if new_cleaned:
                cur.execute("SELECT COALESCE(MAX(question_number), 0) FROM quiz_questions WHERE quiz_id = %s", (qzid,))
                max_num = int(cur.fetchone()[0] or 0)
                inserted_any = False
                for i, qd in enumerate(new_cleaned, start=1):
                    options = qd.get('options') or []
                    question = qd.get('question') or ''
                    ci = qd.get('correctIndex')
                    try:
                        correct_answer = options[ci] if isinstance(ci, int) and 0 <= ci < len(options) else None
                    except Exception:
                        correct_answer = None
                    if not question or correct_answer is None:
                        continue
                    try:
                        cur.execute(
                            """
                            INSERT INTO quiz_questions (
                                quiz_id, question_number, question, options, correct_answer, user_answer, is_correct, topic,
                                last_reviewed, next_review
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                qzid,
                                max_num + i,
                                question,
                                options,
                                correct_answer,
                                None,
                                None,
                                qd.get('topic'),
                                q[1],  # quiz created_at
                                q[1],  # set next_review to created_at so it appears first
                            ),
                        )
                        inserted_any = True
                    except Exception:
                        continue
                conn.commit()
                # refresh due_rows: include all questions for this quiz_id
                # that are due (next_review <= NOW()); we'll cap to
                # original_count later.
                cur.execute(
                    """
                    SELECT id, question_number, question, options, correct_answer, user_answer, is_correct, confidence,
                           COALESCE(times_correct,0), COALESCE(times_seen,0), COALESCE(correct_streak,0), COALESCE(option_counts, '{}')
                    FROM quiz_questions
                    WHERE quiz_id = %s AND next_review IS NOT NULL AND next_review <= NOW()
                    ORDER BY next_review ASC, COALESCE(confidence, 999) ASC
                    """,
                    (qzid,),
                )
                due_rows = cur.fetchall()
                # Cap refreshed due rows to original_count as well
                if orig_count > 0 and len(due_rows) > orig_count:
                    due_rows = due_rows[:orig_count]

        # Choose which rows to return
        if practice_mode:
            rows = due_rows
        else:
            # In-progress: restrict to the original instance only
            cur.execute(
                """
                SELECT id, question_number, question, options, correct_answer, user_answer, is_correct, confidence,
                       COALESCE(times_correct,0), COALESCE(times_seen,0), COALESCE(correct_streak,0), COALESCE(option_counts, '{}')
                FROM quiz_questions
                WHERE quiz_id = %s AND question_number <= %s
                ORDER BY question_number ASC
                """,
                (qzid, int(q[3] or 0)),
            )
            rows = cur.fetchall()
        # Final safety cap: never return more than original_count
        if orig_count > 0 and rows:
            rows = rows[:orig_count]
        cur.close()
        questions = []
        next_idx = None
        # If the quiz is completed, we are returning a filtered 'due' subset. Renumber the sequence in the payload
        # to ensure the client does not anchor on original question_number and show stale items.
        if completed:
            for i, (rid, num, question, options, correct_answer, user_answer, is_correct, confidence, times_correct, times_seen, correct_streak, option_counts) in enumerate(rows, start=1):
                # For a due set, treat the first item as the next index
                if next_idx is None:
                    next_idx = 0
                questions.append({
                    "id": rid,
                    "question_number": i,
                    "question": question,
                    "options": options or [],
                    "correctIndex": ((options or []).index(correct_answer) if (options and correct_answer in (options or [])) else None),
                    "user_answer": user_answer,
                    "is_correct": is_correct,
                    "confidence": confidence,
                    "times_correct": times_correct,
                    "times_seen": times_seen,
                    "correct_streak": correct_streak,
                    "option_counts": option_counts or [],
                })
        else:
            for rid, num, question, options, correct_answer, user_answer, is_correct, confidence, times_correct, times_seen, correct_streak, option_counts in rows:
                if next_idx is None and (user_answer is None or str(user_answer).strip() == ""):
                    next_idx = int(num) - 1
                questions.append({
                    "id": rid,
                    "question_number": num,
                    "question": question,
                    "options": options or [],
                    "correctIndex": ((options or []).index(correct_answer) if (options and correct_answer in (options or [])) else None),
                    "user_answer": user_answer,
                    "is_correct": is_correct,
                    "confidence": confidence,
                    "times_correct": times_correct,
                    "times_seen": times_seen,
                    "correct_streak": correct_streak,
                    "option_counts": option_counts or [],
                })
        # Compute display score based on the rows we are returning (not historical total)
        try:
            display_correct = sum(1 for r in rows if (r[6] is True))  # r[6] is is_correct
        except Exception:
            display_correct = 0
        display_total = orig_count if (orig_count and orig_count > 0) else (len(rows) if rows else 0)

        return jsonify(
            id=q[0],
            created_at=(q[1].isoformat() if q[1] else None),
            score=q[2],
            questions=questions,
            next_unanswered_index=(next_idx if next_idx is not None else 0),
            original_count=orig_count,
            display_correct=display_correct,
            display_total=display_total,
        ), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.patch("/api/quizzes/<int:qid>")
def rename_quiz(qid: int):
    """Rename a quiz title for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify(error="title is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM quizzes WHERE id = %s AND created_by = %s", (qid, user_id))
        if not cur.fetchone():
            conn.rollback()
            return jsonify(error="not found"), 404
        cur.execute("UPDATE quizzes SET title = %s WHERE id = %s", (title, qid))
        conn.commit()
        return jsonify(id=qid, title=title), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/quiz")
def create_quiz():
    """Generate a quiz from summary text."""
    data = request.get_json(silent=True) or {}
    summary: str = (data.get("summary") or "").strip()
    size: str = (data.get("size") or "small").strip().lower()
    course_id = data.get("course_id")
    if not summary:
        return jsonify(error="Missing summary"), 400

    clamp = lambda v, lo, hi: (lo if v < lo else (hi if v > hi else v))
    tokens = estimate_tokens(summary)
    if size == "comprehensive":
        count = 50
    else:
        ranges = {
            "small": {"min_tokens": 200, "max_tokens": 1200, "low": 5, "high": 10},
            "medium": {"min_tokens": 600, "max_tokens": 3000, "low": 12, "high": 18},
            "large": {"min_tokens": 3000, "max_tokens": 12000, "low": 25, "high": 35},
        }
        rg = ranges.get(size, ranges["small"])
        span = max(1, rg["max_tokens"] - rg["min_tokens"])
        ratio = clamp((tokens - rg["min_tokens"]) / span, 0.0, 1.0)
        count = int(round(rg["low"] + ratio * (rg["high"] - rg["low"])))
    ok, msg = ensure_minimum_summary(summary, size)
    if not ok:
        return jsonify(error=msg), 400
    # Optional topics list from client (selected texts' topics)
    try:
        payload = request.get_json(silent=True) or {}
    except Exception:
        payload = {}
    raw_topics = payload.get("topics") if isinstance(payload, dict) else None
    topics_list: list[str] = []
    if isinstance(raw_topics, list):
        try:
            topics_list = [str(t).strip() for t in raw_topics if str(t).strip()]
        except Exception:
            topics_list = []

    try:
        # Pass topics_list so Gemini can assign a topic field per question
        questions = generate_quiz_with_gemini(summary, count, topics_list)
    except Exception as e:
        return jsonify(error=f"quiz generation failed: {e}"), 500
    if not questions:
        return jsonify(error="quiz generation returned no valid questions"), 500

    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE id = %s", (user_id,))
        if cur.fetchone() is None:
            cur.close()
            return jsonify(error="invalid session: user not found. Please sign in again."), 401
        cur.execute(
            """
            INSERT INTO quizzes (topics, created_by, score, original_count, source_summary, course_id)
            VALUES (%s, %s, 0, %s, %s, %s)
            RETURNING id
            """,
            (topics_list if topics_list else [], user_id, count, summary, course_id),
        )
        quiz_id = cur.fetchone()[0]

        # Assign topics to generated questions when possible so progress can be computed per topic.
        # Prefer any topic Gemini returns per-question (q['topic']); otherwise, leave topic NULL.
        inserted_question_ids: list[int] = []
        for i, q in enumerate(questions[:count], start=1):
            question = q.get("question")
            options = q.get("options") or []
            ci = q.get("correctIndex")
            try:
                correct_answer = options[ci] if isinstance(ci, int) and 0 <= ci < len(options) else None
            except Exception:
                correct_answer = None
            if not question or correct_answer is None:
                continue
            raw_topic = q.get("topic")
            try:
                assigned_topic = (str(raw_topic).strip() or None) if raw_topic is not None else None
            except Exception:
                assigned_topic = None
            cur.execute(
                """
                INSERT INTO quiz_questions (quiz_id, question_number, question, options, correct_answer, user_answer, is_correct, topic)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (quiz_id, i, question, options, correct_answer, None, None, assigned_topic),
            )
            qid = cur.fetchone()[0]
            inserted_question_ids.append(qid)
        conn.commit()
        cur.close()
        return jsonify(quiz_id=quiz_id, questions=questions[:count], question_ids=inserted_question_ids[:count]), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/quiz/answer")
def record_quiz_answer():
    """Record a user's answer to a quiz question and update score if newly correct."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    quiz_id = data.get("quiz_id")
    question_id = data.get("question_id")
    question_number = data.get("question_number")
    user_answer = (data.get("user_answer") or "").strip()
    # Optional confidence (0-5); if incorrect, will be stored as 0
    raw_conf = data.get("confidence")
    confidence = None
    try:
        if raw_conf is not None:
            ci = int(raw_conf)
            if ci < 0:
                ci = 0
            if ci > 5:
                ci = 5
            confidence = ci
    except Exception:
        confidence = None
    if not isinstance(quiz_id, int):
        return jsonify(error="quiz_id required"), 400
    if not question_id and not isinstance(question_number, int):
        return jsonify(error="question_id or question_number required"), 400
    # This endpoint records the answer itself; confidence adjustments are handled
    # by the /api/quiz/confidence endpoint.
    if not user_answer:
        return jsonify(error="user_answer required"), 400

    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM quizzes WHERE id = %s AND created_by = %s", (quiz_id, user_id))
        row = cur.fetchone()
        if not row:
            return jsonify(error="not found"), 404

        if not question_id:
            cur.execute(
                "SELECT id, correct_answer, is_correct, interval, next_review, topic, COALESCE(correct_streak, 0), COALESCE(max_streak, 0), options, option_counts FROM quiz_questions WHERE quiz_id = %s AND question_number = %s",
                (quiz_id, question_number),
            )
        else:
            cur.execute(
                "SELECT id, correct_answer, is_correct, interval, next_review, topic, COALESCE(correct_streak, 0), COALESCE(max_streak, 0), options, option_counts FROM quiz_questions WHERE id = %s AND quiz_id = %s",
                (question_id, quiz_id),
            )
        qrow = cur.fetchone()
        if not qrow:
            return jsonify(error="question not found"), 404
        qid, correct_answer, prev_is_correct, prev_interval, prev_next_review, topic, prev_streak, prev_max_streak, q_options, q_option_counts = qrow

        score_incremented = False
        is_correct = (user_answer == (correct_answer or "")) if user_answer else False

        # Determine confidence to persist in this update. If incorrect and confidence not
        # provided, store -1; mastery/interval will be handled on the confidence endpoint.
        conf_to_set = confidence
        if conf_to_set is None and is_correct is False:
            conf_to_set = -1
        if conf_to_set is not None:
            cur.execute(
                "UPDATE quiz_questions SET user_answer = %s, is_correct = %s, confidence = %s WHERE id = %s",
                (user_answer or None, is_correct, conf_to_set, qid),
            )
        else:
            cur.execute(
                "UPDATE quiz_questions SET user_answer = %s, is_correct = %s WHERE id = %s",
                (user_answer or None, is_correct, qid),
            )

        # Update option_counts for the selected answer
        try:
            options_list = list(q_options or [])
        except Exception:
            options_list = []
        try:
            counts_list = list(q_option_counts or [])
        except Exception:
            counts_list = []
        if options_list:
            # Ensure counts_list length matches options_list
            if len(counts_list) != len(options_list):
                counts_list = [0] * len(options_list)
            sel_idx = None
            try:
                sel_idx = options_list.index(user_answer)
            except Exception:
                sel_idx = None
            if sel_idx is not None and 0 <= sel_idx < len(counts_list):
                try:
                    counts_list[sel_idx] = int(counts_list[sel_idx] or 0) + 1
                except Exception:
                    counts_list[sel_idx] = 1
                # Persist updated counts
                cur.execute(
                    "UPDATE quiz_questions SET option_counts = %s WHERE id = %s",
                    (counts_list, qid),
                )

        # Update counters: times_seen always; times_correct/correct_streak on correctness
        cur.execute(
            "UPDATE quiz_questions SET times_seen = COALESCE(times_seen,0) + 1 WHERE id = %s",
            (qid,),
        )

        if is_correct and prev_is_correct is not True:
            cur.execute("UPDATE quizzes SET score = COALESCE(score, 0) + 1 WHERE id = %s", (quiz_id,))
            score_incremented = True

        # Spaced repetition bookkeeping for streaks only; mastery/interval are handled
        # on the confidence endpoint.
        if is_correct:
            new_streak = int((prev_streak or 0)) + 1
            try:
                prev_max = int(prev_max_streak or 0)
            except Exception:
                prev_max = 0
            new_max_streak = max(new_streak, prev_max)

            # For correct answers, increment streaks and schedule the next review
            # as NOW() plus 10 minutes times the current streak.
            cur.execute(
                """
                UPDATE quiz_questions
                SET
                  times_correct = COALESCE(times_correct,0) + 1,
                  correct_streak = %s,
                  max_streak = %s,
                  interval = %s,
                  last_reviewed = NOW(),
                  next_review = NOW() + (%s || ' minutes')::interval
                WHERE id = %s
                """,
                (new_streak, new_max_streak, 10 * new_streak, 10 * new_streak, qid),
            )
        else:
            # Incorrect answer: reset streak. If this question has never had a
            # schedule (next_review is NULL), make it immediately due by setting
            # next_review = NOW(). Otherwise, keep the existing next_review so
            # already-scheduled questions retain their timing.
            new_streak = 0
            try:
                prev_max = int(prev_max_streak or 0)
            except Exception:
                prev_max = 0
            new_max_streak = prev_max

            if prev_next_review is None:
                cur.execute(
                    "UPDATE quiz_questions SET correct_streak = %s, max_streak = %s, interval = 1, last_reviewed = NOW(), next_review = NOW() WHERE id = %s",
                    (new_streak, new_max_streak, qid),
                )
            else:
                cur.execute(
                    "UPDATE quiz_questions SET correct_streak = %s, max_streak = %s, interval = 1, last_reviewed = NOW() WHERE id = %s",
                    (new_streak, new_max_streak, qid),
                )

            # Decrease topic difficulty by 0.2 if topic available
            topic_key = (topic or "").strip()
            if topic_key:
                try:
                    cur.execute("SELECT topic_difficulty FROM quizzes WHERE id = %s", (quiz_id,))
                    td_row = cur.fetchone()
                    cur_map = {}
                    if td_row and td_row[0]:
                        try:
                            cur_map = dict(td_row[0]) if isinstance(td_row[0], dict) else json.loads(td_row[0])
                        except Exception:
                            cur_map = {}
                    cur_val = float(cur_map.get(topic_key, 0.0) or 0.0)
                    new_val = cur_val - 0.2
                    cur.execute(
                        "UPDATE quizzes SET topic_difficulty = COALESCE(topic_difficulty, '{}'::jsonb) || jsonb_build_object(%s, %s) WHERE id = %s",
                        (topic_key, new_val, quiz_id),
                    )
                except Exception:
                    pass

        conn.commit()
        cur.close()
        return jsonify(correct=is_correct if is_correct is not None else None, score_incremented=score_incremented), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/quiz/confidence")
def set_quiz_confidence():
    """Update confidence for a quiz question and recompute mastery/interval."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    quiz_id = data.get("quiz_id")
    question_id = data.get("question_id")
    question_number = data.get("question_number")
    raw_conf = data.get("confidence")

    if not isinstance(quiz_id, int):
        return jsonify(error="quiz_id required"), 400
    if not question_id and not isinstance(question_number, int):
        return jsonify(error="question_id or question_number required"), 400

    # Parse confidence if provided, clamp to 0-5. We may still default below.
    confidence = None
    try:
        if raw_conf is not None:
            ci = int(raw_conf)
            if ci < 0:
                ci = 0
            if ci > 5:
                ci = 5
            confidence = ci
    except Exception:
        confidence = None

    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM quizzes WHERE id = %s AND created_by = %s", (quiz_id, user_id))
        row = cur.fetchone()
        if not row:
            return jsonify(error="not found"), 404

        if not question_id:
            cur.execute(
                "SELECT id, is_correct, interval, topic, COALESCE(correct_streak, 0), COALESCE(max_streak, 0), confidence, COALESCE(times_seen, 0), mastery FROM quiz_questions WHERE quiz_id = %s AND question_number = %s",
                (quiz_id, question_number),
            )
        else:
            cur.execute(
                "SELECT id, is_correct, interval, topic, COALESCE(correct_streak, 0), COALESCE(max_streak, 0), confidence, COALESCE(times_seen, 0), mastery FROM quiz_questions WHERE id = %s AND quiz_id = %s",
                (question_id, quiz_id),
            )
        qrow = cur.fetchone()
        if not qrow:
            return jsonify(error="question not found"), 404

        qid, is_correct, prev_interval, topic, prev_streak, prev_max_streak, stored_conf, times_seen, prev_mastery = qrow

        # Require that the question has been answered.
        if is_correct is None:
            return jsonify(error="question has no recorded answer"), 400

        # Determine effective confidence: request -> stored -> default 3.
        effective_conf = None
        if confidence is not None:
            effective_conf = confidence
        elif stored_conf is not None:
            try:
                effective_conf = int(stored_conf)
            except Exception:
                effective_conf = None
        if effective_conf is None:
            effective_conf = 3

        # Compute running average confidence based on times_seen and stored average.
        # confidence column stores the average (0-5); avg_conf_val is the normalized
        # value used in the mastery formula.
        try:
            ts = int(times_seen or 0)
        except Exception:
            ts = 0
        # Start from stored_conf when available, otherwise from the current effective_conf.
        try:
            base_avg = float(stored_conf) if stored_conf is not None else float(effective_conf)
        except Exception:
            base_avg = float(effective_conf)
        if ts > 1:
            # average_conf = max(0, ((ts - 1) * average_conf + confidence) / ts)
            try:
                float_avg_conf = ((ts - 1) * base_avg + float(effective_conf)) / float(ts)
            except Exception:
                float_avg_conf = float(effective_conf)
            try:
                float_avg_conf = max(0.0, float_avg_conf)
            except Exception:
                float_avg_conf = float(effective_conf)
        else:
            try:
                float_avg_conf = max(0.0, float(effective_conf))
            except Exception:
                float_avg_conf = float(effective_conf)

        # Clamp average to [0,5] and persist as integer.
        try:
            float_avg_conf = max(0.0, min(5.0, float_avg_conf))
        except Exception:
            float_avg_conf = float(effective_conf)
        avg_conf_int = int(round(float_avg_conf))

        cur.execute(
            "UPDATE quiz_questions SET confidence = %s WHERE id = %s",
            (avg_conf_int, qid),
        )

        # Recompute mastery using streak, average confidence (0-5), and topic difficulty.
        topic_key = (topic or "").strip()
        avg_conf_val = 0.0
        try:
            avg_conf_val = max(0.0, min(1, (float_avg_conf / 5.0)))
        except Exception:
            avg_conf_val = 0.0

        topic_diff_val = 0.0
        if topic_key:
            try:
                cur.execute("SELECT topic_difficulty FROM quizzes WHERE id = %s", (quiz_id,))
                td_row = cur.fetchone()
                cur_map = {}
                if td_row and td_row[0]:
                    try:
                        cur_map = dict(td_row[0]) if isinstance(td_row[0], dict) else json.loads(td_row[0])
                    except Exception:
                        cur_map = {}
                topic_diff_val = float(cur_map.get(topic_key, 0.0) or 0.0)
                if topic_diff_val == 0.0:
                    cur.execute("SELECT average_difficulty FROM topics WHERE lower(title) = lower(%s)", (topic_key,))
                    trow = cur.fetchone()
                    if trow and trow[0] is not None:
                        topic_diff_val = float(trow[0])
            except Exception:
                topic_diff_val = 0.0

        # If topic difficulty is still unset/zero, start it at 1. Clamp the
        # effective difficulty to a maximum of 5 so it stays in [1,5] when used
        # in the mastery formula.
        if topic_diff_val == 0.0:
            topic_diff_val = 1.0
        try:
            topic_diff_val = min(5.0, float(topic_diff_val))
        except Exception:
            topic_diff_val = 1.0

        new_streak = int(prev_streak or 0)
        try:
            new_max_streak = int(prev_max_streak or 0)
        except Exception:
            new_max_streak = new_streak

        # Start from the existing mastery for this question (or 1.0 if not set)
        try:
            mastery_val = float(prev_mastery) if prev_mastery is not None else 1.0
        except Exception:
            mastery_val = 1.0
        if new_max_streak > 0:
            base_mastery = (
                0.5 * (float(new_streak) / float(new_max_streak))
                + 0.3 * avg_conf_val
                + 0.2 * topic_diff_val
            )
            mastery_val = min(5.0, float(mastery_val + base_mastery))

        cur.execute(
            "UPDATE quiz_questions SET mastery = %s WHERE id = %s",
            (mastery_val, qid),
        )

        # When the question is correct, update per-topic difficulty & aggregates using the
        # existing difficulty formula. Interval scheduling is handled elsewhere.
        if is_correct:
            try:
                # Incrementally increase topic difficulty toward 5 based on
                # confidence. topic_diff_val is already clamped to [1,5]. We
                # treat avg_conf_val in [0,1] as a scale on a small step.
                base_diff = float(topic_diff_val)
                step = 0.3 * float(avg_conf_val)  # max +0.3 per confident correct
                new_diff = base_diff + step
                if new_diff > 5.0:
                    new_diff = 5.0

                if topic_key:
                    cur.execute(
                        "UPDATE quizzes SET topic_difficulty = COALESCE(topic_difficulty, '{}'::jsonb) || jsonb_build_object(%s, %s) WHERE id = %s",
                        (topic_key, new_diff, quiz_id),
                    )
                    cur.execute(
                        """
                        UPDATE topics
                        SET
                          difficulty_sum = COALESCE(difficulty_sum, 0) + %s,
                          difficulty_count = COALESCE(difficulty_count, 0) + 1,
                          average_difficulty = (COALESCE(difficulty_sum, 0) + %s) / (COALESCE(difficulty_count, 0) + 1)
                        WHERE lower(title) = lower(%s)
                        """,
                        (new_diff, new_diff, topic_key),
                    )
            except Exception:
                pass

        conn.commit()
        cur.close()
        return jsonify(success=True, confidence=effective_conf, mastery=mastery_val), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/quizzes/<int:qzid>/reset")
def reset_quiz(qzid: int):
    """Reset quiz score to 0 without changing its questions.

    This is used when the user presses "Retry Quiz". We only reset the
    aggregate score so that the follow-up GET /api/quizzes/<id> can decide
    whether to reuse existing due questions (next_review <= NOW()) and, if
    there are fewer than original_count due, top up with new questions.
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM quizzes WHERE id = %s AND created_by = %s", (qzid, user_id))
        if cur.fetchone() is None:
            return jsonify(error="not found"), 404
        cur.execute("UPDATE quizzes SET score = 0 WHERE id = %s", (qzid,))
        conn.commit()
        cur.close()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


# ============================================================================
# ROUTES - STUDY GUIDES
# ============================================================================

@app.post("/api/study_guide")
def study_guide_endpoint():
    """Generate a study guide from text."""
    data = request.get_json(silent=True) or {}
    txt = (data.get("text") or "").strip()
    if not txt:
        return jsonify(error="Missing text"), 400
    if estimate_tokens(txt) < 60:
        return jsonify(error="Input is too short for a useful study guide. Provide a longer summary or notes."), 400
    guide = generate_study_guide(txt)
    if not guide:
        return jsonify(error="study guide generation failed"), 500
    return jsonify(guide=guide), 200


@app.post("/api/study_guides")
def create_study_guide():
    """Create a study guide for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "Study Guide").strip() or "Study Guide"
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify(error="content is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO study_guides (user_id, title, content)
            VALUES (%s, %s, %s)
            RETURNING id, created_at
            """,
            (user_id, title, content),
        )
        gid, created_at = cur.fetchone()
        conn.commit()
        cur.close()
        return jsonify(id=gid, title=title, created_at=(created_at.isoformat() if created_at else None)), 201
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/plan_from_topics")
def create_plan_from_topics():
    """Generate a focused study guide and quiz from a list of topics.

    Expects JSON body:
      {
        "course_id": optional int,
        "course_name": optional string,
        "topics": [
          {"title": string, ...} | string,
          ...
        ]
      }

    Returns 201 with:
      {
        "study_guide": {"id", "title"},
        "quiz": {"id", "title"}
      }
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401

    data = request.get_json(silent=True) or {}
    course_id = data.get("course_id")
    course_name = (data.get("course_name") or "This course").strip() or "This course"
    raw_topics = data.get("topics")

    topic_names: list[str] = []
    if isinstance(raw_topics, list):
        for it in raw_topics:
            name = None
            if isinstance(it, dict):
                name = (it.get("title") or it.get("name") or "").strip()
            else:
                name = str(it or "").strip()
            if name:
                topic_names.append(name)
    # De-duplicate while preserving order
    seen = set()
    deduped: list[str] = []
    for t in topic_names:
        key = t.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(t)
    topic_names = deduped

    if not topic_names:
        return jsonify(error="topics list is required"), 400

    # Build a compact synthetic text describing just these topics for guide/quiz generation.
    bullets = "\n".join(f"- {t}" for t in topic_names)
    base_text = (
        f"You are creating study materials for the course '{course_name}'.\n"
        "Focus ONLY on the following topics and subtopics, and ignore everything else.\n\n"
        f"Topics to cover (each with clear explanations, key formulas/facts, and brief examples):\n{bullets}\n"
    )

    # 1) Generate study guide content from topics
    try:
        guide_content = generate_study_guide(base_text)
    except Exception as e:
        return jsonify(error=f"study guide generation failed: {e}"), 500
    guide_content = (guide_content or "").strip()
    if not guide_content:
        return jsonify(error="study guide generation returned empty content"), 500

    # Ensure we have enough text for quiz generation; if not, fall back to base_text.
    quiz_source = guide_content
    if estimate_tokens(quiz_source) < 60:
        quiz_source = base_text

    # Decide a small but non-trivial quiz size.
    count = 10

    try:
        questions = generate_quiz_with_gemini(quiz_source, count, topic_names)
    except Exception as e:
        return jsonify(error=f"quiz generation failed: {e}"), 500
    if not questions:
        return jsonify(error="quiz generation returned no valid questions"), 500

    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500

    try:
        cur = conn.cursor()

        # Create study guide row
        sg_title = f"{course_name} Study Guide"
        cur.execute(
            """
            INSERT INTO study_guides (user_id, title, content)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (user_id, sg_title, guide_content),
        )
        sg_id = cur.fetchone()[0]

        # Create quiz row
        q_title = f"{course_name} Quiz"
        try:
            course_id_int = int(course_id) if course_id is not None else None
        except Exception:
            course_id_int = None

        cur.execute(
            """
            INSERT INTO quizzes (topics, created_by, score, original_count, source_summary, course_id, title)
            VALUES (%s, %s, 0, %s, %s, %s, %s)
            RETURNING id
            """,
            (topic_names, user_id, count, quiz_source, course_id_int, q_title),
        )
        quiz_id = cur.fetchone()[0]

        # Insert quiz questions, assigning topics when present
        for i, q in enumerate(questions[:count], start=1):
            question = q.get("question")
            options = q.get("options") or []
            ci = q.get("correctIndex")
            try:
                correct_answer = options[ci] if isinstance(ci, int) and 0 <= ci < len(options) else None
            except Exception:
                correct_answer = None
            if not question or correct_answer is None:
                continue
            raw_topic = q.get("topic")
            try:
                assigned_topic = (str(raw_topic).strip() or None) if raw_topic is not None else None
            except Exception:
                assigned_topic = None
            cur.execute(
                """
                INSERT INTO quiz_questions (quiz_id, question_number, question, options, correct_answer, user_answer, is_correct, topic)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (quiz_id, i, question, options, correct_answer, None, None, assigned_topic),
            )

        conn.commit()
        cur.close()
        return (
            jsonify(
                study_guide={"id": sg_id, "title": sg_title},
                quiz={"id": quiz_id, "title": q_title},
            ),
            201,
        )
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.delete("/api/study_guides/<int:gid>")
def delete_study_guide(gid: int):
    """Delete a study guide."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM study_guides WHERE id = %s AND user_id = %s", (gid, user_id))
        if cur.rowcount == 0:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        cur.close()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/study_guides/<int:gid>")
def get_study_guide(gid: int):
    """Fetch a single study guide for current user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, title, content FROM study_guides WHERE id = %s AND user_id = %s", (gid, user_id))
        row = cur.fetchone()
        cur.close()
        if not row:
            return jsonify(error="not found"), 404
        return jsonify(id=row[0], title=row[1], content=row[2])
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.patch("/api/study_guides/<int:gid>")
def rename_study_guide(gid: int):
    """Rename a study guide title."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify(error="title is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("UPDATE study_guides SET title = %s WHERE id = %s AND user_id = %s", (title, gid, user_id))
        if cur.rowcount == 0:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        cur.close()
        return jsonify(id=gid, title=title), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


# ============================================================================
# ROUTES - SUMMARIES
# ============================================================================

@app.post("/api/summaries")
def create_summary():
    """Create a summary for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    topics = data.get("topics")
    course_id = data.get("course_id")
    try:
        course_id = int(course_id) if course_id is not None else None
    except Exception:
        course_id = None
    if isinstance(topics, list):
        try:
            topics = [str(t).strip() for t in topics if str(t).strip()]
        except Exception:
            topics = []
    else:
        topics = []
    if not content:
        return jsonify(error="content is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # If no title provided, compute a default like "Summary #<next>" for this user
        if not title:
            try:
                cur.execute("SELECT COALESCE(MAX(id), 0) FROM summaries WHERE user_id = %s", (user_id,))
                max_id = cur.fetchone()[0] or 0
                title = f"Summary #{max_id + 1}"
            except Exception:
                title = "Summary"
        cur.execute(
            """
            INSERT INTO summaries (user_id, title, content, topics, course_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, created_at
            """,
            (user_id, title, content, topics, course_id),
        )
        sid, created_at = cur.fetchone()
        # If a course is selected, upsert topics into the topics table (avoid duplicates by title per course)
        if course_id and isinstance(topics, list) and len(topics) > 0:
            for t in topics:
                try:
                    tt = str(t).strip()
                except Exception:
                    continue
                if not tt:
                    continue
                cur.execute(
                    "SELECT 1 FROM topics WHERE course_id = %s AND LOWER(title) = LOWER(%s) LIMIT 1",
                    (course_id, tt),
                )
                exists = cur.fetchone() is not None
                if not exists:
                    cur.execute(
                        "INSERT INTO topics (course_id, title, description) VALUES (%s, %s, %s)",
                        (course_id, tt, ""),
                    )
        conn.commit()
        cur.close()
        return jsonify(id=sid, title=title, created_at=(created_at.isoformat() if created_at else None), topics=topics, course_id=course_id), 201
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.delete("/api/summaries/<int:sid>")
def delete_summary(sid: int):
    """Delete a summary owned by the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM summaries WHERE id = %s AND user_id = %s RETURNING id", (sid, user_id))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/all_summaries")
def list_all_summaries():
    """List ALL summaries for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, title, course_id, created_at
            FROM summaries
            WHERE user_id = %s
            ORDER BY created_at DESC NULLS LAST, id DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
        items = [
            {
                "id": r[0],
                "title": r[1],
                "topics": [],
                "course_id": r[2],
                "created_at": (r[3].isoformat() if r[3] else None),
            }
            for r in rows
        ]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/summaries/<int:sid>")
def get_summary(sid: int):
    """Fetch a single summary (title, content) for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, title, content, topics, course_id, created_at FROM summaries WHERE id = %s AND user_id = %s",
            (sid, user_id),
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return jsonify(error="not found"), 404
        return jsonify(
            id=row[0],
            title=row[1],
            content=row[2],
            topics=(row[3] or []),
            course_id=row[4],
            created_at=(row[5].isoformat() if row[5] else None)
        ), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.patch("/api/summaries/<int:sid>")
def rename_summary(sid: int):
    """Rename a summary's title owned by the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify(error="title is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("UPDATE summaries SET title = %s WHERE id = %s AND user_id = %s RETURNING id", (title, sid, user_id))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        return jsonify(id=sid, title=title), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


# ============================================================================
# ROUTES - DASHBOARD
# ============================================================================

@app.get("/api/dashboard/notes")
def dashboard_notes():
    """List recent notes for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, title, course_id, topics, updated_at
            FROM notes
            WHERE user_id = %s
            ORDER BY updated_at DESC NULLS LAST, id DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
        items = [
            {
                "id": r[0],
                "title": r[1],
                "course_id": r[2],
                "topics": (r[3] or []),
                "updated_at": (r[4].isoformat() if r[4] else None),
            }
            for r in rows
        ]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/dashboard/quizzes")
def dashboard_quizzes():
    """List recent quizzes for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              q.id,
              q.created_at,
              COALESCE(q.score, 0) AS score,
              COUNT(qq.id) AS question_count,
              SUM(CASE WHEN COALESCE(NULLIF(qq.user_answer, ''), NULL) IS NOT NULL THEN 1 ELSE 0 END) AS answered_count,
              q.title,
              q.course_id,
              q.topics
            FROM quizzes q
            LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
            -- TEMP: show all quizzes regardless of user
            WHERE 1 = 1
            GROUP BY q.id
            ORDER BY q.created_at DESC NULLS LAST, q.id DESC
            """
        )
        rows = cur.fetchall()
        cur.close()
        items = []
        for r in rows:
            qid = r[0]
            created_at = r[1]
            score = r[2]
            question_count = r[3] or 0
            answered_count = r[4] or 0
            title = r[5]
            course_id = r[6]
            topics = r[7] or []
            completed = (question_count > 0 and answered_count >= question_count)
            items.append({
                "id": qid,
                "created_at": (created_at.isoformat() if created_at else None),
                "score": score,
                "question_count": question_count,
                "answered_count": answered_count,
                "title": title,
                "completed": completed,
                "course_id": course_id,
                "topics": topics,
            })
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/dashboard/study_guides")
def dashboard_study_guides():
    """Return up to 5 most recent study guides for current user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, title, course_id
            FROM study_guides
            WHERE user_id = %s
            ORDER BY id DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
        items = [{"id": r[0], "title": r[1], "course_id": r[2]} for r in rows]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


# ============================================================================
# ROUTES - UPLOAD & FILE PROCESSING
# ============================================================================

@app.post("/api/upload")
def upload():
    """Process uploaded files (PDF, images, text) and return extracted text and summary."""
    try:
        if "file" not in request.files:
            return jsonify(error="No 'file' part in form"), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify(error="No selected file"), 400
        filename = secure_filename(file.filename)
        mimetype = file.mimetype or "application/octet-stream"
        file_bytes = file.read()
        size = len(file_bytes)

        extracted_text = ""
        kind = "other"
        if mimetype == "application/pdf" or filename.lower().endswith(".pdf"):
            kind = "pdf"
            precomputed_summary: str | None = None
            sections, _delineated = extract_sections_by_bookmarks(file_bytes)
            if sections:
                summaries: list[str] = []
                for title, body in sections:
                    sec_sum = summarize_text(body)
                    if not sec_sum.strip():
                        sec_sum = body[:1200]
                    summaries.append(f"## {title}\n\n{sanitize_summary(sec_sum)}")
                precomputed_summary = "\n\n".join(summaries)
                extracted_text = "\n\n".join([b for _, b in sections])
            else:
                extracted_text = extract_pdf_text(file_bytes)
        elif mimetype.startswith("image/") or filename.lower().endswith((".png", ".jpg", ".jpeg")):
            kind = "image"
            try:
                extracted_text, conf = vision_ocr_from_images(file_bytes)
            except Exception:
                conf, extracted_text = 0.0, ""
            extracted_text = (extracted_text or "").strip()
            if (not extracted_text) or conf < 0.6 or ocr_quality_score(extracted_text) < 0.3:
                return jsonify(error="OCR extraction quality too low. Try a higher-resolution image or clearer scan."), 400
            # Clean OCR text for readability
            extracted_text = format_readable_text(clean_text_with_gemini(extracted_text))
        elif mimetype == "text/plain" or filename.lower().endswith(".txt"):
            kind = "text"
            extracted_text = file_bytes.decode("utf-8", errors="ignore")
            extracted_text = format_readable_text(clean_text_with_gemini(extracted_text))
        else:
            try:
                extracted_text = file_bytes.decode("utf-8", errors="ignore")
                extracted_text = format_readable_text(clean_text_with_gemini(extracted_text))
            except Exception:
                extracted_text = ""

        if not extracted_text or not extracted_text.strip():
            return jsonify(error="No text could be extracted from the file"), 400

        summary = precomputed_summary if (kind == "pdf" and 'precomputed_summary' in locals() and precomputed_summary) else summarize_text(extracted_text)
        base_for_topics = extracted_text if extracted_text else summary
        topics = generate_topics_from_text(base_for_topics, count=10)
        return jsonify(
            filename=filename,
            mimetype=mimetype,
            size=size,
            kind=kind,
            summary=summary,
            topics=topics,
            extracted_text=extracted_text,
        ), 200
    except Exception as e:
        msg = str(e)
        if "file too large to be summarized." in msg:
            return jsonify(error="file too large to be summarized."), 400
        return jsonify(error=msg), 500


# ============================================================================
# ROUTES - UTILITY
# ============================================================================

@app.post("/api/client-log")
def client_log():
    """Client log sink (to surface frontend logs in server terminal)."""
    try:
        data = request.get_json(silent=True) or {}
        level = (data.get("level") or "info").upper()
        msg = str(data.get("message") or "").strip()
        ctx = data.get("context")
        print(f"[CLIENT-{level}] {msg} | context={ctx}", flush=True)
        return ("", 204)
    except Exception as e:
        print("[CLIENT-LOG ERROR]", e, flush=True)
        return ("", 204)


@app.route("/api/ping")
def ping():
    """Simple test route."""
    return jsonify({"message": "Flask backend is running"})


# ============================================================================
# ROUTES - CHAT THREADS (Cloud persistence)
# ============================================================================

@app.get("/api/chat_threads")
def list_chat_threads():
    """List chat threads for the current user (most recent first)."""
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, title, created_at, updated_at
            FROM chat_threads
            WHERE user_id = %s
            ORDER BY updated_at DESC NULLS LAST, id DESC
            """,
            (uid,),
        )
        rows = cur.fetchall()
        items = [
            {
                "id": r[0],
                "title": r[1],
                "created_at": (r[2].isoformat() if r[2] else None),
                "updated_at": (r[3].isoformat() if r[3] else None),
            }
            for r in rows
        ]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/chat_threads")
def create_chat_thread():
    """Create a new chat thread for current user."""
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "New Chat").strip() or "New Chat"
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO chat_threads (user_id, title)
            VALUES (%s, %s)
            RETURNING id, created_at, updated_at
            """,
            (uid, title),
        )
        row = cur.fetchone()
        conn.commit()
        return (
            jsonify(
                id=row[0],
                title=title,
                created_at=(row[1].isoformat() if row[1] else None),
                updated_at=(row[2].isoformat() if row[2] else None),
            ),
            201,
        )
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/api/chat_threads/<int:tid>")
def get_chat_thread(tid: int):
    """Return a chat thread with its messages for current user."""
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, title, created_at, updated_at FROM chat_threads WHERE id = %s AND user_id = %s",
            (tid, uid),
        )
        t = cur.fetchone()
        if not t:
            return jsonify(error="not found"), 404
        cur.execute(
            """
            SELECT id, role, content, created_at
            FROM chat_messages
            WHERE thread_id = %s
            ORDER BY id ASC
            """,
            (tid,),
        )
        msgs = cur.fetchall()
        return (
            jsonify(
                id=t[0],
                title=t[1],
                created_at=(t[2].isoformat() if t[2] else None),
                updated_at=(t[3].isoformat() if t[3] else None),
                messages=[
                    {
                        "id": m[0],
                        "role": m[1],
                        "content": m[2],
                        "created_at": (m[3].isoformat() if m[3] else None),
                    }
                    for m in msgs
                ],
            ),
            200,
        )
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.patch("/api/chat_threads/<int:tid>")
def rename_chat_thread(tid: int):
    """Rename a chat thread."""
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "New Chat").strip() or "New Chat"
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE chat_threads
            SET title = %s, updated_at = NOW()
            WHERE id = %s AND user_id = %s
            RETURNING id, created_at, updated_at
            """,
            (title, tid, uid),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        return (
            jsonify(
                id=row[0],
                title=title,
                created_at=(row[1].isoformat() if row[1] else None),
                updated_at=(row[2].isoformat() if row[2] else None),
            ),
            200,
        )
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.delete("/api/chat_threads/<int:tid>")
def delete_chat_thread(tid: int):
    """Delete a chat thread for current user."""
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM chat_threads WHERE id = %s AND user_id = %s", (tid, uid))
        if cur.rowcount == 0:
            conn.rollback()
            return jsonify(error="not found"), 404
        conn.commit()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/chat_threads/<int:tid>/messages")
def append_chat_message(tid: int):
    """Append a chat message to a thread (user or assistant)."""
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    role = str(data.get("role") or "").strip()
    content = str(data.get("content") or "").strip()
    if role not in ("system", "user", "assistant"):
        return jsonify(error="invalid role"), 400
    if not content:
        return jsonify(error="empty content"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # ensure thread belongs to user
        cur.execute("SELECT 1 FROM chat_threads WHERE id = %s AND user_id = %s", (tid, uid))
        if not cur.fetchone():
            return jsonify(error="not found"), 404
        cur.execute(
            """
            INSERT INTO chat_messages (thread_id, role, content)
            VALUES (%s, %s, %s)
            RETURNING id, created_at
            """,
            (tid, role, content),
        )
        mid, created_at = cur.fetchone()
        # bump updated_at on thread
        cur.execute("UPDATE chat_threads SET updated_at = NOW() WHERE id = %s", (tid,))
        conn.commit()
        return (
            jsonify(id=mid, role=role, content=content, created_at=(created_at.isoformat() if created_at else None)),
            201,
        )
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/chat")
def chat_endpoint():
    """Simple chat endpoint that takes messages and returns a single assistant reply.
    Expects body: { messages: [{ role: 'user'|'assistant', content: string }], meta?: any }
    Returns: { message: { role: 'assistant', content: string } }
    """
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401

    data = request.get_json(silent=True) or {}
    msgs = data.get("messages") or []
    meta = data.get("meta") or {}
    # Use the latest user message for now
    content = ""
    for m in (msgs if isinstance(msgs, list) else []):
        try:
            if isinstance(m, dict) and (m.get("role") == "user"):
                content = str(m.get("content") or "").strip()
        except Exception:
            continue
    if not content:
        return jsonify(error="empty message"), 400

    try:
        # Build style instructions from meta flags
        instructions: list[str] = []
        if isinstance(meta, dict) and meta.get("explainLike5"):
            instructions.append(
                "Explain as if to a 5-year-old. Use simple words, short sentences, concrete everyday examples, and avoid jargon."
            )
        if isinstance(meta, dict) and meta.get("detailed"):
            instructions.append(
                "Be detailed and step-by-step. Provide clear reasoning, structure, and cover important caveats."
            )
        if isinstance(meta, dict) and meta.get("tutorNoAnswer"):
            instructions.append(
                "Act as a Socratic tutor. Do not provide the final answer. Ask guiding questions and give incremental hints to help the learner reach the solution."
            )

        style_prefix = ("\n".join(instructions).strip() + "\n\n") if instructions else ""
        prompt = f"{style_prefix}{content}"

        resp = gemini_client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )
        text = (getattr(resp, "text", None) or "").strip()
        if not text:
            text = "I'm sorry, I couldn't generate a response. Please try again."
        return jsonify(message={"role": "assistant", "content": text}), 200
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.get("/api/session")
def get_session_user():
    """Return current Flask session user or 401."""
    uid = session.get("user_id")
    uname = session.get("username")
    if not uid:
        return jsonify(error="unauthorized"), 401
    return jsonify(user_id=uid, username=uname), 200


@app.get("/api/resources")
def list_saved_resources():
    """Return saved learning resources for the current user.

    This backs the "Saved" view on the Learning Resources page.
    """
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, title, description, type, url
            FROM saved_resources
            WHERE user_id = %s
            ORDER BY id DESC
            """,
            (uid,),
        )
        rows = cur.fetchall()
        items = [
            {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "type": row[3],
                "url": row[4],
            }
            for row in rows
        ]
        return jsonify(items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.post("/api/resources")
def create_saved_resource():
    """Save a learning resource for the current user.

    Expects JSON: { title, description, type, url }.
    """
    uid = session.get("user_id")
    if not uid:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "").strip()
    url = str(data.get("url") or "").strip()
    if not title or not url:
        return jsonify(error="missing title or url"), 400
    description = str(data.get("description") or "User-saved learning resource.").strip()
    rtype = str(data.get("type") or "AI Resource").strip()
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO saved_resources (user_id, title, description, type, url)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (uid, title, description, rtype, url),
        )
        rid = cur.fetchone()[0]
        conn.commit()
        return (
            jsonify(id=rid, title=title, description=description, type=rtype, url=url),
            201,
        )
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()


@app.get("/resources/ai")
@app.get("/api/resources/ai")
def get_ai_resources():
    """Return AI-suggested learning resources generated by Gemini.

    Optionally accepts a `topic` query parameter to focus suggestions.
    Frontend expects either an array or an object with an `items` array; we
    return a plain array of { id, title, description, type, url } objects.
    """
    topic = (request.args.get("topic") or "study skills for students").strip()

    prompt = (
        "You are LearnNova, a study assistant. Suggest 3-6 high-quality online resources "
        "(videos, articles, PDFs, or websites) that can help a student with the following topic: "
        f"'{topic}'.\n\n"
        "Return ONLY JSON. The JSON should be an array of objects with this exact shape: "
        "[{\n  \"title\": string,\n  \"description\": string,\n  \"type\": one of [\"Video\", \"Article\", \"PDF\", \"Website\"],\n  \"url\": string\n}].\n"
        "Do not include any extra commentary or text outside the JSON array."
    )

    try:
        resp = gemini_client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )
        raw = (getattr(resp, "text", None) or "").strip()
        data = parse_json_lenient(raw) or []
        if isinstance(data, dict):
            items = data.get("items") or []
        else:
            items = data

        if not isinstance(items, list):
            items = []

        out: list[dict] = []
        for idx, item in enumerate(items):
            try:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()
                url = str(item.get("url") or "").strip()
                if not title or not url:
                    continue
                description = str(item.get("description") or "Suggested by LearnNova AI.").strip()
                itype = str(item.get("type") or "AI Resource").strip()
                # Map arbitrary type strings into our allowed set
                normalized = itype.lower()
                if "video" in normalized:
                    rtype = "Video"
                elif "pdf" in normalized:
                    rtype = "PDF"
                elif "article" in normalized or "blog" in normalized:
                    rtype = "Article"
                elif "site" in normalized or "web" in normalized or "page" in normalized:
                    rtype = "Website"
                else:
                    rtype = "AI Resource"

                out.append(
                    {
                        "id": f"ai-{int(time.time())}-{idx}",
                        "title": title,
                        "description": description,
                        "type": rtype,
                        "url": url,
                    }
                )
            except Exception:
                continue

        # Fallback: if Gemini fails or returns nothing, return an empty list
        return jsonify(out), 200
    except Exception as e:
        # On error, return empty array so UI doesn't break (can be enhanced with toasts later)
        print("/resources/ai error:", e, flush=True)
        return jsonify([]), 200


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    """Error handler for frontend routes."""
    return jsonify({"error": f"Not Found - {e}"}), 404


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)