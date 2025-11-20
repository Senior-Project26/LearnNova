# LearnNova

An AI-powered study companion that helps students learn faster with automated note summarization, quiz generation, study guides, and more. Text extraction is powered by Google Cloud Vision, and content generation is powered by Gemini 2.5.

LearnNova was created as a student project for CSC 4899 at Florida Southern College.

## Features

- **Note Summarization**: Upload PDFs/images/text; we extract content (Vision OCR for images/PDF scans) and generate concise, sectioned summaries.
- **Quiz Generation**: Create multiple-choice, true/false, and fill-in-the-blank quizzes from your summary. Supports multiple sizes.
- **Study Guide Creation**: Expand your notes into structured bullet-point guides with definitions, axioms, formulas, and short examples.
- **AI Study Assistant**: Planned assistant to answer questions and explain topics contextually from your notes.
- **Study Resources Aggregator**: Planned feature to collect helpful resources by topic.
- **Flashcards**: Planned spaced-repetition decks generated from your notes.
- **Multi-Subject Support**: Combine topics/notes to produce comprehensive quizzes, guides, and flashcards.
- **Weakness Tracking**: Track quiz performance by topic and generate targeted practice problems.
- **Study Plan Generator**: From uploaded notes and expected exam topics, generate a study plan with scheduled quizzes and study guides.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn-ui
- **Backend**: Flask API (Python)
- **AI Services**:
  - Google Cloud Vision: OCR for PDFs/images
  - Gemini 2.5 Flash-Lite (via `google-genai`): summarization, quizzes, study guides
- **Optional Auth/DB** (scaffolded): Firebase Admin + Postgres

## AI Chatbot Overview

- **What it is**
  - A conversational assistant available in the chat UI that answers study questions and can be extended to use your uploaded context.

- **End-to-end flow**
  - Frontend components: `ChatWindow` + `MessageInput` + `MessageList` use the `useChat` hook.
  - On send, `useChat.send()` creates or selects a thread, adds your message and a draft assistant message, then calls `sendChat()` in `src/lib/chatApi.ts`.
  - `sendChat()` POSTs to `POST /api/chat` (credentials included). It prefers streaming via fetch if the server returns text/ndjson; otherwise it falls back to JSON.
  - While streaming, tokens are appended via `onToken` to the draft assistant message; `stop()` uses an `AbortController` to cancel.
  - Errors: 401/403 → `auth`, 429 → `rate`, others → network error — surfaced in the UI.

- **Backend endpoint**
  - `POST /api/chat` in `app.py` (Flask). Requires a signed-in session (checks `session["user_id"]`).
  - Extracts the latest user message from the payload and calls Gemini:
    - `gemini_client.models.generate_content(model="gemini-2.5-flash-lite", contents=<user_text>)`
  - Returns `{ message: { role: "assistant", content } }` as JSON. Current implementation is non-streaming; the frontend automatically handles this as a JSON response.

- **AI model/provider**
  - Uses Google Gemini 2.5 Flash-Lite via the `google-genai` SDK. It’s a fast, cost-efficient, multimodal LLM suitable for chat and short-form generation.
  - Elsewhere in the app, Google Cloud Vision provides OCR for images/PDFs.

- **How we made it work (key steps)**
  - Backend: initialize `google-genai` with `GOOGLE_API_KEY`, add `POST /api/chat`, and guard it with session auth.
  - Frontend: implement `useChat` state machine, optimistic UI (draft assistant), and streaming-friendly `sendChat()` with abort + error handling.
  - Optional cloud sync: endpoints like `/api/chat_threads` let you persist threads/messages when signed in; the hook merges local and cloud threads.

- **Config notes**
  - Env: `GOOGLE_API_KEY` must be set (see Prerequisites below).
  - Frontend env (optional): `VITE_CHAT_STREAM_MODE` (`sse|fetch|json`, default `fetch`), `VITE_API_BASE` (default `/api`).
  - Auth: `GET /api/session` determines if chat is available; unauthenticated users see a sign-in prompt when attempting to chat.

## Prerequisites

- Node.js 18+
- Python 3.11+
- Google API key for Gemini (`GOOGLE_API_KEY`)
- Optional: Google Application Default Credentials (ADC) for Vision OCR
  - Set `GOOGLE_APPLICATION_CREDENTIALS` to your service account JSON if using OCR

## Setup

1) Install frontend deps

```sh
npm install
```

2) Create Python env and install backend deps (uv or pip)

```sh
uv sync
# or
pip install -r requirements.txt
```

3) Environment variables

- In your shell or a `.env` file at project root:

```
GOOGLE_API_KEY=your_gemini_api_key
# Needed if using Vision OCR
GOOGLE_APPLICATION_CREDENTIALS=absolute\path\to\google-credentials.json
```

4) Run the app (two processes via one command)

```sh
npm run dev
```

This starts:

- Frontend: Vite dev server
- Backend: Flask on `http://127.0.0.1:5050`

## Key Flows

- **Upload -> Summary'''
  - Upload a file on `/upload`. The backend extracts text (Vision OCR or PDF parsing) and summarizes it.
  - You’re navigated to `/summary` where the summary is shown.
- **Quiz Me!'''
  - From `/summary`, click “Quiz Me!”. The summary is stored and sent to `/quiz` via accessing the summary in the database.
  - Submits to `POST /api/quiz` and renders an interactive quiz.
- **Study Guide'''
  - From `/summary`, click “Study Guide”. The summary is stored and sent to `/study-guide` via accessing the summary in the database.
  - Submits to `POST /api/study_guide` and displays the generated guide.

## API (local dev)

- `POST /api/upload`
  - multipart/form-data: `file`
  - Returns: `{ summary, filename, mimetype, size, kind }`

- `POST /api/quiz`
  - JSON: `{ summary: string, size: "small|medium|large|comprehensive" }`
  - Returns: `{ questions: [{ question, options: string[4], correctIndex: 0..3 }] }` || `{ questions: [{ question, options: string[2], correctIndex: 0..1 }]}` || `{questions: [{question, options: string[10], correctIndex: 0..9}]}`

- `POST /api/study_guide`
  - JSON: `{ text: string }`
  - Returns: `{ guide: string }`

## Notes on OCR & Generation

- If Vision credentials aren’t configured, image OCR will fail. PDFs with embedded text will still work through PDF parsing.
- Summarization, quiz, and study guide generation use Gemini 2.5 Flash-Lite. Model output is parsed and validated server-side for stability.

## Development Tips

- Frontend expects backend on port `5050`. If you change it, update endpoints in:
  - `src/pages/Upload.tsx`
  - `src/pages/Quiz.tsx`
  - `src/pages/StudyGuide.tsx`

## Roadmap

- Resource aggregator by subject/topic
- Flashcard generation with spaced repetition
- Weakness tracking dashboard + targeted practice sets
- Study plan builder across multiple subjects and deadlines

## Credits

- LearnNova — built as a student project for CSC 4899 at Florida Southern College.
- Google Cloud Vision for OCR; Gemini 2.5 Flash-Lite for generation.
