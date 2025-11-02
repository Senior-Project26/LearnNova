import { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MarkdownMathRenderer from "@/components/MarkdownMathRenderer";
import { FileText, Brain, BookOpen, Upload, Sparkles, AlertCircle } from "lucide-react";

export default function Summary() {
  const location = useLocation() as { state?: { summary?: string; result?: any; extracted_text?: string } };
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
        const [sJson, nJson, cJson] = await Promise.all([sRes.json(), nRes.json(), cRes.json()]);
        const nextS = (Array.isArray(sJson.items) && sJson.items.length > 0) ? (Math.max(...sJson.items.map((x: any) => x.id)) + 1) : 1;
        const nextN = (Array.isArray(nJson.items) && nJson.items.length > 0) ? (Math.max(...nJson.items.map((x: any) => x.id)) + 1) : 1;
        setNextSummaryNumber(nextS);
        setNextNoteNumber(nextN);
        const list = Array.isArray(cJson.courses) ? cJson.courses : [];
        setCourses(list.map((c: any) => ({ id: Number(c.id), name: String(c.name || "") })));
      } catch {}
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
    } catch {}
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
        setSavedNoteId(j.id ?? null);
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  const quizMe = async () => {
    if (!summary) return;
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
    } catch {}
    navigate("/quiz");
  };

  const studyGuide = async () => {
    if (!summary) return;
    // Auto-save summary before proceeding if not saved
    if (!savedSummaryId) {
      await ensureSummarySaved();
    }
    try {
      sessionStorage.setItem(
        "lastUploadResult",
        JSON.stringify({ summary })
      );
    } catch {}
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
                <div className="bg-[#852E4E]/20 p-6 rounded-lg border border-pink-700/30 prose prose-invert max-w-none">
                  <MarkdownMathRenderer text={summary || ""} />
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
                        } catch {}
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
                        } catch {}
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
                      <div className="bg-[#852E4E]/20 p-4 rounded-lg border border-pink-700/30 prose prose-invert max-w-none">
                        <MarkdownMathRenderer text={extractedText || "(no extracted text)"} />
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
          </div>
        )}
      </div>
    </div>
  );
}
