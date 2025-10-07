"""
Seeds the LearnNova database with sample data.
cd"""

import sqlite3

# Connect to your existing database
connection = sqlite3.connect("learnnova.db")
cursor = connection.cursor()

# --- USERS ---
users = [
    ("Luna", "luna@learnnova.com", "hash123", None, "luna.png"),
    ("Orion", "orion@learnnova.com", "hash456", None, "orion.png"),
    ("Nova", "nova@learnnova.com", "hash789", None, "nova.png")
]
cursor.executemany("""
INSERT INTO users (username, email, password_hash, google_id, profile_pic)
VALUES (?, ?, ?, ?, ?);
""", users)

# --- COURSES ---
courses = [
    ("Calculus I", "Limits, derivatives, and integrals", 1),
    ("Biology 101", "Introduction to life sciences", 2),
    ("Astronomy", "Exploring the universe", 3)
]
cursor.executemany("""
INSERT INTO courses (name, description, created_by)
VALUES (?, ?, ?);
""", courses)

# --- TOPICS ---
topics = [
    (1, "Derivatives", "Understanding the rate of change"),
    (1, "Integrals", "Area under the curve"),
    (2, "Cell Structure", "Introduction to cells"),
    (3, "Planets", "Overview of our solar system")
]
cursor.executemany("""
INSERT INTO topics (course_id, title, description)
VALUES (?, ?, ?);
""", topics)

# --- FLASHCARDS ---
flashcards = [
    (1, "What is the derivative of x²?", "2x", 1, 2),
    (2, "What is the integral of 2x?", "x² + C", 1, 2),
    (3, "What organelle is the powerhouse of the cell?", "Mitochondria", 2, 1),
    (4, "What planet is known as the Red Planet?", "Mars", 3, 1)
]
cursor.executemany("""
INSERT INTO flashcards (topic_id, question, answer, created_by, difficulty)
VALUES (?, ?, ?, ?, ?);
""", flashcards)

# --- QUIZZES ---
quizzes = [
    (1, 1, 90, 0),
    (3, 2, 85, 1)
]
cursor.executemany("""
INSERT INTO quizzes (topic_id, created_by, score, ai_generated)
VALUES (?, ?, ?, ?);
""", quizzes)

# --- QUIZ QUESTIONS ---
quiz_questions = [
    (1, "What is the derivative of sin(x)?", "cos(x)", "cos(x)", 1),
    (1, "What is the derivative of e^x?", "e^x", "e^x", 1),
    (2, "What is the main function of mitochondria?", "Energy production", "Energy production", 1)
]
cursor.executemany("""
INSERT INTO quiz_questions (quiz_id, question, correct_answer, user_answer, is_correct)
VALUES (?, ?, ?, ?, ?);
""", quiz_questions)

# --- NOTES ---
notes = [
    (1, 1, "The derivative measures how fast something changes.", 1),
    (2, 1, "Integrals help find the area under a curve.", 0)
]
cursor.executemany("""
INSERT INTO notes (topic_id, user_id, content, shared)
VALUES (?, ?, ?, ?);
""", notes)

# --- AI STUDY PLANS ---
plans = [
    (1, '{"Monday": "Review Derivatives", "Tuesday": "Practice Integrals"}', "Midterm Prep"),
    (2, '{"Wednesday": "Study Cell Structure"}', "Chapter Review")
]
cursor.executemany("""
INSERT INTO ai_study_plans (user_id, plan_json, goal)
VALUES (?, ?, ?);
""", plans)

# --- BADGES ---
badges = [
    (1, "Quiz Master", "Scored over 90% on a quiz", 100, "quiz_icon.png"),
    (2, "Study Streak", "Studied 5 days in a row", 50, "streak_icon.png")
]
cursor.executemany("""
INSERT INTO badges (user_id, name, description, points, icon)
VALUES (?, ?, ?, ?, ?);
""", badges)

connection.commit()
connection.close()
print("🌙 Sample data inserted successfully!")
