"""
Initialize the Postgres database `learnnova` and create core tables.
- Reads password from env: POSTGRES_PASSWORD
- Connects to maintenance DB `postgres` to create `learnnova` if missing
- Then connects to `learnnova` and creates the following tables (if not exist):
  users, courses, topics, quizzes, quiz_questions, notes

Run:
  py learnnova-db/init_postgres.py
"""
from __future__ import annotations
import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_USER = os.getenv("POSTGRES_USER", "postgres")
PG_PASSWORD = os.getenv("POSTGRES_PASSWORD", "CSVm0304")
PG_DB_NAME = os.getenv("POSTGRES_DB", "learnnova")
PG_PORT = int(os.getenv("POSTGRES_PORT", "5432"))


def connect(dbname: str):
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        database=dbname,
    )


def ensure_database_exists():
    # Connect to maintenance DB to check/create target database
    conn = connect("postgres")
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    try:
        cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (PG_DB_NAME,))
        exists = cur.fetchone() is not None
        if not exists:
            print(f"Creating database '{PG_DB_NAME}' ...")
            cur.execute(f"CREATE DATABASE {PG_DB_NAME};")
        else:
            print(f"Database '{PG_DB_NAME}' already exists.")
    finally:
        cur.close()
        conn.close()


def create_tables():
    conn = connect(PG_DB_NAME)
    cur = conn.cursor()
    try:
        # USERS
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                google_id TEXT,
                profile_pic TEXT,
                level INTEGER DEFAULT 1,
                streak_days INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        # COURSES
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS courses (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_by INTEGER,
                FOREIGN KEY (created_by) REFERENCES users(id)
            );
            """
        )

        # TOPICS
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS topics (
                id SERIAL PRIMARY KEY,
                course_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                FOREIGN KEY (course_id) REFERENCES courses(id)
            );
            """
        )

        # QUIZZES
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS quizzes (
                id SERIAL PRIMARY KEY,
                topic_id INTEGER,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                score INTEGER,
                FOREIGN KEY (topic_id) REFERENCES topics(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );
            """
        )

        # QUIZ QUESTIONS
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS quiz_questions (
                id SERIAL PRIMARY KEY,
                quiz_id INTEGER NOT NULL,
                question_number INTEGER NOT NULL,
                question TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                user_answer TEXT,
                is_correct BOOLEAN,
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
                UNIQUE (quiz_id, question_number)
            );
            """
        )

        # NOTES
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                course_id INTEGER,
                topic_id INTEGER,
                user_id INTEGER,
                content TEXT NOT NULL,
                shared BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id),
                FOREIGN KEY (topic_id) REFERENCES topics(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )

        conn.commit()
        print("Postgres database initialized successfully.")
    except Exception as e:
        conn.rollback()
        print("Initialization failed:", e)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    ensure_database_exists()
    create_tables()
