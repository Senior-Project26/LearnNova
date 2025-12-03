import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MathText } from "@/components/MathText";
import { 
  Brain, 
  BookOpen, 
  FileText, 
  Trash2, 
  Edit3, 
  Play, 
  RotateCcw, 
  TrendingUp,
  Clock,
  CheckCircle2,
  Sparkles
} from "lucide-react";

type QuizItem = { id: number; created_at: string | null; score: number; question_count: number; answered_count?: number; completed?: boolean; title?: string; course_id?: number | null; topics?: string[] };
type NoteItem = { id: number; title: string; updated_at: string | null; course_id?: number | null; topics?: string[] };
type SummaryItem = { id: number; title?: string; created_at?: string | null; course_id?: number | null; topics?: string[] };

const Dashboard = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizItem[] | null>(null);
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [summaries, setSummaries] = useState<SummaryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSummaryId, setOpenSummaryId] = useState<number | null>(null);
  const [openSummary, setOpenSummary] = useState<{ id: number; title: string; content: string; topics?: string[] } | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [summaryTitleInput, setSummaryTitleInput] = useState("");
  const [savingSummaryTitle, setSavingSummaryTitle] = useState(false);
  // Note modal state
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
  const [openNote, setOpenNote] = useState<{ id: number; title: string; content: string } | null>(null);
  const [openNoteLoading, setOpenNoteLoading] = useState(false);
  const [noteTitleInput, setNoteTitleInput] = useState("");
  const [savingNoteTitle, setSavingNoteTitle] = useState(false);

  // Delete confirmation modal state
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: "note"; id: number; title?: string }
    | { kind: "summary"; id: number; title?: string }
    | { kind: "quiz"; id: number; title?: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  // Quiz modal state (rename and continue)
  const [openQuizId, setOpenQuizId] = useState<number | null>(null);
  const [openQuizLoading, setOpenQuizLoading] = useState(false);
  const [quizTitleInput, setQuizTitleInput] = useState("");
  const [savingQuizTitle, setSavingQuizTitle] = useState(false);
  const [quizTitleSaved, setQuizTitleSaved] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const toTitleCase = (s: string) => s.split(/\s+/).map(w => w ? (w[0].toUpperCase() + w.slice(1)) : w).join(" ");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [qRes, nRes, sRes, cRes] = await Promise.all([
          fetch("/api/dashboard/quizzes", { credentials: "include" }),
          fetch("/api/dashboard/notes", { credentials: "include" }),
          fetch("/api/all_summaries", { credentials: "include" }),
          fetch("/api/courses", { credentials: "include" }),
        ]);
        if (!mounted) return;
        if (qRes.status === 401 || nRes.status === 401 || sRes.status === 401 || cRes.status === 401) {
          setError("Unauthorized. Please sign in.");
          setQuizzes([]);
          setNotes([]);
          setSummaries([]);
          setCourses([]);
          return;
        }
        const [qJson, nJson, sJson, cJson] = await Promise.all([qRes.json(), nRes.json(), sRes.json(), cRes.json()]);
        setQuizzes(qJson.items || []);
        setNotes(nJson.items || []);
        setSummaries(sJson.items || []);
        const list = Array.isArray(cJson.courses) ? cJson.courses : [];
        setCourses(list.map((c: any) => ({ id: Number(c.id), name: String(c.name || "") })));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load dashboard data");
        setQuizzes([]);
        setNotes([]);
        setSummaries([]);
        setCourses([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openSummaryModal = async (id: number) => {
    try {
      setOpenLoading(true);
      setOpenSummary(null);
      setOpenSummaryId(id);
      const res = await fetch(`/api/summaries/${id}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && typeof data.content === "string") {
        const title = data.title || `Summary #${id}`;
        setOpenSummary({ id: data.id, title, content: data.content, topics: (Array.isArray(data.topics) ? data.topics : []) });
        setSummaryTitleInput(title);
      } else {
        const title = `Summary #${id}`;
        setOpenSummary({ id, title, content: data?.error || "Failed to load summary.", topics: [] });
        setSummaryTitleInput(title);
      }
    } catch (e: any) {
      const title = `Summary #${id}`;
      setOpenSummary({ id, title, content: e?.message || "Failed to load summary." });
      setSummaryTitleInput(title);
    } finally {
      setOpenLoading(false);
    }
  };

  // No auto-focus on modal open; user opts in to rename

  const openNoteModal = async (id: number) => {
    try {
      setOpenNoteLoading(true);
      setOpenNote(null);
      setOpenNoteId(id);
      const res = await fetch(`/api/notes/${id}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && typeof data.content === "string") {
        const title = data.title || `Note #${id}`;
        setOpenNote({ id: data.id, title, content: data.content });
        setNoteTitleInput(title);
      } else {
        const title = `Note #${id}`;
        setOpenNote({ id, title, content: data?.error || "Failed to load note." });
        setNoteTitleInput(title);
      }
    } catch (e: any) {
      const title = `Note #${id}`;
      setOpenNote({ id, title, content: e?.message || "Failed to load note." });
      setNoteTitleInput(title);
    } finally {
      setOpenNoteLoading(false);
    }
  };

  const topicOptions = useMemo(() => {
    const set = new Set<string>();
    (summaries || []).forEach(s => (s.topics || []).forEach(t => set.add((t || "").trim())));
    (notes || []).forEach(n => (n.topics || []).forEach(t => set.add((t || "").trim())));
    (quizzes || []).forEach(q => (q.topics || []).forEach(t => set.add((t || "").trim())));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [summaries, notes, quizzes]);

  const matchesFilters = (courseId?: number | null, topics?: string[]) => {
    const byCourse = selectedCourseId ? (courseId === selectedCourseId) : true;
    const byTopic = selectedTopic ? ((topics || []).some(t => (t || "").toLowerCase() === selectedTopic.toLowerCase())) : true;
    if (selectedCourseId && selectedTopic) return byCourse && byTopic;
    return byCourse && byTopic;
  };

  const filteredSummaries = useMemo(() => (summaries || []).filter(s => matchesFilters(s.course_id ?? null, s.topics || [])), [summaries, selectedCourseId, selectedTopic]);
  const filteredNotes = useMemo(() => (notes || []).filter(n => matchesFilters(n.course_id ?? null, n.topics || [])), [notes, selectedCourseId, selectedTopic]);
  const filteredQuizzes = useMemo(() => (quizzes || []).filter(q => matchesFilters(q.course_id ?? null, q.topics || [])), [quizzes, selectedCourseId, selectedTopic]);

  // Small helper component to render accurate per-run results for a quiz list item
  function QuizResultBadge({ quizId, fallbackCorrect, fallbackTotal }: { quizId: number; fallbackCorrect: number; fallbackTotal: number }) {
    const [dc, setDc] = useState<number | null>(null);
    const [dt, setDt] = useState<number | null>(null);
    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const res = await fetch(`/api/quizzes/${quizId}`, { credentials: "include" });
          const data = await res.json().catch(() => ({}));
          if (!mounted) return;
          const dcor = typeof data?.display_correct === 'number' ? data.display_correct : null;
          const dtot = typeof data?.display_total === 'number' ? data.display_total : (typeof data?.original_count === 'number' ? data.original_count : null);
          if (dcor !== null) setDc(dcor);
          if (dtot !== null) setDt(dtot);
        } catch {}
      })();
      return () => { mounted = false; };
    }, [quizId]);
    const correct = (dc ?? fallbackCorrect) || 0;
    const total = (dt ?? fallbackTotal) || 0;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const good = pct >= 70;
    return (
      <Badge
        variant={good ? 'default' : 'secondary'}
        className={`text-xs ${good ? 'bg-green-900/40 text-green-200 border-green-700/50' : 'bg-[#852E4E] text-[#FFBB94] border-pink-700/40'}`}
      >
        Result: {correct}/{total} ({pct}%)
      </Badge>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pt-24 pb-12">
        
        {/* Welcome Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text mb-2">
            Welcome Back!
          </h1>
          <p className="text-pink-100 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FB9590]" />
            Continue your learning journey
          </p>
        </div>

        <Card className="mb-6 bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="text-pink-100">Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-pink-200">Course</span>
                <select
                  value={selectedCourseId ?? ""}
                  onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : null)}
                  className="px-3 py-2 rounded-lg bg-[#4C1D3D] border border-pink-700/60 text-[#FFBB94] focus:outline-none appearance-none"
                  style={{ backgroundColor: '#4C1D3D', color: '#FFBB94' }}
                >
                  <option value="">All</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-pink-200">Topic</span>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#4C1D3D] border border-pink-700/60 text-[#FFBB94] focus:outline-none appearance-none"
                  style={{ backgroundColor: '#4C1D3D', color: '#FFBB94' }}
                >
                  <option value="">All</option>
                  {topicOptions.map(t => (
                    <option key={t} value={t}>{toTitleCase(t)}</option>
                  ))}
                </select>
              </div>
              {(selectedCourseId !== null || selectedTopic) && (
                <button
                  className="px-3 py-2 rounded-lg bg-[#A33757] hover:bg-[#DC586D] text-white"
                  onClick={() => { setSelectedCourseId(null); setSelectedTopic(""); }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-200">{error}</div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
        {/* Quizzes */}
        <Card className="md:col-span-1 bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20 hover:shadow-2xl hover:shadow-pink-900/30 transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                <Brain className="h-5 w-5 text-[#FB9590]" />
              </div>
              <span className="text-pink-100">Quizzes</span>
              {quizzes && quizzes.length > 0 && (
                <Badge variant="secondary" className="ml-auto bg-[#852E4E] text-[#FFBB94] border-none">{quizzes.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quizzes === null ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-pulse text-pink-200">Loading...</div>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 mx-auto text-pink-300/30 mb-3" />
                <p className="text-pink-200">No quizzes yet</p>
                <p className="text-sm text-pink-300/70">Create your first quiz to get started!</p>
              </div>
            ) : (
              <div className={`${(quizzes?.length || 0) > 10 ? 'max-h-96 overflow-y-auto' : ''}`}>
                <ul className="space-y-3">
                  {filteredQuizzes.map((q) => (
                    <li key={q.id}>
                      <div className="group w-full flex flex-col gap-2 text-sm p-3 rounded-lg border border-pink-700/30 bg-[#852E4E]/20 hover:bg-[#852E4E]/30 hover:shadow-lg hover:shadow-pink-900/20 transition-all">
                        <button
                          className="text-left flex items-start gap-2 flex-1"
                          onClick={async () => {
                            try {
                              setOpenQuizLoading(true);
                              setOpenQuizId(q.id);
                              const res = await fetch(`/api/quizzes/${q.id}`, { credentials: "include" });
                              const data = await res.json().catch(() => ({}));
                              const title = (data?.title as string) || `Quiz #${q.id}`;
                              setQuizTitleInput(title);
                              setQuizTitleSaved(false);
                            } catch {}
                            finally {
                              setOpenQuizLoading(false);
                            }
                          }}
                        >
                          <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${q.completed ? 'text-green-400' : 'text-pink-300/30'}`} />
                          <div className="flex-1">
                            <div className="font-medium text-pink-100">{q.title?.trim() ? q.title : `Quiz #${q.id}`}</div>
                            <div className="text-xs text-pink-300/70 mt-1">{q.question_count} Questions</div>
                          </div>
                        </button>
                        <div className="flex items-center justify-between gap-2 pl-6">
                          <QuizResultBadge quizId={q.id} fallbackCorrect={typeof q.score === 'number' ? q.score : 0} fallbackTotal={typeof q.question_count === 'number' ? q.question_count : 0} />
                          <div className="flex items-center gap-1">
                            {q.completed && (
                              <button
                                className="text-xs px-2 py-1 rounded-md bg-[#852E4E]/60 text-[#FFBB94] hover:bg-[#A33757] transition-colors flex items-center gap-1"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/quizzes/${q.id}/reset`, { method: "POST", credentials: "include" });
                                    if (res.status === 204) {
                                      navigate("/quiz", { state: { quizId: q.id } });
                                    }
                                  } catch {}
                                }}
                              >
                                <RotateCcw className="h-3 w-3" />
                                Retry
                              </button>
                            )}
                            <button
                              className="text-xs p-1.5 rounded-md bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors"
                              onClick={() => setConfirmDelete({ kind: "quiz", id: q.id, title: (q.title?.trim() ? q.title! : `Quiz #${q.id}`) })}
                              title="Delete quiz"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="md:col-span-1 bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20 hover:shadow-2xl hover:shadow-pink-900/30 transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                <FileText className="h-5 w-5 text-[#FB9590]" />
              </div>
              <span className="text-pink-100">Notes</span>
              {notes && notes.length > 0 && (
                <Badge variant="secondary" className="ml-auto bg-[#852E4E] text-[#FFBB94] border-none">{notes.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notes === null ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-pulse text-pink-200">Loading...</div>
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-pink-300/30 mb-3" />
                <p className="text-pink-200">No notes yet</p>
                <p className="text-sm text-pink-300/70">Start taking notes from your materials!</p>
              </div>
            ) : (
              <div className={`${(notes?.length || 0) > 10 ? 'max-h-96 overflow-y-auto' : ''}`}>
                <ul className="space-y-2">
                  {filteredNotes.map((n) => (
                    <li key={n.id} className="group flex items-center gap-2 p-3 rounded-lg border border-pink-700/30 bg-[#852E4E]/20 hover:bg-[#852E4E]/30 hover:shadow-lg hover:shadow-pink-900/20 transition-all">
                      <Edit3 className="h-4 w-4 text-[#FB9590] flex-shrink-0" />
                      <button
                        className="flex-1 text-left text-sm truncate font-medium text-pink-100"
                        onClick={() => openNoteModal(n.id)}
                      >
                        {n.title || `Note #${n.id}`}
                      </button>
                      <button
                        className="p-1.5 rounded-md bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors"
                        onClick={() => setConfirmDelete({ kind: "note", id: n.id, title: n.title })}
                        title="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summaries */}
        <Card className="md:col-span-1 bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20 hover:shadow-2xl hover:shadow-pink-900/30 transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                <BookOpen className="h-5 w-5 text-[#FB9590]" />
              </div>
              <span className="text-pink-100">Summaries</span>
              {summaries && summaries.length > 0 && (
                <Badge variant="secondary" className="ml-auto bg-[#852E4E] text-[#FFBB94] border-none">{summaries.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaries === null ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-pulse text-pink-200">Loading...</div>
              </div>
            ) : summaries.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-pink-300/30 mb-3" />
                <p className="text-pink-200">No summaries yet</p>
                <p className="text-sm text-pink-300/70">Upload content to generate summaries!</p>
              </div>
            ) : (
              <div className={`${(summaries?.length || 0) > 10 ? 'max-h-96 overflow-y-auto' : ''}`}>
                <ul className="space-y-2">
                  {filteredSummaries.map((s) => (
                    <li key={s.id} className="group flex items-center gap-2 p-3 rounded-lg border border-pink-700/30 bg-[#852E4E]/20 hover:bg-[#852E4E]/30 hover:shadow-lg hover:shadow-pink-900/20 transition-all">
                      <Sparkles className="h-4 w-4 text-[#FB9590] flex-shrink-0" />
                      <button
                        className="flex-1 text-left text-sm truncate font-medium text-pink-100"
                        onClick={() => openSummaryModal(s.id)}
                      >
                        {s.title || `Summary #${s.id}`}
                      </button>
                      <button
                        className="p-1.5 rounded-md bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={() => setConfirmDelete({ kind: "summary", id: s.id, title: s.title })}
                        title="Delete summary"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keep existing sections at the bottom spanning full width */}
        <Card className="md:col-span-3 bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20 hover:shadow-2xl hover:shadow-pink-900/30 transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                <TrendingUp className="h-6 w-6 text-[#FB9590]" />
              </div>
              <span className="text-pink-100">Your Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <TrendingUp className="h-16 w-16 mx-auto text-pink-300/20 mb-4" />
              <p className="text-pink-200">Progress tracking coming soon!</p>
              <p className="text-sm text-pink-300/70 mt-1">Charts and analytics will appear here</p>
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-3 bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20 hover:shadow-2xl hover:shadow-pink-900/30 transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                <Clock className="h-5 w-5 text-[#FB9590]" />
              </div>
              <span className="text-pink-100">Study Guides</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecentStudyGuides />
          </CardContent>
        </Card>
      </div>
      </div>

      {/* Summary Modal */}
      <Dialog open={openSummaryId !== null} onOpenChange={(open) => { if (!open) { setOpenSummaryId(null); setOpenSummary(null); } }}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Summary</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={summaryTitleInput}
                onChange={(e) => setSummaryTitleInput(e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
              <button
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-60"
                disabled={savingSummaryTitle || !openSummaryId}
                onClick={async () => {
                  if (!openSummaryId) return;
                  const title = summaryTitleInput.trim();
                  if (!title) return;
                  try {
                    setSavingSummaryTitle(true);
                    const res = await fetch(`/api/summaries/${openSummaryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title }) });
                    if (res.ok) {
                      setOpenSummary((prev) => (prev ? { ...prev, title } : prev));
                      setSummaries((prev) => (prev || []).map(s => s.id === openSummaryId ? { ...s, title } : s));
                    }
                  } finally {
                    setSavingSummaryTitle(false);
                  }
                }}
              >
                Save
              </button>
            </div>
            {openLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <>
                <div className="bg-gray-50 p-4 rounded border text-sm max-h-[60vh] overflow-auto whitespace-pre-wrap break-words">
                  <MathText text={openSummary?.content || ""} />
                </div>
                {openSummary?.topics && openSummary.topics.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-700 mb-2">Topics</div>
                    <div className="flex flex-wrap gap-2">
                      {openSummary.topics.map((t, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-full bg-[#852E4E]/10 text-[#852E4E] border border-[#852E4E]/30 text-xs">
                          {toTitleCase(t)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Modal (rename or continue) */}
      <Dialog open={openQuizId !== null} onOpenChange={(open) => { if (!open) { setOpenQuizId(null); } }}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Quiz</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={quizTitleInput}
                onChange={(e) => { setQuizTitleInput(e.target.value); setQuizTitleSaved(false); }}
                className="w-full px-2 py-1 border rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                className="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
                disabled={!openQuizId || openQuizLoading || savingQuizTitle || !quizTitleInput.trim()}
                onClick={async () => {
                  if (!openQuizId) return;
                  const title = quizTitleInput.trim();
                  if (!title) return;
                  try {
                    setSavingQuizTitle(true);
                    const res = await fetch(`/api/quizzes/${openQuizId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title }) });
                    if (!res.ok) {
                      // optionally surface error
                      return;
                    }
                    setQuizTitleSaved(true);
                  } catch {}
                  finally {
                    setSavingQuizTitle(false);
                  }
                }}
              >
                {savingQuizTitle ? 'Saving…' : (quizTitleSaved ? 'Saved' : 'Save')}
              </button>
              <button
                className="w-full px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
                disabled={!openQuizId || openQuizLoading}
                onClick={async () => {
                  if (!openQuizId) return;
                  try {
                    const res = await fetch(`/api/quizzes/${openQuizId}`, { credentials: "include" });
                    if (!res.ok) return;
                    const data = await res.json();
                    const total = (data?.questions?.length ?? 0);
                    const nextIdx = data?.next_unanswered_index ?? 0;
                    if (total > 0 && nextIdx < total) {
                      navigate("/quiz", { state: { quizId: openQuizId } });
                    } else {
                      // If completed, allow retry via reset then continue
                      const reset = await fetch(`/api/quizzes/${openQuizId}/reset`, { method: "POST", credentials: "include" });
                      if (reset.status === 204) {
                        navigate("/quiz", { state: { quizId: openQuizId } });
                      }
                    }
                  } catch {}
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note Modal */}
      <Dialog open={openNoteId !== null} onOpenChange={(open) => { if (!open) { setOpenNoteId(null); setOpenNote(null); } }}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Note</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={noteTitleInput}
                onChange={(e) => setNoteTitleInput(e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
              <button
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-60"
                disabled={savingNoteTitle || !openNoteId}
                onClick={async () => {
                  if (!openNoteId) return;
                  const title = noteTitleInput.trim();
                  if (!title) return;
                  try {
                    setSavingNoteTitle(true);
                    const res = await fetch(`/api/notes/${openNoteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title }) });
                    if (res.ok) {
                      setOpenNote((prev) => (prev ? { ...prev, title } : prev));
                      setNotes((prev) => (prev || []).map(n => n.id === openNoteId ? { ...n, title } : n));
                    }
                  } finally {
                    setSavingNoteTitle(false);
                  }
                }}
              >
                Save
              </button>
            </div>
            {openNoteLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="bg-gray-50 p-4 rounded border text-sm max-h-[60vh] overflow-auto whitespace-pre-wrap break-words">
                <MathText text={openNote?.content || ""} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {confirmDelete?.kind === "note" && "Delete this note"}
              {confirmDelete?.kind === "summary" && "Delete this summary"}
              {confirmDelete?.kind === "quiz" && "Delete this quiz"}
              {confirmDelete?.title ? `: "${confirmDelete.title}"?` : "?"}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-3 py-1.5 rounded border"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-60"
                disabled={deleting}
                onClick={async () => {
                  if (!confirmDelete) return;
                  try {
                    setDeleting(true);
                    if (confirmDelete.kind === "note") {
                      const res = await fetch(`/api/notes/${confirmDelete.id}`, { method: "DELETE", credentials: "include" });
                      if (res.status === 204) {
                        setNotes((prev) => (prev || []).filter((x) => x.id !== confirmDelete.id));
                        if (openNoteId === confirmDelete.id) { setOpenNoteId(null); setOpenNote(null); }
                      }
                    } else if (confirmDelete.kind === "summary") {
                      const res = await fetch(`/api/summaries/${confirmDelete.id}`, { method: "DELETE", credentials: "include" });
                      if (res.status === 204) {
                        setSummaries((prev) => (prev || []).filter((x) => x.id !== confirmDelete.id));
                        if (openSummaryId === confirmDelete.id) { setOpenSummaryId(null); setOpenSummary(null); }
                      }
                    } else {
                      const res = await fetch(`/api/quizzes/${confirmDelete.id}`, { method: "DELETE", credentials: "include" });
                      if (res.status === 204) {
                        setQuizzes((prev) => (prev || []).filter((x) => x.id !== confirmDelete.id));
                      }
                    }
                  } catch {}
                  finally {
                    setDeleting(false);
                    setConfirmDelete(null);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;

// RecentStudyGuides subcomponent
function RecentStudyGuides() {
  const [items, setItems] = useState<Array<{ id: number; title: string }>>([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dashboard/study_guides', { credentials: 'include' });
        const j = await res.json().catch(() => ({} as any));
        if (res.ok && Array.isArray(j.items)) setItems(j.items);
      } catch {}
    })();
  }, []);

  const openGuide = (id: number) => {
    navigate('/study-guide', { state: { studyGuideId: id } });
  };

  return (
    <div>
      {items.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="h-12 w-12 mx-auto text-pink-300/30 mb-3" />
          <p className="text-pink-200">No study guides yet</p>
          <p className="text-sm text-pink-300/70">Create study guides from your materials!</p>
        </div>
      ) : (
        <div className={`${(items.length) > 5 ? 'max-h-96 overflow-y-auto' : ''}`}>
          <ul className="space-y-2">
            {items.map(it => (
              <li key={it.id} className="group flex items-center gap-3 p-3 rounded-lg border border-pink-700/30 bg-[#852E4E]/20 hover:bg-[#852E4E]/30 hover:shadow-lg hover:shadow-pink-900/20 transition-all">
                <BookOpen className="h-4 w-4 text-[#FB9590] flex-shrink-0" />
                <button className="flex-1 text-left font-medium text-pink-100 hover:text-[#FFBB94] transition-colors" onClick={() => openGuide(it.id)}>
                  {it.title || `Study Guide #${it.id}`}
                </button>
                <button
                  className="px-3 py-1.5 text-xs rounded-md border border-pink-700/40 bg-[#852E4E]/40 text-[#FFBB94] hover:bg-[#A33757] transition-colors flex items-center gap-1"
                  onClick={() => openGuide(it.id)}
                >
                  <Play className="h-3 w-3" />
                  Open
                </button>
                <button
                  className="p-1.5 rounded-md bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={async () => {
                    if (!confirm('Delete this study guide?')) return;
                    try {
                      const res = await fetch(`/api/study_guides/${it.id}`, { method: 'DELETE', credentials: 'include' });
                      if (res.status === 204) setItems(prev => prev.filter(x => x.id !== it.id));
                    } catch {}
                  }}
                  title="Delete study guide"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Viewing happens on the Study Guide page now */}
    </div>
  );
}