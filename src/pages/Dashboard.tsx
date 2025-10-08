import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuizItem = { id: number; created_at: string | null; score: number; question_count: number; answered_count?: number; completed?: boolean };
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
        setOpenSummary({ id: data.id, title: data.title || `Summary #${id}`, content: data.content });
      } else {
        setOpenSummary({ id, title: `Summary #${id}`, content: data?.error || "Failed to load summary." });
      }
    } catch (e: any) {
      setOpenSummary({ id, title: `Summary #${id}`, content: e?.message || "Failed to load summary." });
    } finally {
      setOpenLoading(false);
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
                    <button
                      className="w-full flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-gray-100"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/quizzes/${q.id}`, { credentials: "include" });
                          if (!res.ok) return;
                          const data = await res.json();
                          const total = (data?.questions?.length ?? 0);
                          const nextIdx = data?.next_unanswered_index ?? 0;
                          if (!q.completed && total > 0 && nextIdx < total) {
                            navigate("/quiz", { state: { quizId: q.id } });
                          } 
                        } catch {}
                      }}
                    >
                      <span>Quiz #{q.id} · {q.question_count} Qs</span>
                      <span className="text-muted-foreground">Score: {q.score ?? 0}</span>
                    </button>
                    {q.completed && (
                      <div className="mt-1 flex justify-end">
                        <button
                          className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/quizzes/${q.id}/reset`, { method: "POST", credentials: "include" });
                              if (res.status === 204) {
                                // After reset, jump into the quiz at start
                                navigate("/quiz", { state: { quizId: q.id } });
                              }
                            } catch {}
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
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
                  <li key={n.id} className="text-sm truncate">{n.title}</li>
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
                      onClick={async () => {
                        if (!confirm("Delete this summary?")) return;
                        try {
                          const res = await fetch(`/api/summaries/${s.id}`, { method: "DELETE", credentials: "include" });
                          if (res.status === 204) {
                            setSummaries((prev) => (prev || []).filter((x) => x.id !== s.id));
                            if (openSummaryId === s.id) { setOpenSummaryId(null); setOpenSummary(null); }
                          }
                        } catch {}
                      }}
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
            <p className="text-muted-foreground">Quick access to your latest study sets.</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Modal */}
      <Dialog open={openSummaryId !== null} onOpenChange={(open) => { if (!open) { setOpenSummaryId(null); setOpenSummary(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openSummary?.title || (openSummaryId ? `Summary #${openSummaryId}` : "Summary")}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {openLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded border text-sm max-h-[60vh] overflow-auto">{openSummary?.content || ""}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
