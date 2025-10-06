"""
Stellar Study Buddy API
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from openai import OpenAI
from google.cloud import vision
import os
import io
from PIL import Image
import time
import pdfplumber
from pdf2image import convert_from_bytes
from PyPDF2 import PdfReader

app = Flask(__name__)

# Load environment and enable CORS for local dev
load_dotenv()
CORS(app)

# Initialize API clients
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
vision_client = vision.ImageAnnotatorClient()


def extract_pdf_text_and_tables(file_bytes: bytes) -> tuple[str, list[list[list[str]]]]:
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


def ocr_quality_score(text: str) -> float:
    """Heuristic 0..1 estimate of OCR quality from plain text.
    Considers: alphanumeric ratio, avg words/line, short-line ratio, unique word ratio.
    """
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
    # Weighted score
    score = 0.45 * alnum_ratio + 0.35 * min(1.0, avg_words_line / 6.0) + 0.20 * uniq_ratio - 0.20 * short_ratio
    # Clamp 0..1
    return max(0.0, min(1.0, score))

def vision_ocr_from_images(images: list[Image.Image] | bytes) -> tuple[str, float]:
    """Run Google Vision DOCUMENT_TEXT_DETECTION on one or multiple images.
    Returns (full_text, avg_word_confidence 0..1).
    """
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
    for content in contents:
        try:
            vimg = vision.Image(content=content)
            resp = vision_client.document_text_detection(image=vimg)
            if resp.error.message:
                continue
            # Collect text
            txt = getattr(resp.full_text_annotation, "text", "") or ""
            if txt:
                texts.append(txt)
            # Collect word-level confidences where available
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

def get_pdf_outlines(file_bytes: bytes) -> list[tuple[str, int]]:
    """Return flat list of (title, page_index) from PDF outlines/bookmarks (levels <= 1)."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        outlines = getattr(reader, "outlines", None) or getattr(reader, "outline", None)
        results: list[tuple[str, int, int]] = []

        # Build mapping from page objects to their indices
        page_map = {getattr(p, "indirect_reference", None): i for i, p in enumerate(reader.pages)}

        def _walk(items, level=0):
            for it in items:
                if isinstance(it, list):
                    _walk(it, level + 1)
                    continue
                # Title
                title = getattr(it, "title", None) or it.get("/Title", "Untitled")
                # Destination / Page
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
                # Find page index
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

        if outlines:
            _walk(outlines)

        # filter levels <= 1
        results = [r for r in results if r[2] <= 1]
        results.sort(key=lambda x: x[1])

        # deduplicate
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
    """Return list of (title, text) sections and a delineated string from bookmarks."""
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
    """Extract PDF text using both structured parsing and Vision OCR, then pick the better result.
    Structured parsing first (pdfplumber), then Vision OCR at higher DPI; choose by confidence/quality.
    """
    # 1) Structured parse
    structured_text, _ = extract_pdf_text_and_tables(file_bytes)
    structured_text = (structured_text or "").strip()
    score_struct = ocr_quality_score(structured_text)

    # 2) Vision OCR (always attempt so we can compare quality)
    vision_text = ""
    conf = 0.0
    try:
        pages = convert_from_bytes(file_bytes, dpi=300)
        vision_text, conf = vision_ocr_from_images(pages)
    except Exception:
        vision_text, conf = "", 0.0
    vision_text = (vision_text or "").strip()
    score_vision = ocr_quality_score(vision_text)

    # 3) Decide best
    # Prefer Vision if confidence is decent or quality beats structured by a margin
    prefer_vision = (conf >= 0.55) or (score_vision >= score_struct + 0.05)

    chosen = vision_text if prefer_vision else structured_text
    return chosen

def estimate_tokens(s: str) -> int:
        # Rough heuristic: ~4 characters per token
        return max(1, int(len(s) / 4))

def split_by_tokens(s: str, max_tokens: int) -> list[str]:
    # Split on paragraph boundaries first, then join until size ~ max_tokens
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

def sanitize_summary(s: str) -> str:
    """Remove meta commentary/offers from model output."""
    if not s:
        return s
    banned = [
        "if you'd like",
        "i can turn this",
        "would you like",
        "let me know",
        "i can ",
        "we can ",
        "contact",
        "reach out",
        "tailor it",
        "practice exam",
        "one-page study sheet",
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

def summarize_once(content: str, system_msg: str = "You are a helpful assistant that writes succinct study notes.", model: str = "gpt-5-nano") -> str:
    prompt = (
        "Summarize the following content into clear, concise bullet points. "
        "If the content contains sections, delineate your summary with section headers. "
        "Focus on the main ideas. Do not include meta commentary, offers, or follow-ups. "
        "Output only the summary.\n\nCONTENT:\n" + content
    )
    # Retry with exponential backoff for 429s
    for _ in range(3):
        try:
            resp = openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt},
                ],
            )
            out = (resp.choices[0].message.content if resp.choices else "").strip()
            if out:
                return sanitize_summary(out)
            # If empty or stopped by length, try stricter prompt and lower cap
            strict_prompt = (
                "Output exactly 5 concise bullet points summarizing the content. "
                "No intro or outro, bullets only. "
                "No meta commentary or offers.\n\nCONTENT:\n" + content
            )
            # Try nano strict
            try:
                resp2 = openai_client.chat.completions.create(
                    model="gpt-5-nano",
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": strict_prompt},
                    ],
                    max_completion_tokens=200,
                )
                out2 = (resp2.choices[0].message.content if resp2.choices else "").strip()
                if out2:
                    return sanitize_summary(out2)
            except Exception:
                pass
            # Try mini strict
            try:
                resp3 = openai_client.chat.completions.create(
                    model="gpt-5-mini",
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": strict_prompt},
                    ],
                    max_completion_tokens=200,
                )
                out3 = (resp3.choices[0].message.content if resp3.choices else "").strip()
                if out3:
                    return sanitize_summary(out3)
            except Exception:
                pass
            # Fallback excerpt
            return content[:1200]
        except Exception as e:
            print(f"Summarize once error: {e}")
            raise
    return content[:1200]

def summarize_text(text: str) -> str:
    """Summarize using OpenAI gpt-5-nano with chunking when input is very large.
    into chunks, summarize each, then summarize the combined summaries.
    """

    txt = (text or "").strip()
    if not txt:
        return ""

    try:
        total_tokens = estimate_tokens(txt)
        # If over 200k tokens, split into ~10k-token chunks for safety
        if total_tokens > 200000:
            chunks = split_by_tokens(txt, max_tokens=10000)
            partial_summaries: list[str] = []
            for idx, ch in enumerate(chunks, 1):
                try:
                    # Try nano, then mini
                    try:
                        partial = summarize_once(ch, model="gpt-5-nano")
                    except Exception:
                        partial = summarize_once(ch, model="gpt-5-mini")
                except Exception as e:
                    print(f"chunk {idx} summarize error: {e}")
                    raise RuntimeError("file too large to be summarized.")
                partial_summaries.append(partial)
                # Throttle to respect TPM
                time.sleep(1)
            combined = "\n\n".join(partial_summaries)
            # Final pass on combined partials (much smaller than original)
            try:
                # Try nano, then mini
                try:
                    return summarize_once(combined, system_msg="You write concise combined summaries of bullet-point notes.", model="gpt-5-nano")
                except Exception:
                    return summarize_once(combined, system_msg="You write concise combined summaries of bullet-point notes.", model="gpt-5-mini")
            except Exception as e:
                print(f"final summarize error: {e}")
                raise RuntimeError("file too large to be summarized.")
        else:
            # Single-shot summarize
            try:
                return summarize_once(txt, model="gpt-5-nano")
            except Exception:
                try:
                    return summarize_once(txt, model="gpt-5-mini")
                except Exception:
                    raise RuntimeError("file too large to be summarized.")
    except Exception as e:
        print(e)
        return txt[:1200]

@app.post("/api/upload")
def upload():
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
            # Try to use PDF bookmarks/outlines to delineate sections
            sections, _delineated = extract_sections_by_bookmarks(file_bytes)
            if sections:
                # Summarize each section independently, then combine
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
            # Check quality for images too (prefer Vision confidence)
            if (not extracted_text) or conf < 0.6 or ocr_quality_score(extracted_text) < 0.3:
                return jsonify(error="OCR extraction quality too low. Try a higher-resolution image or clearer scan."), 400
        elif mimetype == "text/plain" or filename.lower().endswith(".txt"):
            kind = "text"
            extracted_text = file_bytes.decode("utf-8", errors="ignore")
        else:
            # best-effort
            try:
                extracted_text = file_bytes.decode("utf-8", errors="ignore")
            except Exception:
                extracted_text = ""

        if not extracted_text or not extracted_text.strip():
            return jsonify(error="No text could be extracted from the file"), 400

        # If we already summarized by sections, reuse it; otherwise summarize the full text
        summary = precomputed_summary if (kind == "pdf" and 'precomputed_summary' in locals() and precomputed_summary) else summarize_text(extracted_text)
        return jsonify(
            filename=filename,
            mimetype=mimetype,
            size=size,
            kind=kind,
            summary=summary,
        ), 200
    except Exception as e:
        # If summarization indicates size issue, return a 400 with message
        msg = str(e)
        if "file too large to be summarized." in msg:
            return jsonify(error="file too large to be summarized."), 400
        return jsonify(error=msg), 500