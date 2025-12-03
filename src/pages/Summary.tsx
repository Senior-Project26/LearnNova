import { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MathText } from "@/components/MathText";
import { FileText, Brain, BookOpen, Upload, Sparkles, AlertCircle } from "lucide-react";

type UploadResult = {
  extracted_text?: string;
  filename?: string;
  topics?: string[];
};

type SummaryApiResponse = {
  items?: { id: number }[];
};

type NotesApiResponse = {
  items?: { id: number; title?: string | null }[];
};

type CoursesApiResponse = {
  courses?: { id: number; name?: string | null }[];
};

type SummaryLocationState = {
  summary?: string;
  result?: UploadResult;
  extracted_text?: string;
};

export default function Summary() {
  const location = useLocation() as { state?: SummaryLocationState };
  const summary = location.state?.summary;
  const result = location.state?.result;
  const extractedFromState = location.state?.extracted_text ?? result?.extracted_text ?? "";
  const filename = result?.filename as string | undefined;
  const navigate = useNavigate();
  const [showExtracted, setShowExtracted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSummaryId, setSavedSummaryId] = useState<number | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [nextSummaryNumber, setNextSummaryNumber] = useState<number | null>(null);
  const [nextNoteNumber, setNextNoteNumber] = useState<number | null>(null);
  const [topics, setTopics] = useState<string[]>(Array.isArray(result?.topics) ? result.topics.slice(0, 10) : []);
  const [courses, setCourses] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [newCourseName, setNewCourseName] = useState("");
  const extractedText: string = useMemo(() => String(extractedFromState || ""), [extractedFromState]);
  const toTitleCase = (s: string) => s.split(/\s+/).map(w => w ? (w[0].toUpperCase() + w.slice(1)) : w).join(" ");
  const [newTopic, setNewTopic] = useState("");
  const [allNotes, setAllNotes] = useState<Array<{ id: number; title: string }>>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [allSummaries, setAllSummaries] = useState<Array<{ id: number; title: string }>>([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [summariesError, setSummariesError] = useState<string | null>(null);
  const addTopic = () => {
    const raw = newTopic.trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    const exists = topics.some(t => t.toLowerCase() === key);
    if (exists) { setNewTopic(""); return; }
    setTopics(prev => [...prev, raw]);
    setNewTopic("");
  };

  // Fetch latest ids to compute default next number for placeholder and fallback title
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [sRes, nRes, cRes] = await Promise.all([
          fetch("/api/dashboard/summaries", { credentials: "include" }),
          fetch("/api/dashboard/notes", { credentials: "include" }),
          fetch("/api/courses", { credentials: "include" }),
        ]);
        if (!mounted) return;
        if (sRes.status === 401 || nRes.status === 401 || cRes.status === 401) {
          setNextSummaryNumber(1);
          setNextNoteNumber(1);
          setCourses([]);
          return;
        }
        const [sJson, nJson, cJson]: [SummaryApiResponse, NotesApiResponse, CoursesApiResponse] = await Promise.all([
          sRes.json(),
          nRes.json(),
          cRes.json(),
        ]);
        const nextS = (Array.isArray(sJson.items) && sJson.items.length > 0) ? (Math.max(...sJson.items.map((x) => x.id)) + 1) : 1;
        const nextN = (Array.isArray(nJson.items) && nJson.items.length > 0) ? (Math.max(...nJson.items.map((x) => x.id)) + 1) : 1;
        setNextSummaryNumber(nextS);
        setNextNoteNumber(nextN);
        const list = Array.isArray(cJson.courses) ? cJson.courses : [];
        setCourses(list.map((c) => ({ id: Number(c.id), name: String(c.name || "") })));
      } catch {
        return;
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load saved notes for sidebar / reuse
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setNotesLoading(true);
        setNotesError(null);
        const res = await fetch("/api/all_notes", { credentials: "include" });
        const raw = await res.json().catch(() => ({} as { items?: unknown }));
        if (!mounted) return;
        if (!res.ok) {
          throw new Error((raw as { error?: string })?.error || `Failed to load notes (${res.status})`);
        }
        const itemsUnknown = (raw as { items?: unknown }).items;
        const list = Array.isArray(itemsUnknown)
          ? (itemsUnknown as NotesApiResponse["items"])
              ?.filter((x): x is { id: number; title?: string | null } => !!x && typeof x.id === "number")
              .map((x) => ({ id: x.id, title: String(x.title || `Note #${x.id}`) })) ?? []
          : [];
        setAllNotes(list);
      } catch (e: unknown) {
        if (!mounted) return;
        setAllNotes([]);
        setNotesError(e instanceof Error ? e.message : "Failed to load notes");
      } finally {
        if (mounted) setNotesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load saved summaries for sidebar / reuse
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setSummariesLoading(true);
        setSummariesError(null);
        const res = await fetch("/api/all_summaries", { credentials: "include" });
        const raw = await res.json().catch(() => ({} as { items?: unknown }));
        if (!mounted) return;
        if (!res.ok) {
          throw new Error((raw as { error?: string })?.error || `Failed to load summaries (${res.status})`);
        }
        const itemsUnknown = (raw as { items?: unknown }).items;
        const list = Array.isArray(itemsUnknown)
          ? (itemsUnknown as { id: number; title?: string | null }[])
              ?.filter((x): x is { id: number; title?: string | null } => !!x && typeof x.id === "number")
              .map((x) => ({ id: x.id, title: String(x.title || `Summary #${x.id}`) })) ?? []
          : [];
        setAllSummaries(list);
      } catch (e: unknown) {
        if (!mounted) return;
        setAllSummaries([]);
        setSummariesError(e instanceof Error ? e.message : "Failed to load summaries");
      } finally {
        if (mounted) setSummariesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const ensureSummarySaved = async () => {
    if (savedSummaryId || !summary) return;
    try {
      setSaving(true);
      const res = await fetch("/api/summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: (titleInput.trim() || (`Summary #${nextSummaryNumber ?? ""}`)).trim(),
          content: summary,
          topics: topics,
          course_id: selectedCourseId,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        setSavedSummaryId(j.id ?? null);
      }
    } catch (error) {
      console.error("Failed to save summary", error);
    }
    finally {
      setSaving(false);
    }
  };

  const ensureNoteSaved = async () => {
    if (savedNoteId || !extractedText) return;
    try {
      setSaving(true);
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: (titleInput.trim() || (`Note #${nextNoteNumber ?? ""}`)).trim(),
          content: extractedText,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        const nid = j.id ?? null;
        setSavedNoteId(nid ?? null);
        if (nid) {
          const noteTitle = j.title ?? (titleInput.trim() || (`Note #${nextNoteNumber ?? ""}`)).trim();
          setAllNotes(prev => [{ id: nid, title: noteTitle }, ...prev.filter(n => n.id !== nid)]);
        }
      }
    } catch (error) {
      console.error("Failed to save note", error);
    }
    finally {
      setSaving(false);
    }
  };

  const quizMe = async () => {
    if (!summary) return;
    // Auto-save note before proceeding so it appears in quiz selectors
    if (!savedNoteId && extractedText) {
      await ensureNoteSaved();
    }
    // Auto-save summary before proceeding if not saved
    if (!savedSummaryId) {
      await ensureSummarySaved();
    }
    try {
      // Persist summary for Quiz.tsx prefill
      sessionStorage.setItem(
        "lastUploadResult",
        JSON.stringify({ summary })
      );
    } catch (error) {
      console.error("Failed to persist summary for quiz", error);
    }
    navigate("/quiz");
  };

  const studyGuide = async () => {
    if (!summary) return;
    // Auto-save note before proceeding so it appears in study guide selectors
    if (!savedNoteId && extractedText) {
      await ensureNoteSaved();
    }
    // Auto-save summary before proceeding if not saved
    if (!savedSummaryId) {
      await ensureSummarySaved();
    }
    try {
      sessionStorage.setItem(
        "lastUploadResult",
        JSON.stringify({ summary })
      );
    } catch (error) {
      console.error("Failed to persist summary for study guide", error);
    }
    navigate("/study-guide");
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text mb-2">
            Document Summary
          </h1>
          <p className="text-pink-100 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FB9590]" />
            Your AI-generated summary is ready
          </p>
        </div>

        {!summary ? (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <AlertCircle className="h-16 w-16 mx-auto text-pink-300/30" />
                <div>
                  <p className="text-pink-200 text-lg mb-2">No summary data found</p>
                  <p className="text-pink-300/70 text-sm">Please upload a file first to generate a summary</p>
                </div>
                <Link 
                  to="/upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#DC586D] to-[#A33757] text-white rounded-xl font-medium shadow-lg hover:shadow-pink-900/30 transition-all hover:scale-[1.02]"
                >
                  <Upload className="h-5 w-5" />
                  Go to Upload
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                    <FileText className="h-5 w-5 text-[#FB9590]" />
                  </div>
                  <span className="text-pink-100">Summary Content</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#852E4E]/20 p-6 rounded-lg border border-pink-700/30 prose prose-invert max-w-none whitespace-pre-wrap break-words text-pink-50 text-sm">
                  <MathText text={summary || ""} />
                </div>
                <div className="mt-4">
                  <div className="text-sm text-pink-200 mb-2">Topics</div>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#852E4E]/40 border border-pink-700/40 text-[#FFBB94]">
                        <span className="text-sm">{toTitleCase(t)}</span>
                        <button
                          onClick={() => setTopics((prev) => prev.filter((_, i) => i !== idx))}
                          className="h-5 w-5 inline-flex items-center justify-center rounded-full bg-[#A33757] hover:bg-[#DC586D] text-white"
                          aria-label="Remove topic"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                      placeholder="Add a topic..."
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#852E4E]/20 border border-pink-700/40 text-pink-100 placeholder-pink-300/50 focus:outline-none focus:ring-2 focus:ring-pink-600/40"
                    />
                    <button
                      onClick={addTopic}
                      className="px-3 py-2 rounded-lg bg-[#A33757] hover:bg-[#DC586D] text-white"
                    >
                      Add
                    </button>
                    <span className="mx-2 text-pink-300/50">|</span>
                    <input
                      type="text"
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      onKeyDown={async (e) => { if (e.key === 'Enter') { e.preventDefault();
                        const name = newCourseName.trim(); if (!name) return;
                        try {
                          const res = await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name, description: 'Created from Summary' }) });
                          const j = await res.json().catch(() => ({}));
                          const createdId = j?.course?.id ?? j?.id;
                          const createdName = j?.course?.name ?? name;
                          if (res.ok && createdId) {
                            const created = { id: Number(createdId), name: String(createdName) };
                            setCourses(prev => [...prev, created]);
                            setSelectedCourseId(created.id);
                            setNewCourseName('');
                          }
                        } catch (error) {
                          console.error("Failed to create course from Enter key", error);
                        }
                      }}}
                      placeholder="Add course"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#852E4E]/20 border border-pink-700/40 text-pink-100 placeholder-pink-300/50 focus:outline-none focus:ring-2 focus:ring-pink-600/40"
                    />
                    <button
                      onClick={async () => {
                        const name = newCourseName.trim(); if (!name) return;
                        try {
                          const res = await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name, description: 'Created from Summary' }) });
                          const j = await res.json().catch(() => ({}));
                          const createdId = j?.course?.id ?? j?.id;
                          const createdName = j?.course?.name ?? name;
                          if (res.ok && createdId) {
                            const created = { id: Number(createdId), name: String(createdName) };
                            setCourses(prev => [...prev, created]);
                            setSelectedCourseId(created.id);
                            setNewCourseName('');
                          }
                        } catch (error) {
                          console.error("Failed to create course from button click", error);
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-[#A33757] hover:bg-[#DC586D] text-white"
                    >
                      Add Course
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder={`Name your summary (defaults to Summary #${nextSummaryNumber ?? ""})`}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#852E4E]/20 border border-pink-700/40 text-pink-100 placeholder-pink-300/50 focus:outline-none focus:ring-2 focus:ring-pink-600/40"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-pink-200">Course</label>
                    <select
                      value={selectedCourseId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedCourseId(v ? Number(v) : null);
                      }}
                      className="px-3 py-2 rounded-lg bg-[#4C1D3D] border border-pink-700/60 text-[#FFBB94] focus:outline-none appearance-none"
                      style={{ backgroundColor: '#4C1D3D', color: '#FFBB94' }}
                    >
                      <option value="">No Course</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={ensureSummarySaved}
                    className="px-3 py-2 rounded-lg bg-[#A33757] hover:bg-[#DC586D] text-white disabled:opacity-60"
                    disabled={saving}
                  >
                    {savedSummaryId ? "Saved" : (saving ? "Saving…" : "Save Summary")}
                  </button>
                </div>
                {result && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-pink-300/70 text-sm hover:text-pink-200 transition-colors">
                      View raw response
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="bg-[#852E4E]/20 p-4 rounded-lg border border-pink-700/30 prose prose-invert max-w-none whitespace-pre-wrap break-words text-pink-50 text-sm">
                        <MathText text={extractedText || "(no extracted text)"} />
                      </div>
                      {extractedText && (
                        <button
                          className="px-4 py-2 bg-[#852E4E]/60 hover:bg-[#A33757] text-[#FFBB94] rounded-lg transition-colors"
                          disabled={saving || !!savedNoteId}
                          onClick={ensureNoteSaved}
                        >
                          {savedNoteId ? "Saved" : (saving ? "Saving…" : "Save as Note")}
                        </button>
                      )}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="text-pink-100">Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <button 
                    onClick={quizMe}
                    className="flex items-center justify-center gap-3 p-4 bg-[#852E4E]/40 hover:bg-[#852E4E]/60 border border-pink-700/40 rounded-xl transition-all hover:shadow-lg hover:shadow-pink-900/20 group"
                  >
                    <Brain className="h-6 w-6 text-[#FFBB94] group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <div className="font-semibold text-pink-100">Quiz Me!</div>
                      <div className="text-xs text-pink-300/70">Test your knowledge</div>
                    </div>
                  </button>
                  <button 
                    onClick={studyGuide}
                    className="flex items-center justify-center gap-3 p-4 bg-[#852E4E]/40 hover:bg-[#852E4E]/60 border border-pink-700/40 rounded-xl transition-all hover:shadow-lg hover:shadow-pink-900/20 group"
                  >
                    <BookOpen className="h-6 w-6 text-[#FFBB94] group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <div className="font-semibold text-pink-100">Study Guide</div>
                      <div className="text-xs text-pink-300/70">Create a guide</div>
                    </div>
                  </button>
                </div>
                <Link 
                  to="/upload"
                  className="mt-4 flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-[#DC586D] to-[#A33757] text-white rounded-xl font-medium shadow-lg hover:shadow-pink-900/30 transition-all hover:scale-[1.02]"
                >
                  <Upload className="h-5 w-5" />
                  Upload Another File
                </Link>
              </CardContent>
            </Card>

            {/* Saved Notes Sidebar/Card */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                    <FileText className="h-5 w-5 text-[#FB9590]" />
                  </div>
                  <span className="text-pink-100">Saved Notes</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {notesError && (
                  <div className="text-sm text-red-300">{notesError}</div>
                )}
                {notesLoading && !notesError && (
                  <div className="text-sm text-pink-200">Loading notes…</div>
                )}
                {!notesLoading && !notesError && allNotes.length === 0 && (
                  <div className="text-sm text-pink-200">No saved notes yet.</div>
                )}
                {!notesLoading && allNotes.length > 0 && (
                  <ul className="space-y-2">
                    {allNotes.slice(0, 8).map((n) => (
                      <li
                        key={n.id}
                        className="flex items-center justify-between p-2 rounded bg-[#852E4E]/30 border border-pink-700/30 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="truncate text-pink-100">{n.title || `Note #${n.id}`}</span>
                          <span className="ml-1 text-[11px] px-2 py-1 rounded-full border border-pink-600/60 text-pink-200 flex-shrink-0">
                            ID {n.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => navigate("/quiz", { state: { noteId: n.id } })}
                            className="px-2 py-1 text-[11px] rounded bg-[#852E4E] hover:bg-[#A33757] text-[#FFBB94] border border-pink-700/60"
                          >
                            Quiz
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate("/study-guide", { state: { noteId: n.id } })}
                            className="px-2 py-1 text-[11px] rounded bg-transparent hover:bg-[#852E4E] text-pink-100 border border-pink-700/60"
                          >
                            Guide
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                    <BookOpen className="h-5 w-5 text-[#FB9590]" />
                  </div>
                  <span className="text-pink-100">Saved Summaries</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summariesError && (
                  <div className="text-sm text-red-300">{summariesError}</div>
                )}
                {summariesLoading && !summariesError && (
                  <div className="text-sm text-pink-200">Loading summaries…</div>
                )}
                {!summariesLoading && !summariesError && allSummaries.length === 0 && (
                  <div className="text-sm text-pink-200">No saved summaries yet.</div>
                )}
                {!summariesLoading && allSummaries.length > 0 && (
                  <ul className="space-y-2">
                    {allSummaries.slice(0, 8).map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between p-2 rounded bg-[#852E4E]/30 border border-pink-700/30 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="truncate text-pink-100">{s.title || `Summary #${s.id}`}</span>
                          <span className="ml-1 text-[11px] px-2 py-1 rounded-full border border-pink-600/60 text-pink-200 flex-shrink-0">
                            ID {s.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => navigate("/quiz", { state: { summaryId: s.id } })}
                            className="px-2 py-1 text-[11px] rounded bg-[#852E4E] hover:bg-[#A33757] text-[#FFBB94] border border-pink-700/60"
                          >
                            Quiz
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate("/study-guide", { state: { summaryId: s.id } })}
                            className="px-2 py-1 text-[11px] rounded bg-transparent hover:bg-[#852E4E] text-pink-100 border border-pink-700/60"
                          >
                            Guide
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
