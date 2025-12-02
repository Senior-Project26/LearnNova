"""
Initialize the Postgres database `learnnova` and create core tables.
- Reads password from env: POSTGRES_PASSWORD (and HOST/PORT/USER/DB if provided)
- Connects to maintenance DB `postgres` to create `learnnova` if missing
- Drops ALL tables in the `public` schema, then recreates:
  users, courses, topics, quizzes, quiz_questions, notes, summaries, study_guides

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


def drop_all_tables():
    """Drop all tables in the public schema (CASCADE)."""
    conn = connect(PG_DB_NAME)
    cur = conn.cursor()
    try:
        # Disable FK checks by cascading drops
        cur.execute(
            """
            DO $$
            DECLARE r RECORD;
            BEGIN
              FOR r IN (
                SELECT tablename FROM pg_tables WHERE schemaname = 'public'
              ) LOOP
                IF r.tablename <> 'users' THEN
                  EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END IF;
              END LOOP;
            END $$;
            """
        )
        conn.commit()
        print("Dropped all tables in 'public' schema.")
    except Exception as e:
        conn.rollback()
        print("Failed to drop tables:", e)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


def create_tables():
    conn = connect(PG_DB_NAME)
    cur = conn.cursor()
    try:
        # Start from a clean slate
        cur.execute(
            """
            DO $$
            DECLARE r RECORD;
            BEGIN
              FOR r IN (
                SELECT tablename FROM pg_tables WHERE schemaname = 'public'
              ) LOOP
                IF r.tablename <> 'users' THEN
                  EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END IF;
              END LOOP;
            END $$;
            """
        )

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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
                average_difficulty DOUBLE PRECISION DEFAULT 0,
                difficulty_count INTEGER DEFAULT 0,
                difficulty_sum DOUBLE PRECISION DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id)
            );
            """
        )

        # QUIZZES
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS quizzes (
                id SERIAL PRIMARY KEY,
                course_id INTEGER,
                title TEXT,
                topics TEXT[] DEFAULT '{}',
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                score INTEGER,
                original_count INTEGER,
                source_summary TEXT,
                topic_difficulty JSONB NOT NULL DEFAULT '{}'::jsonb,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
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
                options TEXT[] DEFAULT '{}',
                correct_answer TEXT NOT NULL,
                user_answer TEXT,
                is_correct BOOLEAN,
                confidence INTEGER,
                times_correct INTEGER DEFAULT 0,
                times_seen INTEGER DEFAULT 0,
                correct_streak INTEGER DEFAULT 0,
                max_streak INTEGER DEFAULT 0,
                mastery DOUBLE PRECISION DEFAULT 0,
                option_counts INTEGER[] DEFAULT '{}',
                interval INTEGER,
                last_reviewed TIMESTAMP,
                next_review TIMESTAMP,
                topic TEXT,
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
                topics TEXT[] DEFAULT '{}',
                user_id INTEGER,
                content TEXT NOT NULL,
                shared BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )

        # SUMMARIES (used by dashboard and summary endpoints)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS summaries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                course_id INTEGER,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                topics TEXT[] DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            );
            """
        )

        # STUDY GUIDES (separate from notes)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS study_guides (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                course_id INTEGER,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS study_sets (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                course_id INTEGER NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                cards JSONB NOT NULL DEFAULT '[]'::jsonb,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )

        conn.commit()
        # Add unique index to prevent duplicate topics per course (case-insensitive)
        cur = conn.cursor()
        try:
            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'topics_course_title_unique'
                  ) THEN
                    CREATE UNIQUE INDEX topics_course_title_unique ON topics (course_id, lower(title));
                  END IF;
                END $$;
                """
            )
            conn.commit()
        except Exception:
            conn.rollback()
        print("Postgres database initialized successfully. Tables: users, courses, topics, quizzes, quiz_questions, notes, summaries, study_guides, study_sets")
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
