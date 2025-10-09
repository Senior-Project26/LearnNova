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

// Simple checkbox combobox for multi-select
type ComboOption = { id: number; title: string };
function MultiCombo({
  label,
  options,
  selectedIds,
  setSelectedIds,
}: {
  label: string;
  options: ComboOption[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter(o => (o.title || "").toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );
  const toggle = (id: number) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };
  const clearAll = () => setSelectedIds([]);
  const count = selectedIds.length;
  return (
    <div className="block relative">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        className="mt-2 w-full p-2 border rounded flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <span>{count > 0 ? `${count} selected` : `Select ${label.toLowerCase()}`}</span>
        <span className="text-gray-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg p-2">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1 border rounded"
            />
            <button
              className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
              onClick={clearAll}
              type="button"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-56 overflow-auto space-y-1">
            {filtered.map(opt => (
              <li key={opt.id}>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(opt.id)}
                    onChange={() => toggle(opt.id)}
                  />
                  <span className="text-sm truncate">{opt.title || `#${opt.id}`}</span>
                </label>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-xs text-gray-500 px-2 py-1">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Quiz() {
  // Form state
  const [size, setSize] = useState<QuizSize>("small");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation() as { state?: { summary?: string; quizId?: number } };
  // Multi-select data
  const [allNotes, setAllNotes] = useState<Array<{ id: number; title: string }>>([]);
  const [allSummaries, setAllSummaries] = useState<Array<{ id: number; title: string }>>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<number[]>([]);
  const [stateSummaryContent, setStateSummaryContent] = useState<string>("");


  // Quiz runtime state
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [score, setScore] = useState(0);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [questionIds, setQuestionIds] = useState<number[]>([]);
  // Derived
  const current = questions ? questions[idx] : null;
  const total = questions ? questions.length : 0;

  // Prefill from quizId (resume) or from navigation summary / sessionStorage, and load lists
  useEffect(() => {
    try {
      // Load lists
      (async () => {
        try {
          const [nRes, sRes] = await Promise.all([
            fetch("/api/all_notes", { credentials: "include" }),
            fetch("/api/all_summaries", { credentials: "include" }),
          ]);
          if (nRes.ok) {
            const n = await nRes.json();
            setAllNotes(((n?.items as any[]) || []).map(x => ({ id: x.id, title: x.title })));
          }
          if (sRes.ok) {
            const s = await sRes.json();
            setAllSummaries(((s?.items as any[]) || []).map(x => ({ id: x.id, title: x.title })));
          }
        } catch {}
      })();

      const qid = location.state?.quizId;
      if (typeof qid === "number") {
        // Load existing quiz for resume
        (async () => {
          setLoading(true);
          try {
            const res = await fetch(`/api/quizzes/${qid}`, { credentials: "include" });
            const data = await res.json().catch(() => ({} as any));
            if (!res.ok) {
              setError((data as any)?.error || `Failed to load quiz #${qid}`);
              setLoading(false);
              return;
            }
            const serverQs = (data?.questions || []) as Array<{
              id: number; question: string; options: string[]; correctIndex: number | null;
            }>;
            const mapped: QuizQuestion[] = serverQs.map(q => ({
              question: q.question,
              options: q.options || [],
              correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
            }));
            setQuestions(mapped.length ? mapped : null);
            setQuizId(qid);
            setQuestionIds(serverQs.map(q => q.id));
            const nextIdx = Math.max(0, Math.min((data?.next_unanswered_index ?? 0), Math.max(0, mapped.length)));
            setIdx(nextIdx);
            setScore(Number(data?.score ?? 0));
            setLoading(false);
          } catch (e: any) {
            setError(e?.message || "Failed to load quiz");
            setLoading(false);
          }
        })();
        return;
      }
      // If a summary was passed via navigation, add a virtual selectable option and auto-select it
      const stateSummary = location.state?.summary;
      if (typeof stateSummary === "string" && stateSummary.trim()) {
        setStateSummaryContent(stateSummary);
        setSelectedSummaryIds((ids) => (ids.includes(-1) ? ids : [-1, ...ids])); // -1 denotes virtual "Provided Summary"
      }
    } catch {}
  }, []);

  const disableSubmit = useMemo(() => {
    const selectedCount = selectedNoteIds.length + selectedSummaryIds.length;
    if (selectedCount <= 0) return true;
    return false;
  }, [selectedNoteIds, selectedSummaryIds]);
  // Request quiz from backend (Gemini 2.5 pro under the hood)
  const requestQuiz = async () => {
    setError(null);
    setLoading(true);
    setQuestions(null);
    setIdx(0);
    setSelected(null);
    setFeedback(null);
    setScore(0);

    try {
      // Build combined summary from selected items if any
      let combined = "";
      if (selectedNoteIds.length > 0 || selectedSummaryIds.length > 0) {
        const notePromises = selectedNoteIds.map(async (id) => {
          const r = await fetch(`/api/notes/${id}`, { credentials: "include" });
          const j = await r.json().catch(() => ({} as any));
          return (j?.title ? `# Note: ${j.title}\n` : "") + (j?.content || "");
        });
        const realSummaryIds = selectedSummaryIds.filter((id) => id !== -1);
        const includeProvided = selectedSummaryIds.includes(-1) ? [stateSummaryContent] : [];
        const summaryPromises = realSummaryIds.map(async (id) => {
          const r = await fetch(`/api/summaries/${id}`, { credentials: "include" });
          const j = await r.json().catch(() => ({} as any));
          return (j?.title ? `# Summary: ${j.title}\n` : "") + (j?.content || "");
        });
        const parts = await Promise.all([...notePromises, ...summaryPromises]);
        combined = [...includeProvided, ...parts].filter(Boolean).join("\n\n").trim();
      }
      const payloadSummary = combined.trim();
      const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ summary: payloadSummary, size }),
    });
      const data: (QuizResponse & { quiz_id?: number; question_ids?: number[] }) | { error?: string } = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error((data as any)?.error || `Quiz generation failed (${res.status})`);
      }
      const qs = (data as QuizResponse).questions || [];
      if (!qs.length) throw new Error("No questions returned");
      setQuizId((data as any)?.quiz_id ?? null);
      setQuestionIds(((data as any)?.question_ids as number[]) || []);
      setQuestions(qs);
    } catch (e: any) {
      setError(e?.message || "Quiz request failed");
    } finally {
      setLoading(false);
    }
  };


  const onSubmitAnswer = async () => {
    if (selected == null || !current) return;
    const correct = selected === current.correctIndex;
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) setScore((s) => s + 1);

    // Persist answer in background
    try {
      const qid = questionIds[idx];
      await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quiz_id: quizId,
          question_id: qid,
          question_number: idx + 1,
          user_answer: current.options[selected],
        }),
      });
    } catch {}
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

  const restart = async () => {
    setError(null);
    // If resuming an existing quiz, call reset endpoint then reload it
    if (quizId) {
      try {
        setLoading(true);
        const res = await fetch(`/api/quizzes/${quizId}/reset`, { method: "POST", credentials: "include" });
        if (res.status === 204) {
          // Reload quiz from server after reset
          const getRes = await fetch(`/api/quizzes/${quizId}`, { credentials: "include" });
          const data = await getRes.json().catch(() => ({} as any));
          if (getRes.ok) {
            const serverQs = (data?.questions || []) as Array<{ id: number; question: string; options: string[]; correctIndex: number | null; }>;
            const mapped: QuizQuestion[] = serverQs.map(q => ({ question: q.question, options: q.options || [], correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0 }));
            setQuestions(mapped.length ? mapped : null);
            setQuestionIds(serverQs.map(q => q.id));
            setIdx(0);
            setSelected(null);
            setFeedback(null);
            setScore(0);
          } else {
            setError((data as any)?.error || "Failed to reload quiz after reset");
          }
        } else {
          const err = await res.json().catch(() => ({} as any));
          setError(err?.error || "Failed to reset quiz");
        }
      } catch (e: any) {
        setError(e?.message || "Failed to reset quiz");
      } finally {
        setLoading(false);
      }
      return;
    }
    // Otherwise, local reset for a new quiz flow
    setQuestions(null);
    setIdx(0);
    setSelected(null);
    setFeedback(null);
    setScore(0);
  };

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Quiz Generator</h1>

      {/* Form (multi-select sources) */}
      {!questions && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <MultiCombo
              label="Notes"
              options={allNotes}
              selectedIds={selectedNoteIds}
              setSelectedIds={setSelectedNoteIds}
            />
            <MultiCombo
              label="Summaries"
              options={[
                ...(stateSummaryContent ? [{ id: -1, title: "Provided Summary (from navigation)" }] : []),
                ...allSummaries,
              ]}
              selectedIds={selectedSummaryIds}
              setSelectedIds={setSelectedSummaryIds}
            />
          </div>

          <label className="block">
            <span className="font-medium">Quiz size</span>
            <select
              className="mt-2 p-2 border rounded"
              value={size}
              onChange={(e) => setSize(e.target.value as QuizSize)}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="comprehensive">Comprehensive</option>
            </select>
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
                  <button onClick={restart} className="ml-3 px-3 py-1.5 bg-blue-600 text-white rounded">{quizId ? "Retry Quiz" : "New Quiz"}</button>
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
