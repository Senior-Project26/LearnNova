"""
Creates the LearnNova database.

Description: Core schema for the LearnNova AI-powered study platform.
"""

import sqlite3

# Connect (creates file if it doesn't exist)
connection = sqlite3.connect("learnnova.db")
cursor = connection.cursor()

# Always enforce foreign keys
cursor.execute("PRAGMA foreign_keys = ON;")

# Drop old tables (for reruns)
tables = [
    "badges",
    "ai_study_plans",
    "notes",
    "study_sessions",
    "quiz_questions",
    "quizzes",
    "flashcards",
    "topics",
    "courses",
    "users"
]
for t in tables:
    cursor.execute(f"DROP TABLE IF EXISTS {t};")

# USERS
cursor.execute("""
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_id TEXT,
    profile_pic TEXT,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
""")

# COURSES
cursor.execute("""
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
""")

# TOPICS
cursor.execute("""
CREATE TABLE topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (course_id) REFERENCES courses(id)
);
""")

# FLASHCARDS
cursor.execute("""
CREATE TABLE flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_by INTEGER,
    difficulty INTEGER CHECK(difficulty BETWEEN 1 AND 5),
    last_reviewed DATETIME,
    next_review DATETIME,
    FOREIGN KEY (topic_id) REFERENCES topics(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
""")

# QUIZZES
cursor.execute("""
CREATE TABLE quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    score INTEGER,
    ai_generated BOOLEAN DEFAULT 0,
    FOREIGN KEY (topic_id) REFERENCES topics(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
""")

# QUIZ QUESTIONS
cursor.execute("""
CREATE TABLE quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);
""")

# STUDY SESSIONS
cursor.execute("""
CREATE TABLE study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic_id INTEGER,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    duration_minutes INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (topic_id) REFERENCES topics(id)
);
""")

# NOTES
cursor.execute("""
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER,
    user_id INTEGER,
    content TEXT NOT NULL,
    shared BOOLEAN DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
""")

# AI STUDY PLANS
cursor.execute("""
CREATE TABLE ai_study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    generated_on DATETIME DEFAULT CURRENT_TIMESTAMP,
    plan_json TEXT,
    goal TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
""")

# BADGES
cursor.execute("""
CREATE TABLE badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    points INTEGER DEFAULT 0,
    icon TEXT,
    earned_on DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
""")

connection.commit()
connection.close()
print("✅ LearnNova database created successfully!")
