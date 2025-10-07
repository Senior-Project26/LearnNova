from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
import os

# ----------------------------
# Flask App Setup
# ----------------------------
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "supersecretkey")
CORS(app, supports_credentials=True)

# ----------------------------
# Firebase Admin Setup
# ----------------------------
try:
    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)
    print("✅ Firebase Admin connected")
except Exception as e:
    print(f"⚠️ Firebase Admin connection failed: {e}")

# ----------------------------
# Database Connection
# ----------------------------
def get_connection():
    try:
        return psycopg2.connect(
            host="localhost",
            database="learnnova",
            user="postgres",
            password="yourpassword"  # ← replace with your own or env var
        )
    except Exception as e:
        print("❌ Database connection failed:", e)
        return None

# ----------------------------
# Routes
# ----------------------------

@app.route("/api/ping")
def ping():
    """Simple test route"""
    return jsonify({"message": "Flask backend is running 🚀"})

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
    if not check_password_hash(password_hash, password):
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
        return jsonify({"message": "Firebase login verified", "email": user_email, "name": user_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 401

# ----------------------------
# Error Handler for Frontend Routes
# ----------------------------
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not Found - handled by frontend"}), 404

# ----------------------------
# Run Server
# ----------------------------
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)
