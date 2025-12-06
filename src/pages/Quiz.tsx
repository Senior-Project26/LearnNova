import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MathText } from "@/components/MathText";

import { Brain, CheckCircle2, XCircle, Sparkles, RotateCcw, Link as LinkIcon } from "lucide-react";

import { sendChat } from "@/lib/chatApi";

// Types
type QuizSize = "small" | "medium" | "large" | "comprehensive";

type QuizQuestion = {
  id: number;
  question: string;
  options: string[]; // 4 options
  correctIndex: number; // 0..3
  times_correct: number;
  times_seen: number;
  correct_streak: number;
  option_counts: number[];
  userAnswer?: string | null;
  isCorrect?: boolean | null;
};

type QuizResponse = {
  questions: QuizQuestion[];
};

type ResumeQuizResponse = {
  questions?: Array<{
    id: number;
    question: string;
    options: string[];
    correctIndex: number | null;
    user_answer?: string | null;
    is_correct?: boolean | null;
    times_correct?: number;
    times_seen?: number;
    correct_streak?: number;
    option_counts?: number[];
  }>;
  next_unanswered_index?: number;
  score?: number;
  original_count?: number;
  display_correct?: number;
  display_total?: number;
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

function truncateToSentences(text: string, maxSentences: number): string {
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.slice(0, maxSentences).join(" ").trim();
}

type SuggestedResource = {
  id: string;
  title: string;
  description: string;
  url: string;
};

function buildSuggestedResources(topics: string[]): SuggestedResource[] {
  const cleanTopics = Array.from(new Set(topics.map((t) => t.trim()).filter(Boolean))).slice(0, 3);
  if (!cleanTopics.length) return [];

  const items: SuggestedResource[] = [];
  cleanTopics.forEach((topic, idx) => {
    const ytQuery = encodeURIComponent(`${topic} tutorial`);
    const khanQuery = encodeURIComponent(topic);
    const webQuery = encodeURIComponent(topic);

    items.push(
      {
        id: `yt-${idx}`,
        title: `YouTube: ${topic} tutorial`,
        description: "Watch a quick walkthrough video on this topic.",
        url: `https://www.youtube.com/results?search_query=${ytQuery}`,
      },
      {
        id: `khan-${idx}`,
        title: `Khan Academy: ${topic}`,
        description: "Concept-focused practice and explanations on Khan Academy.",
        url: `https://www.khanacademy.org/search?page_search_query=${khanQuery}`,
      },
      {
        id: `web-${idx}`,
        title: `Google search: ${topic}`,
        description: "Broader web resources and references for this topic.",
        url: `https://www.google.com/search?q=${webQuery}`,
      }
    );
  });

  return items.slice(0, 6);
}

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
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 bg-[#852E4E]/40 border border-pink-700/40 rounded text-white placeholder-pink-300"
            />
            <button
              className="text-xs px-3 py-2 bg-[#852E4E] text-white rounded hover:bg-[#A33757] transition"
              onClick={clearAll}
              type="button"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-56 overflow-auto space-y-1">
            {filtered.map(opt => (
              <li key={opt.id}>
                <label className="flex items-center gap-2 px-3 py-2 rounded hover:bg-[#852E4E]/50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(opt.id)}
                    onChange={() => toggle(opt.id)}
                    className="accent-[#FB9590]"
                  />
                  <span className="text-sm truncate text-pink-100">{opt.title || `#${opt.id}`}</span>
                </label>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-xs text-pink-300 px-3 py-2">No matches</li>
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
  const location = useLocation() as { state?: { summary?: string; quizId?: number; noteId?: number; restart?: boolean } };
  const navigate = useNavigate();
  // Multi-select data
  const [allNotes, setAllNotes] = useState<Array<{ id: number; title: string }>>([]);
  const [allSummaries, setAllSummaries] = useState<Array<{ id: number; title: string }>>([]);
  const [courses, setCourses] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<number[]>([]);
  const [stateSummaryContent, setStateSummaryContent] = useState<string>("");

  // Quiz runtime state
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [score, setScore] = useState(0);
  const [totalOverride, setTotalOverride] = useState<number | null>(null);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [questionIds, setQuestionIds] = useState<number[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [autoExplain, setAutoExplain] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [saveQuizError, setSaveQuizError] = useState<string | null>(null);
  const [saveQuizSuccess, setSaveQuizSuccess] = useState(false);
  const [suggestedResources, setSuggestedResources] = useState<SuggestedResource[]>([]);

  // Derived
  const current = questions ? questions[idx] : null;
  const total = questions ? questions.length : 0;
  const totalDisplay = totalOverride ?? total;

  // Prefill from quizId (resume) or from navigation summary / sessionStorage, and load lists
  useEffect(() => {
    try {
      // Load lists
      (async () => {
        try {
          const [nRes, sRes, cRes] = await Promise.all([
            fetch("/api/all_notes", { credentials: "include" }),
            fetch("/api/all_summaries", { credentials: "include" }),
            fetch("/api/courses", { credentials: "include" }),
          ]);
          if (nRes.ok) {
            const n = await nRes.json();
            const noteItems = ((n?.items as ComboOption[]) || []).map(x => ({ id: x.id, title: x.title }));
            setAllNotes(noteItems);
            const navNoteId = location.state?.noteId;
            if (typeof navNoteId === "number" && noteItems.some(opt => opt.id === navNoteId)) {
              setSelectedNoteIds(ids => (ids.length ? ids : [navNoteId]));
            }
          }
          if (sRes.ok) {
            const s = await sRes.json();
            setAllSummaries(((s?.items as ComboOption[]) || []).map(x => ({ id: x.id, title: x.title })));
          }
          if (cRes.ok) {
            const c = await cRes.json();
            const list = Array.isArray(c?.courses) ? c.courses as Array<{ id: number; name: string }> : [];
            setCourses(list);
            if (list.length > 0) {
              setSelectedCourseId(list[0].id);
            }
          }
        } catch (e) {
          console.warn("Failed to load notes/summaries list", e);
        }
      })();

      const qid = location.state?.quizId;
      const fromRestart = location.state?.restart === true;

      if (typeof qid === "number") {
        // Load existing quiz for resume
        (async () => {
          setLoading(true);
          try {
            const url = fromRestart ? `/api/quizzes/${qid}?mode=practice` : `/api/quizzes/${qid}`;
            const res = await fetch(url, { credentials: "include" });

            const data: ResumeQuizResponse = await res
              .json()
              .catch(() => ({} as ResumeQuizResponse));
            if (!res.ok) {
              setError(data?.error || `Failed to load quiz #${qid}`);
              setLoading(false);
              return;
            }
            const serverQs = (data?.questions || []) as Array<{
              id: number; question: string; options: string[]; correctIndex: number | null; user_answer?: string | null; is_correct?: boolean | null;
              times_correct?: number; times_seen?: number; correct_streak?: number; option_counts?: number[];
            }>;
            const mapped: QuizQuestion[] = serverQs.map(q => {
              const options = q.options || [];
              const oc = Array.isArray(q.option_counts) && q.option_counts.length === options.length
                ? q.option_counts
                : Array(options.length).fill(0);
              return ({
                id: q.id,
                question: q.question,
                options,
                correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
                times_correct: Number.isFinite(q.times_correct) ? (q.times_correct as number) : 0,
                times_seen: Number.isFinite(q.times_seen) ? (q.times_seen as number) : 0,
                correct_streak: Number.isFinite(q.correct_streak) ? (q.correct_streak as number) : 0,
                option_counts: oc,
                userAnswer: q.user_answer ?? null,
              isCorrect: typeof q.is_correct === "boolean" ? q.is_correct : null,
            });
            });
            setQuestions(mapped.length ? mapped : null);
            setQuizId(qid);
            setQuestionIds(serverQs.map(q => q.id));
            // For explicit restarts, always start at the first question of the
            // returned block. Otherwise, use backend-computed next_unanswered_index.
            let nextIdx = 0;
            if (!fromRestart) {
              const rawNext = data?.next_unanswered_index;
              if (typeof rawNext === "number" && mapped.length > 0) {
                // Clamp into [0, mapped.length - 1] just in case.
                nextIdx = Math.min(Math.max(rawNext, 0), mapped.length - 1);
              }
            }

            setIdx(nextIdx);
            // Prefer display_correct/display_total for practice/resume
            setScore(Number((data?.display_correct ?? data?.score ?? 0)));
            const denom = (typeof data?.display_total === 'number' ? data!.display_total! : (typeof data?.original_count === 'number' ? data!.original_count! : mapped.length));
            setTotalOverride(denom);
            const nextQ = mapped[nextIdx];
            if (nextQ && nextQ.userAnswer) {
              const sel = nextQ.options.indexOf(nextQ.userAnswer);
              if (sel >= 0) {
                setSelected(sel);
                setFeedback(nextQ.isCorrect ? "correct" : "incorrect");
              }
            }
            setLoading(false);
          } catch (e: unknown) {
            if (e instanceof Error) {
              setError(e.message || "Failed to load quiz");
            } else {
              setError("Failed to load quiz");
            }
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
    } catch (e) {
      console.error("Error in useEffect:", e);
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
      const topicSet = new Set<string>();
      if (selectedNoteIds.length > 0 || selectedSummaryIds.length > 0) {
        const notePromises = selectedNoteIds.map(async (id) => {
          const r = await fetch(`/api/notes/${id}`, { credentials: "include" });
          const j = (await r.json().catch(() => ({}))) as any;
          const { title, content } = parseContentResp(j);
          try {
            const topics: unknown = j?.topics;
            if (Array.isArray(topics)) {
              topics.forEach((t: any) => { const s = String(t || "").trim(); if (s) topicSet.add(s); });
            }
          } catch {}
          return (title ? `# Note: ${title}\n` : "") + (content || "");
        });
        const realSummaryIds = selectedSummaryIds.filter((id) => id !== -1);
        const includeProvided = selectedSummaryIds.includes(-1) ? [stateSummaryContent] : [];
        const summaryPromises = realSummaryIds.map(async (id) => {
          const r = await fetch(`/api/summaries/${id}`, { credentials: "include" });
          const j = (await r.json().catch(() => ({}))) as any;
          const { title, content } = parseContentResp(j);
          try {
            const topics: unknown = j?.topics;
            if (Array.isArray(topics)) {
              topics.forEach((t: any) => { const s = String(t || "").trim(); if (s) topicSet.add(s); });
            }
          } catch {}
          return (title ? `# Summary: ${title}\n` : "") + (content || "");
        });
        const parts = await Promise.all([...notePromises, ...summaryPromises]);
        combined = [...includeProvided, ...parts].filter(Boolean).join("\n\n").trim();
      }
      const payloadSummary = combined.trim();
      const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ summary: payloadSummary, size, topics: Array.from(topicSet), course_id: selectedCourseId }),
    });
      const data = (await res
        .json()
        .catch(() => ({}))) as (QuizResponse & { quiz_id?: number; question_ids?: number[] }) | { error?: string };
      if (!res.ok) {
        const message = "error" in data && typeof data.error === "string"
          ? data.error
          : `Quiz generation failed (${res.status})`;
        throw new Error(message);
      }
      const qs = (data as QuizResponse).questions || [];
      if (!qs.length) throw new Error("No questions returned");
      const qids = ("question_ids" in data && Array.isArray((data as any).question_ids)) ? ((data as any).question_ids as number[]) : [];
      const mapped: QuizQuestion[] = qs.map((q, i) => {
        const id = qids[i] ?? -(i + 1);
        const options = q.options || [];
        const oc = Array(options.length).fill(0);
        return {
          id,
          question: q.question,
          options,
          correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
          times_correct: 0,
          times_seen: 0,
          correct_streak: 0,
          option_counts: oc,
        };
      });
      const newQuizId = ("quiz_id" in data && typeof (data as any).quiz_id === "number")
        ? (data as any).quiz_id as number
        : null;
      if (newQuizId == null) {
        throw new Error("Quiz request did not return a valid quiz id; please try again.");
      }
      setQuizId(newQuizId);
      setQuestionIds(qids.length ? qids : mapped.map(m => m.id));
      setQuestions(mapped);
      setTotalOverride(mapped.length);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message || "Quiz request failed");
      } else {
        setError("Quiz request failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmitAnswer = async () => {
    if (selected == null || !current) return;
    const correct = selected === current.correctIndex;
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) setScore((s) => s + 1);

    setQuestions((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      const q = copy[idx];
      if (!q) return prev;
      copy[idx] = {
        ...q,
        userAnswer: current.options[selected],
        isCorrect: correct,
      };
      return copy;
    });

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
          // Do not send confidence yet for correct answers; we'll capture it from the UI.
          // For incorrect, backend will store confidence=0 automatically.
        }),
      });
    } catch (e) {
      console.warn("Failed to persist quiz answer", e);
    }

    // Optimistically update local stats
    setQuestions(prev => {
      if (!prev) return prev;
      const copy = [...prev];
      const q = { ...copy[idx] };
      const options = q.options || [];
      const oc = q.option_counts && q.option_counts.length === options.length ? [...q.option_counts] : Array(options.length).fill(0);
      if (selected != null && selected >= 0 && selected < oc.length) {
        oc[selected] = (oc[selected] || 0) + 1;
      }
      q.option_counts = oc;
      q.times_seen = (q.times_seen || 0) + 1;
      if (correct) {
        q.times_correct = (q.times_correct || 0) + 1;
        q.correct_streak = (q.correct_streak || 0) + 1;
      } else {
        q.correct_streak = 0;
      }
      copy[idx] = q;
      return copy;
    });

    if (autoExplain && current) {
      void requestExplanation("explain");
    }
  };

  const persistConfidenceForCurrent = async (override?: number) => {
    if (!questions || quizId == null) return;
    const qid = questionIds[idx];
    if (!qid) return;
    const conf = override ?? confidence ?? 3;
    try {
      await fetch("/api/quiz/confidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quiz_id: quizId,
          question_id: qid,
          question_number: idx + 1,
          confidence: conf,
        }),
      });
    } catch (e) {
      console.warn("Failed to persist confidence", e);
    }
  };

  const nextQuestion = async () => {
    if (!questions) return;
    if (feedback !== null) {
      await persistConfidenceForCurrent();
    }

    const next = idx + 1;
    if (next < questions.length) {
      setIdx(next);
      const q = questions[next];
      if (q && q.userAnswer) {
        const sel = q.options.indexOf(q.userAnswer);
        if (sel >= 0) {
          setSelected(sel);
          setFeedback(q.isCorrect ? "correct" : "incorrect");
          return;
        }
      }
      setSelected(null);
      setFeedback(null);
      setConfidence(null);
    }
  };

  const selectConfidence = async (val: number) => {
    setConfidence(val);
    await persistConfidenceForCurrent(val);
  };

  const restart = async () => {
    setError(null);
    if (questions && idx === questions.length - 1 && feedback !== null) {
      await persistConfidenceForCurrent();
    }
    // If resuming an existing quiz, call reset endpoint then reload it
    if (quizId) {
      try {
        setLoading(true);
        const res = await fetch(`/api/quizzes/${quizId}/reset`, { method: "POST", credentials: "include" });
        if (res.status === 204) {
          // Reload quiz from server after reset
          const getRes = await fetch(`/api/quizzes/${quizId}?mode=practice`, { credentials: "include" });
          const data = await getRes.json().catch(() => ({} as { error?: string }));
          if (getRes.ok && data && typeof data === "object" && "questions" in data) {
            const serverQs = (data.questions || []) as Array<{
              id: number; question: string; options: string[]; correctIndex: number | null;
              times_correct?: number; times_seen?: number; correct_streak?: number; option_counts?: number[]; user_answer?: string | null; is_correct?: boolean | null;
            }>;
            const mapped: QuizQuestion[] = serverQs.map((q, i) => {
              const options = q.options || [];
              const oc = Array.isArray(q.option_counts) && q.option_counts.length === options.length
                ? q.option_counts
                : Array(options.length).fill(0);
              return {
                id: q.id ?? -(i + 1),
                question: q.question,
                options,
                correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
                times_correct: Number.isFinite(q.times_correct) ? (q.times_correct as number) : 0,
                times_seen: Number.isFinite(q.times_seen) ? (q.times_seen as number) : 0,
                correct_streak: Number.isFinite(q.correct_streak) ? (q.correct_streak as number) : 0,
                userAnswer: q.user_answer ?? null,
                isCorrect: typeof q.is_correct === "boolean" ? q.is_correct : null,
                option_counts: oc,
              };
            });
            setQuestions(mapped.length ? mapped : null);
            setQuestionIds(mapped.map(q => q.id));
            setIdx(0);
            setSelected(null);
            setFeedback(null);
            setScore(0);
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
      } finally {
        setLoading(false);
      }
      return;
    }
    // Otherwise, local reset for a new quiz flow: restart from the beginning of
    // the existing questions instead of returning to the generator form.
    setIdx(0);
    setSelected(null);
    setFeedback(null);
    setScore(0);
    setSaveQuizError(null);
    setSaveQuizSuccess(false);
    setSuggestedResources([]);
  };

  const saveQuiz = async () => {
    if (!quizId) {
      setSaveQuizError("This quiz cannot be saved because its ID is missing.");
      return;
    }
    setSavingQuiz(true);
    setSaveQuizError(null);
    setSaveQuizSuccess(false);
    try {
      const defaultTitle = `Quiz #${quizId}`;
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: defaultTitle }),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setSaveQuizError((data && data.error) || "Failed to save quiz.");
        return;
      }
      setSaveQuizSuccess(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save quiz.";
      setSaveQuizError(msg);
    } finally {
      setSavingQuiz(false);
    }
  };

  const requestExplanation = async (mode: "tutor" | "explain") => {
    if (!current) return;
    setExplaining(true);
    setExplainError(null);
    setExplanation(null);
    const userAnswer = selected != null && current.options[selected] ? current.options[selected] : null;
    const lines: string[] = [];
    lines.push("I am working on a multiple-choice quiz question.");
    lines.push("Explain the reasoning in at most 2 short sentences. Do not write a long paragraph or bullet list.");
    lines.push("Question:");
    lines.push(current.question);
    lines.push("");
    lines.push("Options:");
    current.options.forEach((opt, i) => {
      lines.push(`${i + 1}. ${opt}`);
    });
    if (userAnswer) {
      lines.push("");
      lines.push(`My selected answer: ${userAnswer}`);
      if (feedback === "correct") {
        lines.push("I answered correctly.");
      } else if (feedback === "incorrect") {
        lines.push("I answered incorrectly.");
      }
    }
    const prompt = lines.join("\n");
    let full = "";
    try {
      await sendChat(
        [{ role: "user", content: prompt }],
        mode === "tutor"
          ? { tutorNoAnswer: true }
          : {},
        {
          onToken: (delta) => {
            full += delta;
            setExplanation((prev) => (prev ?? "") + delta);
          },
          onDone: () => {
            setExplaining(false);
            if (!full) {
              setExplainError("The assistant did not return an explanation. Please try again.");
            } else {
              setExplanation(truncateToSentences(full, 2));
            }
          },
          onError: (err) => {
            setExplaining(false);
            if (err.message === "auth") {
              setExplainError("Sign in to use the assistant.");
            } else if (err.message === "rate") {
              setExplainError("You are being rate limited. Please wait a moment and try again.");
            } else {
              setExplainError(err.message || "The assistant encountered an error.");
            }
          },
        }
      );
    } catch (e: unknown) {
      setExplaining(false);
      if (e instanceof Error) {
        setExplainError(e.message || "The assistant encountered an error.");
      } else {
        setExplainError("The assistant encountered an error.");
      }
    }
  };

  useEffect(() => {
    if (!questions || !questions.length) return;
    if (idx !== questions.length - 1) return;
    if (feedback === null) return;

    (async () => {
      let topicLabels: string[] = [];

      // 1) Prefer backend topics from the quiz record if available
      if (quizId) {
        try {
          const res = await fetch(`/api/quizzes/${quizId}`, { credentials: "include" });
          if (res.ok) {
            const data = await res.json().catch(() => ({} as { topics?: unknown }));
            const rawTopics = (data && (data as { topics?: unknown }).topics) as unknown;
            if (Array.isArray(rawTopics)) {
              topicLabels = rawTopics
                .map((t) => String(t || "").trim())
                .filter((t) => t.length > 0);
            }
          }
        } catch {
          // ignore and fall back
        }
      }

      // 2) Fallback: derive simple labels from missed questions' text
      if (!topicLabels.length) {
        const missed = questions.filter((q) => q.isCorrect === false);
        missed.forEach((q) => {
          const raw = q.question || "";
          const firstSentence = raw.split(/[.!?]/)[0] || raw;
          const words = firstSentence.split(/\s+/).filter(Boolean).slice(0, 8);
          const label = words.join(" ").trim();
          if (label) topicLabels.push(label);
        });
      }

      if (!topicLabels.length) return;

      const resources = buildSuggestedResources(topicLabels);
      setSuggestedResources(resources);

      if (resources.length) {
        const topicSummary = topicLabels.slice(0, 3).join("; ");
        const lines: string[] = [];
        lines.push(`Here are some resources that could help deepen your understanding of these quiz topics: ${topicSummary}.`);
        lines.push("");
        resources.forEach((r, i) => {
          lines.push(`${i + 1}. ${r.title} -> ${r.url}`);
        });
        const prompt = lines.join("\n");
        window.dispatchEvent(new CustomEvent("learnnova:openChatWithPrompt", { detail: { prompt } }));
      }
    })();
  }, [questions, idx, feedback, quizId]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 pb-12">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
            AI Quiz Generator
          </h1>
          <p className="text-pink-100 flex items-center justify-center gap-2">
            <Brain className="h-5 w-5 text-[#FB9590]" />
            Test your knowledge with AI-powered quizzes 
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

              <div className="grid md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="font-medium text-pink-100">Quiz Size</span>
                  <div className="mt-2">
                    <Select value={size} onValueChange={(v) => setSize(v as QuizSize)}>
                      <SelectTrigger className="w-full bg-[#852E4E]/40 border border-pink-700/40 text-white">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#4C1D3D] text-white border-pink-700/60">
                        <SelectItem value="small">Small (5-10 questions)</SelectItem>
                        <SelectItem value="medium">Medium (12-18 questions)</SelectItem>
                        <SelectItem value="large">Large (25-35 questions)</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive (50 questions)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </label>

                <label className="block">
                  <span className="font-medium text-pink-100">Course</span>
                  <div className="mt-2">
                    <Select
                      value={selectedCourseId !== null ? String(selectedCourseId) : "none"}
                      onValueChange={(val) => {
                        if (val === "none") {
                          setSelectedCourseId(null);
                        } else {
                          setSelectedCourseId(Number(val));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full bg-[#852E4E]/40 border border-pink-700/40 text-white">
                        <SelectValue placeholder={courses.length ? "No course" : "No courses available"} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#4C1D3D] text-white border-pink-700/60">
                        <SelectItem value="none">No course</SelectItem>
                        {courses.length === 0 && (
                          <SelectItem value="empty" disabled>
                            No courses available
                          </SelectItem>
                        )}
                        {courses.length > 0 && courses.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </label>
              </div>

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
                  Score: {score}/{totalDisplay}
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
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap break-words">
                    <MathText text={current.question} />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-pink-100">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[#FFBB94] hover:text-white underline decoration-[#FFBB94]"
                      onClick={() => {
                        if (!current) return;
                        const lines: string[] = [];
                        lines.push("I am working on a multiple-choice quiz question.");
                        lines.push("Please give a short, concise explanation (ideally 2–3 sentences). Do not write a long essay.");
                        lines.push("Question:");
                        lines.push(current.question);
                        lines.push("");
                        lines.push("Options:");
                        current.options.forEach((opt, i) => {
                          lines.push(`${i + 1}. ${opt}`);
                        });
                        const prompt = lines.join("\n");
                        window.dispatchEvent(new CustomEvent("learnnova:openChatWithPrompt", { detail: { prompt } }));
                      }}
                      disabled={explaining}
                    >
                      <Brain className="h-4 w-4" />
                      Need help? Ask the assistant
                    </button>

                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-[#FB9590]"
                        checked={autoExplain}
                        onChange={(e) => setAutoExplain(e.target.checked)}
                      />
                      <span>Explain each question after I answer</span>
                    </label>
                  </div>
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
                            <div className="flex-1 min-w-0 prose prose-invert max-w-none whitespace-pre-wrap break-words">
                              <MathText text={opt} />
                            </div>
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
                      {/* Answer history toggle */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowHistory(s => !s)}
                          className="text-sm text-[#FFBB94] hover:underline"
                        >
                          {showHistory ? "Hide" : "Show"} answer history
                        </button>
                      </div>
                      {showHistory && (
                        <div className="p-4 bg-[#852E4E]/30 border border-pink-700/40 rounded-lg space-y-3">
                          <p className="text-pink-100 font-medium">Answer history</p>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="text-sm text-pink-200">Times seen: <span className="text-pink-100 font-semibold">{current.times_seen ?? 0}</span></div>
                            <div className="text-sm text-pink-200">Times correct: <span className="text-pink-100 font-semibold">{current.times_correct ?? 0}</span></div>
                            <div className="text-sm text-pink-200">Current streak: <span className="text-pink-100 font-semibold">{current.correct_streak ?? 0}</span></div>
                          </div>
                          <div>
                            <p className="text-sm text-pink-200 mb-2">Per-option selections:</p>
                            <ul className="space-y-2">
                              {current.options.map((opt, i) => (
                                <li key={i} className={`flex items-start gap-2 text-sm ${i===current.correctIndex ? "text-green-200" : "text-pink-200"}`}>
                                  <span className="min-w-[2rem] inline-block text-right text-pink-300">{(current.option_counts?.[i] ?? 0)}×</span>
                                  <div className="flex-1 prose prose-invert max-w-none whitespace-pre-wrap break-words">
                                    <MathText text={opt} />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      {feedback === "correct" && (
                        <div className="space-y-3">
                          <p className="text-pink-100 font-medium text-center">How confident were you on your answer?</p>
                          <div className="flex gap-2">
                            {[1,2,3,4,5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => selectConfidence(n)}
                                className={`flex-1 p-3 rounded-lg border-2 transition-all font-semibold text-center ${
                                  confidence === n
                                    ? "bg-[#A33757]/60 border-[#FFBB94] text-white"
                                    : "bg-[#852E4E]/30 border-pink-700/40 text-pink-100 hover:bg-[#852E4E]/50 hover:border-[#FFBB94]"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {(explanation || explaining || explainError) && (
                        <div className="p-4 rounded-lg bg-[#852E4E]/40 border border-pink-700/40 space-y-2">
                          <div className="flex items-center gap-2 text-pink-100 text-sm font-semibold">
                            <Brain className="h-4 w-4" />
                            <span>Assistant explanation</span>
                          </div>
                          {explaining && (
                            <p className="text-xs text-pink-100">Generating explanation…</p>
                          )}
                          {explanation && (
                            <p className="text-sm text-pink-100 whitespace-pre-wrap break-words">
                              {explanation}
                            </p>
                          )}
                          {explainError && (
                            <p className="text-xs text-red-200">{explainError}</p>
                          )}
                        </div>
                      )}
                      {idx < total - 1 ? (
                        <Button
                          onClick={nextQuestion}
                          disabled={feedback === "correct" && confidence == null}
                          className="w-full bg-gradient-to-r from-[#852E4E] to-[#A33757] hover:from-[#A33757] hover:to-[#852E4E] text-white font-semibold py-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          {suggestedResources.length > 0 && (
                            <div className="p-5 rounded-lg bg-[#4C1D3D]/80 border border-pink-700/60 space-y-3">
                              <div className="flex items-center gap-2 text-[#FFBB94]">
                                <LinkIcon className="h-4 w-4" />
                                <span className="font-semibold text-sm">Here are some resources that could help deepen your understanding:</span>
                              </div>
                              <ul className="space-y-2 text-sm text-pink-100">
                                {suggestedResources.map((r) => (
                                  <li key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                    <div>
                                      <div className="font-medium">{r.title}</div>
                                      <div className="text-xs text-pink-200">{r.description}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => window.open(r.url, "_blank", "noopener,noreferrer")}
                                      className="mt-1 sm:mt-0 inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs bg-[#FFBB94] text-[#4C1D3D] font-semibold hover:bg-[#FB9590] transition"
                                    >
                                      Open link
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-[11px] text-pink-200/80">
                                These links are based on general searches (YouTube, Khan Academy, and web docs) for topics you missed.
                              </p>
                            </div>
                          )}
                          <Button
                            onClick={saveQuiz}
                            disabled={savingQuiz || !quizId}
                            className="w-full bg-[#852E4E] hover:bg-[#A33757] text-white font-semibold py-4 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {savingQuiz ? "Saving quiz..." : "Save Quiz to Dashboard"}
                          </Button>
                          {saveQuizSuccess && (
                            <p className="text-sm text-green-200 text-center">Quiz saved. You can find it under Dashboard → Quizzes.</p>
                          )}
                          {saveQuizError && (
                            <p className="text-sm text-red-200 text-center">{saveQuizError}</p>
                          )}
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}