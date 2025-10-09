import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MarkdownMathRenderer from "@/components/MarkdownMathRenderer";

type QuizItem = { id: number; created_at: string | null; score: number; question_count: number; answered_count?: number; completed?: boolean; title?: string };
type NoteItem = { id: number; title: string; updated_at: string | null };
type SummaryItem = { id: number; title?: string; created_at?: string | null };

const Dashboard = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizItem[] | null>(null);
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [summaries, setSummaries] = useState<SummaryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSummaryId, setOpenSummaryId] = useState<number | null>(null);
  const [openSummary, setOpenSummary] = useState<{ id: number; title: string; content: string } | null>(null);
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [qRes, nRes, sRes] = await Promise.all([
          fetch("/api/dashboard/quizzes", { credentials: "include" }),
          fetch("/api/dashboard/notes", { credentials: "include" }),
          fetch("/api/dashboard/summaries", { credentials: "include" }),
        ]);
        if (!mounted) return;
        if (qRes.status === 401 || nRes.status === 401 || sRes.status === 401) {
          setError("Unauthorized. Please sign in.");
          setQuizzes([]);
          setNotes([]);
          setSummaries([]);
          return;
        }
        const [qJson, nJson, sJson] = await Promise.all([qRes.json(), nRes.json(), sRes.json()]);
        setQuizzes(qJson.items || []);
        setNotes(nJson.items || []);
        setSummaries(sJson.items || []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load dashboard data");
        setQuizzes([]);
        setNotes([]);
        setSummaries([]);
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
        setOpenSummary({ id: data.id, title, content: data.content });
        setSummaryTitleInput(title);
      } else {
        const title = `Summary #${id}`;
        setOpenSummary({ id, title, content: data?.error || "Failed to load summary." });
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

  return (
    <div className="container mx-auto px-4 pt-24 pb-12">
      {error && (
        <div className="mb-4 text-sm text-red-600">{error}</div>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Quizzes */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            {quizzes === null ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : quizzes.length === 0 ? (
              <p className="text-muted-foreground">Your quizzes will appear here.</p>
            ) : (
              <ul className="space-y-2">
                {quizzes.map((q) => (
                  <li key={q.id}>
                    <div className="w-full flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-gray-100">
                      <button
                        className="text-left"
                        onClick={async () => {
                          // Open quiz modal: load details to get current title and progress
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
                        <span>{q.title?.trim() ? q.title : `Quiz #${q.id}`} · {q.question_count} Qs</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Score: {q.score ?? 0}</span>
                        {q.completed && (
                          <button
                            className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/quizzes/${q.id}/reset`, { method: "POST", credentials: "include" });
                                if (res.status === 204) {
                                  navigate("/quiz", { state: { quizId: q.id } });
                                }
                              } catch {}
                            }}
                          >
                            Retry
                          </button>
                        )}
                        <button
                          className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                          onClick={() => setConfirmDelete({ kind: "quiz", id: q.id, title: (q.title?.trim() ? q.title! : `Quiz #${q.id}`) })}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {notes === null ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : notes.length === 0 ? (
              <p className="text-muted-foreground">Your notes will appear here.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="flex items-center gap-2">
                    <button
                      className="flex-1 text-left text-sm truncate px-2 py-1 rounded hover:bg-gray-100"
                      onClick={() => openNoteModal(n.id)}
                    >
                      {n.title || `Note #${n.id}`}
                    </button>
                    <button
                      className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                      onClick={() => setConfirmDelete({ kind: "note", id: n.id, title: n.title })}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Summaries */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Summaries</CardTitle>
          </CardHeader>
          <CardContent>
            {summaries === null ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : summaries.length === 0 ? (
              <p className="text-muted-foreground">Your summaries will appear here.</p>
            ) : (
              <ul className="space-y-2">
                {summaries.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <button
                      className="flex-1 text-left text-sm truncate px-2 py-1 rounded hover:bg-gray-100"
                      onClick={() => openSummaryModal(s.id)}
                    >
                      {s.title || `Summary #${s.id}`}
                    </button>
                    <button
                      className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                      onClick={() => setConfirmDelete({ kind: "summary", id: s.id, title: s.title })}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Keep existing sections at the bottom spanning full width */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-2xl">Your Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Charts and recent activity will appear here.</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Recent Sets</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentStudyGuides />
          </CardContent>
        </Card>
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
              <div className="bg-gray-50 p-4 rounded border text-sm max-h-[60vh] overflow-auto">
                <MarkdownMathRenderer text={openSummary?.content || ""} />
              </div>
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
              <div className="bg-gray-50 p-4 rounded border text-sm max-h-[60vh] overflow-auto">
                <MarkdownMathRenderer text={openNote?.content || ""} />
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
        <p className="text-muted-foreground">Your study guides will appear here.</p>
      ) : (
        <ul className="divide-y">
          {items.map(it => (
            <li key={it.id} className="py-2 flex items-center gap-2">
              <button className="flex-1 text-left hover:underline" onClick={() => openGuide(it.id)}>
                {it.title || `Study Guide #${it.id}`}
              </button>
              <button
                className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                onClick={() => openGuide(it.id)}
              >
                View / Rename
              </button>
              <button
                className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                onClick={async () => {
                  if (!confirm('Delete this study guide?')) return;
                  try {
                    const res = await fetch(`/api/study_guides/${it.id}`, { method: 'DELETE', credentials: 'include' });
                    if (res.status === 204) setItems(prev => prev.filter(x => x.id !== it.id));
                  } catch {}
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Viewing happens on the Study Guide page now */}
    </div>
  );
}
