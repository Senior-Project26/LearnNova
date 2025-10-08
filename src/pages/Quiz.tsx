import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

// Types
type QuizSize = "small" | "medium" | "large" | "comprehensive";

type QuizQuestion = {
  question: string;
  options: string[]; // 4 options
  correctIndex: number; // 0..3
};

type QuizResponse = {
  questions: QuizQuestion[];
};

export default function Quiz() {
  // Form state
  const [summary, setSummary] = useState("");
  const [size, setSize] = useState<QuizSize>("small");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation() as { state?: { summary?: string } };

  // Quiz runtime state
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [score, setScore] = useState(0);

  // Prefill summary from navigation state or last upload (if present)
  useEffect(() => {
    try {
      // 1) location.state from Summary page navigation
      const stateSummary = location.state?.summary;
      if (typeof stateSummary === "string" && stateSummary.trim()) {
        setSummary(stateSummary);
        return;
      }
      // 2) sessionStorage fallback set by Summary.quizMe()
      const last = sessionStorage.getItem("lastUploadResult");
      if (last) {
        const parsed = JSON.parse(last);
        if (parsed?.summary && typeof parsed.summary === "string") setSummary(parsed.summary);
      }
    } catch {}
  }, []);

  // Helper: Large/comprehensive require longer summary (UX hint only; backend enforces real thresholds)
  const needsLonger = size === "large" || size === "comprehensive";

  const disableSubmit = useMemo(() => summary.trim().length < (needsLonger ? 600 : 60), [summary, needsLonger]);

  // Request quiz from backend (Gemini 2.5 pro under the hood)
  const requestQuiz = async () => {
    setError(null);
    setLoading(true);
    setQuestions(null);
    setSelected(null);
    setFeedback(null);
    setScore(0);

    try {
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, size }),
    });
      const data: QuizResponse | { error?: string } = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error((data as any)?.error || `Quiz generation failed (${res.status})`);
      }
      const qs = (data as QuizResponse).questions || [];
      if (!qs.length) throw new Error("No questions returned");
      setQuestions(qs);
    } catch (e: any) {
      setError(e?.message || "Quiz request failed");
    } finally {
      setLoading(false);
    }
  };

  // Current question
  const current = questions ? questions[idx] : null;
  const total = questions?.length || 0;

  const onSubmitAnswer = () => {
    if (selected == null || !current) return;
    const correct = selected === current.correctIndex;
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) setScore((s) => s + 1);
  };

  const nextQuestion = () => {
    if (!questions) return;
    const next = idx + 1;
    if (next < questions.length) {
      setIdx(next);
      setSelected(null);
      setFeedback(null);
    }
  };

  const restart = () => {
    setQuestions(null);
    setIdx(0);
    setSelected(null);
    setFeedback(null);
    setScore(0);
    setError(null);
  };

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Quiz Generator</h1>

      {/* Form */}
      {!questions && (
        <div className="space-y-4">
          <label className="block">
            <span className="font-medium">Paste or enter a summary</span>
            <textarea
              className="mt-2 w-full min-h-40 p-3 border rounded"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Paste your summary here..."
            />
          </label>

          <label className="block">
            <span className="font-medium">Quiz size</span>
            <select
              className="mt-2 w-full p-2 border rounded"
              value={size}
              onChange={(e) => setSize(e.target.value as QuizSize)}
            >
              <option value="small">Small (5–10)</option>
              <option value="medium">Medium (10–15)</option>
              <option value="large">Large (20–30)</option>
              <option value="comprehensive">Comprehensive (50)</option>
            </select>
            {needsLonger && (
              <p className="mt-2 text-sm text-gray-600">
                Large and Comprehensive require longer summaries for high-quality quizzes.
              </p>
            )}
          </label>

          <button
            onClick={requestQuiz}
            disabled={loading || disableSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Quiz"}
          </button>

          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}

      {/* Quiz display */}
      {questions && current && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Question {idx + 1} / {total}</div>
            <div className="text-sm text-gray-600">Score: {score}</div>
          </div>

          <div className="text-lg font-medium">{current.question}</div>

          <div className="space-y-2">
            {current.options.map((opt, i) => (
              <label key={i} className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${selected === i ? "border-blue-600" : ""}`}>
                <input
                  type="radio"
                  name="answer"
                  checked={selected === i}
                  onChange={() => setSelected(i)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          {!feedback && (
            <button
              onClick={onSubmitAnswer}
              disabled={selected == null}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Submit Answer
            </button>
          )}

          {feedback && (
            <div className="space-y-3">
              <div className={feedback === "correct" ? "text-green-600" : "text-red-600"}>
                {feedback === "correct" ? "Correct!" : "Incorrect."}
              </div>
              {idx < (questions.length - 1) ? (
                <button onClick={nextQuestion} className="px-4 py-2 bg-gray-800 text-white rounded">Next Question</button>
              ) : (
                <div className="space-x-2">
                  <span className="font-medium">Finished!</span>
                  <span>Final score: {score} / {questions.length}</span>
                  <button onClick={restart} className="ml-3 px-3 py-1.5 bg-blue-600 text-white rounded">New Quiz</button>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
