import { useEffect, useMemo, useState } from "react";
<<<<<<< HEAD
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MarkdownMathRenderer from "@/components/MarkdownMathRenderer";
=======
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, CheckCircle2, XCircle, Sparkles, RotateCcw } from "lucide-react";
>>>>>>> profile-settings-update

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

<<<<<<< HEAD
type ResumeQuizResponse = {
  questions?: Array<{ id: number; question: string; options: string[]; correctIndex: number | null }>;
  next_unanswered_index?: number;
  score?: number;
  error?: string;
};

type ContentResp = { title?: string; content?: string };
function parseContentResp(u: unknown): ContentResp {
  if (u && typeof u === "object") {
    const o = u as Record<string, unknown>;
    return {
      title: typeof o.title === "string" ? o.title : undefined,
      content: typeof o.content === "string" ? o.content : undefined,
    };
  }
  return {};
}

=======
>>>>>>> profile-settings-update
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
<<<<<<< HEAD
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
=======
      <span className="font-medium text-pink-100">{label}</span>
      <button
        type="button"
        className="mt-2 w-full p-3 bg-[#852E4E]/40 border border-pink-700/40 rounded-lg flex items-center justify-between text-white hover:bg-[#A33757]/50 transition"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-pink-100">{count > 0 ? `${count} selected` : `Select ${label.toLowerCase()}`}</span>
        <span className="text-[#FFBB94]">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-[#4C1D3D] border border-pink-700/40 rounded-lg shadow-xl shadow-pink-900/20 p-3">
>>>>>>> profile-settings-update
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
<<<<<<< HEAD
              className="w-full px-2 py-1 border rounded"
            />
            <button
              className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
=======
              className="w-full px-3 py-2 bg-[#852E4E]/40 border border-pink-700/40 rounded text-white placeholder-pink-300"
            />
            <button
              className="text-xs px-3 py-2 bg-[#852E4E] text-white rounded hover:bg-[#A33757] transition"
>>>>>>> profile-settings-update
              onClick={clearAll}
              type="button"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-56 overflow-auto space-y-1">
            {filtered.map(opt => (
              <li key={opt.id}>
<<<<<<< HEAD
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
=======
                <label className="flex items-center gap-2 px-3 py-2 rounded hover:bg-[#852E4E]/50 cursor-pointer transition">
>>>>>>> profile-settings-update
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(opt.id)}
                    onChange={() => toggle(opt.id)}
<<<<<<< HEAD
                  />
                  <span className="text-sm truncate">{opt.title || `#${opt.id}`}</span>
=======
                    className="accent-[#FB9590]"
                  />
                  <span className="text-sm truncate text-pink-100">{opt.title || `#${opt.id}`}</span>
>>>>>>> profile-settings-update
                </label>
              </li>
            ))}
            {filtered.length === 0 && (
<<<<<<< HEAD
              <li className="text-xs text-gray-500 px-2 py-1">No matches</li>
=======
              <li className="text-xs text-pink-300 px-3 py-2">No matches</li>
>>>>>>> profile-settings-update
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
<<<<<<< HEAD
  const navigate = useNavigate();
=======
>>>>>>> profile-settings-update
  // Multi-select data
  const [allNotes, setAllNotes] = useState<Array<{ id: number; title: string }>>([]);
  const [allSummaries, setAllSummaries] = useState<Array<{ id: number; title: string }>>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<number[]>([]);
  const [stateSummaryContent, setStateSummaryContent] = useState<string>("");
<<<<<<< HEAD

=======
>>>>>>> profile-settings-update

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
<<<<<<< HEAD
=======
    try {
>>>>>>> profile-settings-update
      // Load lists
      (async () => {
        try {
          const [nRes, sRes] = await Promise.all([
            fetch("/api/all_notes", { credentials: "include" }),
            fetch("/api/all_summaries", { credentials: "include" }),
          ]);
          if (nRes.ok) {
            const n = await nRes.json();
<<<<<<< HEAD
            setAllNotes(((n?.items as ComboOption[]) || []).map(x => ({ id: x.id, title: x.title })));
          }
          if (sRes.ok) {
            const s = await sRes.json();
            setAllSummaries(((s?.items as ComboOption[]) || []).map(x => ({ id: x.id, title: x.title })));
          }
        } catch (e) {
          console.warn("Failed to load notes/summaries list", e);
        }
=======
            setAllNotes(((n?.items as any[]) || []).map(x => ({ id: x.id, title: x.title })));
          }
          if (sRes.ok) {
            const s = await sRes.json();
            setAllSummaries(((s?.items as any[]) || []).map(x => ({ id: x.id, title: x.title })));
          }
        } catch {}
>>>>>>> profile-settings-update
      })();

      const qid = location.state?.quizId;
      if (typeof qid === "number") {
        // Load existing quiz for resume
        (async () => {
          setLoading(true);
          try {
            const res = await fetch(`/api/quizzes/${qid}`, { credentials: "include" });
<<<<<<< HEAD
            const data: ResumeQuizResponse = await res
              .json()
              .catch(() => ({} as ResumeQuizResponse));
            if (!res.ok) {
              setError(data?.error || `Failed to load quiz #${qid}`);
=======
            const data = await res.json().catch(() => ({} as any));
            if (!res.ok) {
              setError((data as any)?.error || `Failed to load quiz #${qid}`);
>>>>>>> profile-settings-update
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
<<<<<<< HEAD
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to load quiz";
            setError(msg);
=======
          } catch (e: any) {
            setError(e?.message || "Failed to load quiz");
>>>>>>> profile-settings-update
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
<<<<<<< HEAD
          const j = (await r.json().catch(() => ({}))) as unknown;
          const { title, content } = parseContentResp(j);
          return (title ? `# Note: ${title}\n` : "") + (content || "");
=======
          const j = await r.json().catch(() => ({} as any));
          return (j?.title ? `# Note: ${j.title}\n` : "") + (j?.content || "");
>>>>>>> profile-settings-update
        });
        const realSummaryIds = selectedSummaryIds.filter((id) => id !== -1);
        const includeProvided = selectedSummaryIds.includes(-1) ? [stateSummaryContent] : [];
        const summaryPromises = realSummaryIds.map(async (id) => {
          const r = await fetch(`/api/summaries/${id}`, { credentials: "include" });
<<<<<<< HEAD
          const j = (await r.json().catch(() => ({}))) as unknown;
          const { title, content } = parseContentResp(j);
          return (title ? `# Summary: ${title}\n` : "") + (content || "");
=======
          const j = await r.json().catch(() => ({} as any));
          return (j?.title ? `# Summary: ${j.title}\n` : "") + (j?.content || "");
>>>>>>> profile-settings-update
        });
        const parts = await Promise.all([...notePromises, ...summaryPromises]);
        combined = [...includeProvided, ...parts].filter(Boolean).join("\n\n").trim();
      }
      const payloadSummary = combined.trim();
      const res = await fetch("/api/quiz", {
<<<<<<< HEAD
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ summary: payloadSummary, size }),
    });
      const data = (await res
        .json()
        .catch(() => ({}))) as (QuizResponse & { quiz_id?: number; question_ids?: number[] }) | { error?: string };
=======
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ summary: payloadSummary, size }),
      });
      const data: (QuizResponse & { quiz_id?: number; question_ids?: number[] }) | { error?: string } = await res.json().catch(() => ({} as any));
>>>>>>> profile-settings-update
      if (!res.ok) {
        const msg = "error" in data && data.error ? data.error : `Quiz generation failed (${res.status})`;
        throw new Error(msg);
      }
      const qs = (data as QuizResponse).questions || [];
      if (!qs.length) throw new Error("No questions returned");
<<<<<<< HEAD
      setQuizId("quiz_id" in data && typeof data.quiz_id === "number" ? data.quiz_id : null);
      setQuestionIds("question_ids" in data && Array.isArray(data.question_ids) ? (data.question_ids as number[]) : []);
=======
      setQuizId((data as any)?.quiz_id ?? null);
      setQuestionIds(((data as any)?.question_ids as number[]) || []);
>>>>>>> profile-settings-update
      setQuestions(qs);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Quiz request failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD

=======
>>>>>>> profile-settings-update
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
<<<<<<< HEAD
    } catch (e) {
      console.warn("Failed to persist quiz answer", e);
    }
=======
    } catch {}
>>>>>>> profile-settings-update
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
<<<<<<< HEAD
          const data = (await getRes.json().catch(() => ({}))) as unknown as ResumeQuizResponse | { error?: string };
          if (getRes.ok && data && typeof data === "object" && "questions" in data) {
            const serverQs = (data.questions || []) as Array<{ id: number; question: string; options: string[]; correctIndex: number | null; }>;
=======
          const data = await getRes.json().catch(() => ({} as any));
          if (getRes.ok) {
            const serverQs = (data?.questions || []) as Array<{ id: number; question: string; options: string[]; correctIndex: number | null; }>;
>>>>>>> profile-settings-update
            const mapped: QuizQuestion[] = serverQs.map(q => ({ question: q.question, options: q.options || [], correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0 }));
            setQuestions(mapped.length ? mapped : null);
            setQuestionIds(serverQs.map(q => q.id));
            setIdx(0);
            setSelected(null);
            setFeedback(null);
            setScore(0);
<<<<<<< HEAD
          } else if (!getRes.ok) {
            const msg = (data && "error" in data && data.error) ? data.error : "Failed to reload quiz after reset";
            setError(msg);
          } else {
            setError("Failed to reload quiz after reset");
          }
        } else {
          const err = (await res.json().catch(() => ({}))) as unknown as { error?: string };
          setError(err && err.error ? err.error : "Failed to reset quiz");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to reset quiz";
        setError(msg);
=======
          } else {
            setError((data as any)?.error || "Failed to reload quiz after reset");
          }
        } else {
          const err = await res.json().catch(() => ({} as any));
          setError(err?.error || "Failed to reset quiz");
        }
      } catch (e: any) {
        setError(e?.message || "Failed to reset quiz");
>>>>>>> profile-settings-update
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
<<<<<<< HEAD
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
      <div className="container mx-auto max-w-3xl space-y-6 text-white">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
            Quiz Generator
          </h1>
          <p className="text-pink-100 mt-1">Create quizzes from your notes and summaries — AI-powered ✨</p>
        </div>

        {!questions && (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardHeader>
              <CardTitle>Configure Quiz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
=======
    <div className="min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 pb-12">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
            AI Quiz Generator
          </h1>
          <p className="text-pink-100 flex items-center justify-center gap-2">
            <Brain className="h-5 w-5 text-[#FB9590]" />
            Test your knowledge with AI-powered quizzes ✨
          </p>
        </div>

        {/* Form (multi-select sources) */}
        {!questions && (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#FB9590]" />
                Select Your Study Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
>>>>>>> profile-settings-update
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
<<<<<<< HEAD
                <span className="font-medium">Quiz size</span>
                <select
                  className="mt-2 p-2 border rounded bg-[#4C1D3D]/60 text-white border-pink-700/40 focus:outline-none focus:ring-2 focus:ring-pink-400/40"
                  value={size}
                  onChange={(e) => setSize(e.target.value as QuizSize)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </label>

              <div className="flex items-center justify-between">
                <Button onClick={() => navigate(-1)} className="bg-[#852E4E] hover:bg-[#A33757]">Back</Button>
                <Button
                  onClick={requestQuiz}
                  disabled={loading || disableSubmit}
                  className="bg-[#852E4E] hover:bg-[#A33757]"
                >
                  {loading ? "Generating..." : "Generate Quiz"}
                </Button>
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
            </CardContent>
          </Card>
        )}

        {questions && current && (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardHeader>
              <CardTitle>Quiz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm text-pink-200">
                <div>Question {idx + 1} / {total}</div>
                <div>Score: {score}</div>
              </div>

              <div className="text-lg font-medium text-[#FFBB94]">
                <MarkdownMathRenderer text={current.question} />
              </div>

              <div className="space-y-2">
                {current.options.map((opt, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer bg-[#852E4E]/30 border border-pink-700/30 ${selected === i ? "ring-2 ring-pink-400/40" : ""}`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      checked={selected === i}
                      onChange={() => setSelected(i)}
                    />
                    <div className="text-white">
                      <MarkdownMathRenderer text={opt} />
                    </div>
                  </label>
                ))}
              </div>

              {!feedback && (
                <Button
                  onClick={onSubmitAnswer}
                  disabled={selected == null}
                  className="bg-[#852E4E] hover:bg-[#A33757]"
                >
                  Submit Answer
                </Button>
              )}

              {feedback && (
                <div className="space-y-3">
                  <div className={feedback === "correct" ? "text-green-300" : "text-red-300"}>
                    {feedback === "correct" ? "Correct!" : "Incorrect."}
                  </div>
                  {idx < (questions.length - 1) ? (
                    <Button onClick={nextQuestion} className="bg-[#852E4E] hover:bg-[#A33757]">Next Question</Button>
                  ) : (
                    <div className="space-x-2">
                      <span className="font-medium">Finished!</span>
                      <span>Final score: {score} / {questions.length}</span>
                      <Button onClick={restart} className="ml-3 bg-[#852E4E] hover:bg-[#A33757]">{quizId ? "Retry Quiz" : "New Quiz"}</Button>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-red-300">{error}</p>}
=======
                <span className="font-medium text-pink-100">Quiz Size</span>
                <select
                  className="mt-2 w-full p-3 bg-[#852E4E]/40 border border-pink-700/40 rounded-lg text-white"
                  value={size}
                  onChange={(e) => setSize(e.target.value as QuizSize)}
                >
                  <option value="small">Small (5-10 questions)</option>
                  <option value="medium">Medium (12-18 questions)</option>
                  <option value="large">Large (25-35 questions)</option>
                  <option value="comprehensive">Comprehensive (50 questions)</option>
                </select>
              </label>

              <Button
                onClick={requestQuiz}
                disabled={disableSubmit || loading}
                className="w-full bg-gradient-to-r from-[#852E4E] to-[#A33757] hover:from-[#A33757] hover:to-[#852E4E] text-white font-semibold py-6 text-lg shadow-lg shadow-pink-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Brain className="h-5 w-5 animate-pulse" />
                    Generating Quiz...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generate Quiz
                  </span>
                )}
              </Button>
              {error && (
                <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                  <p className="text-red-200">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quiz UI */}
        {questions && (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-pink-100">
                  Question {idx + 1} of {total}
                </CardTitle>
                <div className="flex items-center gap-2 text-[#FFBB94] font-semibold">
                  <Brain className="h-5 w-5" />
                  Score: {score}/{total}
                </div>
              </div>
              <div className="w-full bg-[#852E4E] rounded-full h-2 mt-2">
                <div
                  className="bg-gradient-to-r from-[#FFBB94] to-[#FB9590] h-2 rounded-full transition-all"
                  style={{ width: `${((idx + 1) / total) * 100}%` }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {current && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-pink-50">{current.question}</h2>
                  <div className="space-y-3">
                    {current.options.map((opt, i) => {
                      const isSelected = selected === i;
                      const isCorrect = i === current.correctIndex;
                      const showCorrect = feedback && isCorrect;
                      const showIncorrect = feedback && isSelected && !isCorrect;

                      return (
                        <button
                          key={i}
                          onClick={() => {
                            if (feedback) return;
                            setSelected(i);
                          }}
                          disabled={feedback !== null}
                          className={`w-full p-4 text-left rounded-lg border-2 transition-all font-medium ${
                            showCorrect
                              ? "bg-green-900/40 border-green-500 text-green-100"
                              : showIncorrect
                              ? "bg-red-900/40 border-red-500 text-red-100"
                              : isSelected
                              ? "bg-[#A33757]/50 border-[#FB9590] text-white"
                              : "bg-[#852E4E]/30 border-pink-700/40 text-pink-100 hover:bg-[#852E4E]/50 hover:border-[#FFBB94]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {showCorrect && <CheckCircle2 className="h-5 w-5 text-green-400" />}
                            {showIncorrect && <XCircle className="h-5 w-5 text-red-400" />}
                            <span>{opt}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {!feedback && (
                    <Button
                      onClick={onSubmitAnswer}
                      disabled={selected == null}
                      className="w-full bg-gradient-to-r from-[#852E4E] to-[#A33757] hover:from-[#A33757] hover:to-[#852E4E] text-white font-semibold py-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Submit Answer
                    </Button>
                  )}

                  {feedback && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg border-2 ${
                        feedback === "correct"
                          ? "bg-green-900/30 border-green-500"
                          : "bg-red-900/30 border-red-500"
                      }`}>
                        <p className={`font-semibold flex items-center gap-2 ${
                          feedback === "correct" ? "text-green-200" : "text-red-200"
                        }`}>
                          {feedback === "correct" ? (
                            <><CheckCircle2 className="h-5 w-5" /> Correct! Great job! 🎉</>
                          ) : (
                            <><XCircle className="h-5 w-5" /> Incorrect. Keep trying! 💪</>
                          )}
                        </p>
                      </div>
                      {idx < total - 1 ? (
                        <Button
                          onClick={nextQuestion}
                          className="w-full bg-gradient-to-r from-[#852E4E] to-[#A33757] hover:from-[#A33757] hover:to-[#852E4E] text-white font-semibold py-4"
                        >
                          Next Question →
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-6 bg-gradient-to-r from-[#852E4E]/50 to-[#A33757]/50 rounded-lg border-2 border-[#FFBB94] text-center">
                            <p className="text-2xl font-bold text-[#FFBB94] mb-2">Quiz Complete! 🎊</p>
                            <p className="text-xl text-pink-100">
                              Final Score: <span className="font-bold text-[#FFBB94]">{score}</span> / {questions.length}
                            </p>
                            <p className="text-sm text-pink-200 mt-2">
                              {score === questions.length ? "Perfect score! Outstanding! 🌟" :
                               score >= questions.length * 0.8 ? "Excellent work! 🎯" :
                               score >= questions.length * 0.6 ? "Good job! Keep it up! 💪" :
                               "Keep studying, you've got this! 📚"}
                            </p>
                          </div>
                          <Button
                            onClick={restart}
                            className="w-full bg-gradient-to-r from-[#852E4E] to-[#A33757] hover:from-[#A33757] hover:to-[#852E4E] text-white font-semibold py-4"
                          >
                            <RotateCcw className="h-5 w-5 mr-2" />
                            {quizId ? "Retry Quiz" : "New Quiz"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                  <p className="text-red-200">{error}</p>
                </div>
              )}
>>>>>>> profile-settings-update
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}