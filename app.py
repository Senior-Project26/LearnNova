from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from google import genai
from google.cloud import vision
import psycopg2
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
import os
import io
import json
import re
from PIL import Image
import time
import pdfplumber
from pdf2image import convert_from_bytes
from PyPDF2 import PdfReader

# ----------------------------
# Flask App Setup
# ----------------------------
app = Flask(__name__)
CORS(app, supports_credentials=True)

# Load environment for local dev
load_dotenv()
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,
)

# Initialize API clients (Study Buddy)
vision_client = vision.ImageAnnotatorClient()
gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# ----------------------------
# Firebase Admin Setup
# ----------------------------
try:
    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)
    print("Firebase Admin connected")
except Exception as e:
    print(f"Firebase Admin connection failed: {e}")

# ----------------------------
# Database Connection
# ----------------------------
def get_connection():
    try:
        return psycopg2.connect(
            host="localhost",
            database="learnnova",
            user="postgres",
            password=os.getenv("POSTGRES_PASSWORD", "")
        )
    except Exception as e:
        print("Database connection failed:", e, flush=True)
        return None

# ----------------------------
# Routes
# ----------------------------

@app.route("/api/ping")
def ping():
    """Simple test route"""
    return jsonify({"message": "Flask backend is running"})

@app.route("/api/signup", methods=["POST"])
def signup():
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

@app.route("/api/login", methods=["POST"])
def login():
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
    session.clear()
    return jsonify({"message": "Logged out successfully"})

# Firebase login verification (for Google sign-in)
@app.route("/api/firebase-login", methods=["POST"])
def firebase_login():
    data = request.get_json()
    token = data.get("idToken")
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        user_email = decoded_token.get("email")
        user_name = decoded_token.get("name", "NoName")
        # Upsert user in Postgres and set Flask session
        if not user_email:
            return jsonify({"error": "email missing from firebase token"}), 400

        conn = get_connection()
        if not conn:
            return jsonify({"error": "Database connection error"}), 500
        cur = conn.cursor()
        try:
            cur.execute('SELECT id, username FROM users WHERE email = %s', (user_email,))
            row = cur.fetchone()
            if row:
                user_id, username = row
            else:
                # Derive a simple username if name missing
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

# ----------------------------
# Error Handler for Frontend Routes
# ----------------------------
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not Found - handled by frontend"}), 404

# ----------------------------
# Courses: list and create
# ----------------------------

@app.get("/api/session")
def get_session_user():
    """Return current Flask session user or 401."""
    uid = session.get("user_id")
    uname = session.get("username")
    if not uid:
        return jsonify(error="unauthorized"), 401
    return jsonify(user_id=uid, username=uname), 200

# ----------------------------
# Client log sink (to surface frontend logs in server terminal)
# ----------------------------
@app.post("/api/client-log")
def client_log():
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

@app.post("/api/courses")
def create_course():
    """Create a course with { name, description } for the current session user and return it."""
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

@app.post("/api/summaries")
def create_summary():
    """Create a summary for the current session user.
    Body: { title: str, content: str }
    Returns: { id, title, created_at }
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "Summary").strip() or "Summary"
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify(error="content is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # Ensure table exists (lightweight migration)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS summaries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )
        cur.execute(
            """
            INSERT INTO summaries (user_id, title, content)
            VALUES (%s, %s, %s)
            RETURNING id, created_at
            """,
            (user_id, title, content),
        )
        sid, created_at = cur.fetchone()
        conn.commit()
        cur.close()
        return jsonify(id=sid, title=title, created_at=(created_at.isoformat() if created_at else None)), 201
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()
        
@app.post("/api/notes")
def create_note():
    """Create a note for the current session user.
    Body: { title: str, content: str, course_id?: int, topic_id?: int }
    Returns: { id, title, updated_at }
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "Untitled").strip() or "Untitled"
    content = (data.get("content") or "").strip()
    course_id = data.get("course_id")
    topic_id = data.get("topic_id")
    if not content:
        return jsonify(error="content is required"), 400
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO notes (title, course_id, topic_id, user_id, content)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, updated_at
            """,
            (title, course_id, topic_id, user_id, content),
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

@app.get("/api/dashboard/quizzes")
def dashboard_quizzes():
    """List recent quizzes for the current session user.
    Returns items: [{ id, created_at, score, question_count, answered_count, completed }]
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
              q.id,
              q.created_at,
              COALESCE(q.score, 0) AS score,
              COUNT(qq.id) AS question_count,
              SUM(CASE WHEN COALESCE(NULLIF(qq.user_answer, ''), NULL) IS NOT NULL THEN 1 ELSE 0 END) AS answered_count
            FROM quizzes q
            LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
            WHERE q.created_by = %s
            GROUP BY q.id
            ORDER BY q.created_at DESC NULLS LAST, q.id DESC
            LIMIT 10
            """,
            (user_id,),
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
            completed = (question_count > 0 and answered_count >= question_count)
            items.append({
                "id": qid,
                "created_at": (created_at.isoformat() if created_at else None),
                "score": score,
                "question_count": question_count,
                "answered_count": answered_count,
                "completed": completed,
            })
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
        # Ensure table exists
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS summaries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )
        cur.execute(
            "SELECT id, title, content, created_at FROM summaries WHERE id = %s AND user_id = %s",
            (sid, user_id),
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return jsonify(error="not found"), 404
        return jsonify(id=row[0], title=row[1], content=row[2], created_at=(row[3].isoformat() if row[3] else None)), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()

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
            SELECT id, title, updated_at
            FROM notes
            WHERE user_id = %s
            ORDER BY updated_at DESC NULLS LAST, id DESC
            LIMIT 10
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
        items = [
            {
                "id": r[0],
                "title": r[1],
                "updated_at": (r[2].isoformat() if r[2] else None),
            }
            for r in rows
        ]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()

@app.get("/api/dashboard/summaries")
def dashboard_summaries():
    """List recent summaries for the current session user."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # Ensure table exists in case it hasn't been created yet
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS summaries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )
        cur.execute(
            """
            SELECT id, title, created_at
            FROM summaries
            WHERE user_id = %s
            ORDER BY created_at DESC NULLS LAST, id DESC
            LIMIT 10
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
        items = [
            {
                "id": r[0],
                "title": r[1],
                "created_at": (r[2].isoformat() if r[2] else None),
            }
            for r in rows
        ]
        return jsonify(items=items), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()
    
# ============================
# Study Buddy: Helpers & Endpoints
# ============================

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

def walk_outlines(items, level, reader: PdfReader, page_map, results: list[tuple[str, int, int]]):
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
    return chosen

def estimate_tokens(s: str) -> int:
    return max(1, int(len(s) / 4))

def split_by_tokens(s: str, max_tokens: int) -> list[str]:
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

def summarize_once(content: str, system_msg: str = "You are a helpful assistant that writes succinct study notes.", model: str = "gemini-2.5-pro") -> str:
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
                    partial = summarize_once(ch, model="gemini-2.5-pro")
                except Exception:
                    raise RuntimeError("file too large to be summarized.")
                partial_summaries.append(partial)
                time.sleep(1)
            combined = "\n\n".join(partial_summaries)
            try:
                return summarize_once(combined, system_msg="You write concise combined summaries of bullet-point notes.", model="gemini-2.5-pro")
            except Exception:
                raise RuntimeError("file too large to be summarized.")
        else:
            try:
                return summarize_once(txt, model="gemini-2.5-pro")
            except Exception:
                raise RuntimeError("file too large to be summarized.")
    except Exception:
        return txt[:1200]

def ensure_minimum_summary(summary: str, size: str) -> tuple[bool, str]:
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

def parse_json_lenient(s: str):
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

def to_index_from_answer(ans: str | int | None, options: list[str]) -> int | None:
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

def generate_quiz_with_gemini(summary: str, count: int) -> list[dict]:
    schema_example = {
        "questions": [
            {
                "question": "...",
                "options": ["...", "...", "...", "..."],
                "correctIndex": 0,
            }
        ]
    }
    user_prompt = (
        "Create a multiple-choice quiz from the SUMMARY below. "
        f"Number of questions: {count}. "
        "Each question must have exactly 4 options and a single correctIndex (0..3). "
        "Output strictly valid JSON matching this schema (no extra text):\n"
        f"{schema_example}\n\nSUMMARY:\n{summary}"
    )
    resp = gemini_client.models.generate_content(
        model="gemini-2.5-pro",
        contents=user_prompt,
    )
    raw = (getattr(resp, "text", None) or "").strip()
    data = parse_json_lenient(raw or "{}")
    items = []
    if isinstance(data, dict):
        if isinstance(data.get("questions"), list):
            items = data.get("questions") or []
        elif isinstance(data.get("items"), list):
            items = data.get("items") or []
        elif isinstance(data.get("quiz"), dict) and isinstance(data["quiz"].get("questions"), list):
            items = data["quiz"].get("questions") or []
    elif isinstance(data, list):
        items = data
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
        cleaned.append({"question": question, "options": options, "correctIndex": ci})
        if len(cleaned) >= count:
            break
    if not cleaned:
        retry_prompt = (
            "Return STRICT JSON only, no markdown, matching this schema exactly: "
            f"{schema_example}. Do not add any keys beyond 'questions', 'question', 'options', 'correctIndex'. "
            f"Number of questions: {count}. SUMMARY:\n{summary}"
        )
        try:
            retry_resp = gemini_client.models.generate_content(
                model="gemini-2.5-pro",
                contents=retry_prompt,
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
                cleaned.append({"question": question, "options": options, "correctIndex": ci})
                if len(cleaned) >= count:
                    break
        except Exception:
            pass
    return cleaned

@app.post("/api/quiz")
def generate_quiz_endpoint():
    data = request.get_json(silent=True) or {}
    summary: str = (data.get("summary") or "").strip()
    size: str = (data.get("size") or "small").strip().lower()
    if not summary:
        return jsonify(error="Missing summary"), 400
    size_map = {
        "small": 8,
        "medium": 12,
        "large": 25,
        "comprehensive": 50,
    }
    count = size_map.get(size, 8)
    ok, msg = ensure_minimum_summary(summary, size)
    if not ok:
        return jsonify(error=msg), 400
    try:
        questions = generate_quiz_with_gemini(summary, count)
    except Exception as e:
        return jsonify(error=f"quiz generation failed: {e}"), 500
    if not questions:
        return jsonify(error="quiz generation returned no valid questions"), 500

    # Persist quiz + questions
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # Ensure session user exists (DB may have been reset)
        cur.execute("SELECT 1 FROM users WHERE id = %s", (user_id,))
        if cur.fetchone() is None:
            cur.close()
            return jsonify(error="invalid session: user not found. Please sign in again."), 401
        # Create quiz row: topics empty array, score 0
        cur.execute(
            """
            INSERT INTO quizzes (topics, created_by, score)
            VALUES (ARRAY[]::TEXT[], %s, 0)
            RETURNING id
            """,
            (user_id,),
        )
        quiz_id = cur.fetchone()[0]

        # Insert quiz questions and collect their ids
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
            cur.execute(
                """
                INSERT INTO quiz_questions (quiz_id, question_number, question, options, correct_answer, user_answer, is_correct)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (quiz_id, i, question, options, correct_answer, None, None),
            )
            qid = cur.fetchone()[0]
            inserted_question_ids.append(qid)
        conn.commit()
        cur.close()
        return jsonify(quiz_id=quiz_id, questions=questions[:count], question_ids=inserted_question_ids), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()

@app.post("/api/quiz/answer")
def record_quiz_answer():
    """Record a user's answer to a quiz question and update score if newly correct.
    Body: { quiz_id: int, question_id?: int, question_number?: int, user_answer: str }
    Returns 200 with { correct: bool, score_incremented: bool }
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    data = request.get_json(silent=True) or {}
    quiz_id = data.get("quiz_id")
    question_id = data.get("question_id")
    question_number = data.get("question_number")
    user_answer = (data.get("user_answer") or "").strip()
    if not isinstance(quiz_id, int):
        return jsonify(error="quiz_id required"), 400
    if not question_id and not isinstance(question_number, int):
        return jsonify(error="question_id or question_number required"), 400

    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # Verify quiz ownership
        cur.execute("SELECT id FROM quizzes WHERE id = %s AND created_by = %s", (quiz_id, user_id))
        row = cur.fetchone()
        if not row:
            return jsonify(error="not found"), 404

        # Resolve question id and fetch current state
        if not question_id:
            cur.execute(
                "SELECT id, correct_answer, is_correct FROM quiz_questions WHERE quiz_id = %s AND question_number = %s",
                (quiz_id, question_number),
            )
        else:
            cur.execute(
                "SELECT id, correct_answer, is_correct FROM quiz_questions WHERE id = %s AND quiz_id = %s",
                (question_id, quiz_id),
            )
        qrow = cur.fetchone()
        if not qrow:
            return jsonify(error="question not found"), 404
        qid, correct_answer, prev_is_correct = qrow

        # Determine correctness
        is_correct = (user_answer == (correct_answer or "")) if user_answer else False

        # Update question
        cur.execute(
            "UPDATE quiz_questions SET user_answer = %s, is_correct = %s WHERE id = %s",
            (user_answer or None, is_correct, qid),
        )

        score_incremented = False
        if is_correct and prev_is_correct is not True:
            cur.execute("UPDATE quizzes SET score = COALESCE(score, 0) + 1 WHERE id = %s", (quiz_id,))
            score_incremented = True

        conn.commit()
        cur.close()
        return jsonify(correct=is_correct, score_incremented=score_incremented), 200
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()

@app.get("/api/quizzes/<int:qzid>")
def get_quiz(qzid: int):
    """Return a quiz with its questions for the session user, plus the first unanswered index.
    Response: { id, created_at, score, questions: [{ id, question_number, question, options, user_answer, is_correct, correctIndex }], next_unanswered_index }
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, created_at, COALESCE(score,0) FROM quizzes WHERE id = %s AND created_by = %s", (qzid, user_id))
        q = cur.fetchone()
        if not q:
            return jsonify(error="not found"), 404
        cur.execute(
            """
            SELECT id, question_number, question, options, correct_answer, user_answer, is_correct
            FROM quiz_questions
            WHERE quiz_id = %s
            ORDER BY question_number ASC
            """,
            (qzid,),
        )
        rows = cur.fetchall()
        cur.close()
        questions = []
        next_idx = None
        for rid, num, question, options, correct_answer, user_answer, is_correct in rows:
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
            })
        return jsonify(
            id=q[0],
            created_at=(q[1].isoformat() if q[1] else None),
            score=q[2],
            questions=questions,
            next_unanswered_index=(next_idx if next_idx is not None else 0),
        ), 200
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        conn.close()

@app.post("/api/quizzes/<int:qzid>/reset")
def reset_quiz(qzid: int):
    """Reset quiz score to 0 and clear all user_answer/is_correct for its questions."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(error="unauthorized"), 401
    conn = get_connection()
    if not conn:
        return jsonify(error="Database connection error"), 500
    try:
        cur = conn.cursor()
        # Verify ownership
        cur.execute("SELECT 1 FROM quizzes WHERE id = %s AND created_by = %s", (qzid, user_id))
        if cur.fetchone() is None:
            return jsonify(error="not found"), 404
        cur.execute("UPDATE quizzes SET score = 0 WHERE id = %s", (qzid,))
        cur.execute("UPDATE quiz_questions SET user_answer = NULL, is_correct = NULL WHERE quiz_id = %s", (qzid,))
        conn.commit()
        cur.close()
        return ("", 204)
    except Exception as e:
        conn.rollback()
        return jsonify(error=str(e)), 500
    finally:
        conn.close()

def generate_study_guide(text: str) -> str:
    """Use Gemini to expand a summary/notes into a structured, comprehensive study guide.
    Produces organized headings and bullet points, with definitions, axioms, examples, tips.
    """
    prompt = (
        "Transform the following notes into a comprehensive STUDY GUIDE with clear structure.\n"
        "Requirements:\n"
        "- Use section headings and concise bullet points.\n"
        "- Expand briefly on key concepts (definitions, axioms, theorems, formulas).\n"
        "- Add short examples where helpful.\n"
        "- Avoid meta commentary and instructions. Output the study guide only.\n\n"
        f"NOTES:\n{text}"
    )
    try:
        resp = gemini_client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt,
        )
        out = (getattr(resp, "text", None) or "").strip()
        return out
    except Exception:
        return text

@app.post("/api/study_guide")
def study_guide_endpoint():
    data = request.get_json(silent=True) or {}
    txt = (data.get("text") or "").strip()
    if not txt:
        return jsonify(error="Missing text"), 400
    # Light guardrail: require at least ~60 tokens
    if estimate_tokens(txt) < 60:
        return jsonify(error="Input is too short for a useful study guide. Provide a longer summary or notes."), 400
    guide = generate_study_guide(txt)
    if not guide:
        return jsonify(error="study guide generation failed"), 500
    return jsonify(guide=guide), 200

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
            extracted_text=extracted_text,
        ), 200
    except Exception as e:
        # If summarization indicates size issue, return a 400 with message
        msg = str(e)
        if "file too large to be summarized." in msg:
            return jsonify(error="file too large to be summarized."), 400
        return jsonify(error=msg), 500

# ----------------------------
# Run Server
# ----------------------------
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)
