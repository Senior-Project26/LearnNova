import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MarkdownMathRenderer from "@/components/MarkdownMathRenderer";
import { BookOpen, Sparkles, AlertCircle, RotateCcw } from "lucide-react";

type ComboOption = { id: number; title: string };
type Item = { id: number; title?: string | null };
const isItem = (x: unknown): x is Item =>
  typeof x === "object" && x !== null && "id" in x && typeof (x as { id: unknown }).id === "number";
type StudyGuideResponse = { content?: string | null; title?: string | null };
type ApiError = { error?: string };

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
  const filtered = options.filter(o => (o.title || "").toLowerCase().includes(query.toLowerCase()));
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

export default function StudyGuide() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [savedGuideId, setSavedGuideId] = useState<number | null>(null);
  const location = useLocation() as { state?: { studyGuideId?: number; noteId?: number } };
  const navigate = useNavigate();
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [titleInput, setTitleInput] = useState<string>("");
  const [savingTitle, setSavingTitle] = useState(false);
  // Multi-select state
  const [allNotes, setAllNotes] = useState<Array<{ id: number; title: string }>>([]);
  const [allSummaries, setAllSummaries] = useState<Array<{ id: number; title: string }>>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<number[]>([]);
  const [comingFromSummary, setComingFromSummary] = useState<boolean>(false);

  // On mount: if navigated with a studyGuideId, load it for viewing.
  useEffect(() => {
    const gid = location.state?.studyGuideId;
    if (typeof gid === "number") {
      (async () => {
        try {
          setLoading(true);
          const res = await fetch(`/api/study_guides/${gid}`, { credentials: "include" });
          const j: unknown = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError((j as ApiError).error || `Failed to load study guide #${gid}`);
            return;
          }
          setGuide((j as StudyGuideResponse).content ?? null);
          setSavedGuideId(gid);
          setViewingId(gid);
          setTitleInput((j as StudyGuideResponse).title ?? `Study Guide #${gid}`);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "Failed to load study guide");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, []);

  // Prefill: if redirected from Summary, auto-select most recent summary; load lists (generator mode)
  useEffect(() => {
    try {
      const last = sessionStorage.getItem("lastUploadResult");
      if (last) setComingFromSummary(true);
    } catch { void 0; }
    // Load selectable lists
    (async () => {
      try {
        const [nRes, sRes] = await Promise.all([
          fetch("/api/all_notes", { credentials: "include" }),
          fetch("/api/all_summaries", { credentials: "include" }),
        ]);
        if (nRes.ok) {
          const nRaw: unknown = await nRes.json();
          const nItemsUnknown = (nRaw as { items?: unknown }).items;
          const noteList = Array.isArray(nItemsUnknown)
            ? nItemsUnknown.filter(isItem).map(x => ({ id: x.id, title: x.title ?? "" }))
            : [];
          setAllNotes(noteList);
          const navNoteId = location.state?.noteId;
          if (typeof navNoteId === "number" && noteList.some(x => x.id === navNoteId)) {
            setSelectedNoteIds(ids => (ids.length ? ids : [navNoteId]));
          }
        }
        if (sRes.ok) {
          const sRaw: unknown = await sRes.json();
          const sItemsUnknown = (sRaw as { items?: unknown }).items;
          const list = Array.isArray(sItemsUnknown)
            ? sItemsUnknown.filter(isItem).map(x => ({ id: x.id, title: x.title ?? "" }))
            : [];
          setAllSummaries(list);
          // If coming from Summary, auto-select most recent summary (API already returns newest first)
          if (comingFromSummary && list.length > 0) {
            setSelectedSummaryIds((ids) => (ids.length ? ids : [list[0].id]));
          }
        }
      } catch { void 0; }
    })();
  }, [comingFromSummary]);

  const disableSubmit = useMemo(() => (selectedNoteIds.length + selectedSummaryIds.length) <= 0, [selectedNoteIds, selectedSummaryIds]);

  const generateGuide = async () => {
    setError(null);
    setGuide(null);
    setSavedGuideId(null);
    setLoading(true);
    try {
      // Build combined content from selections
      let combined = "";
      if (selectedNoteIds.length > 0 || selectedSummaryIds.length > 0) {
        const notePromises = selectedNoteIds.map(async (id) => {
          const r = await fetch(`/api/notes/${id}`, { credentials: "include" });
          const j: { title?: string; content?: string } = await r
            .json()
            .catch(() => ({} as { title?: string; content?: string }));
          return (j?.title ? `# Note: ${j.title}\n` : "") + (j?.content || "");
        });
        const summaryPromises = selectedSummaryIds.map(async (id) => {
          const r = await fetch(`/api/summaries/${id}`, { credentials: "include" });
          const j: { title?: string; content?: string } = await r
            .json()
            .catch(() => ({} as { title?: string; content?: string }));
          return (j?.title ? `# Summary: ${j.title}\n` : "") + (j?.content || "");
        });
        const parts = await Promise.all([...notePromises, ...summaryPromises]);
        combined = parts.filter(Boolean).join("\n\n").trim();
      }
      const res = await fetch("http://127.0.0.1:5050/api/study_guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: combined }),
      });
      const data: { guide?: string; error?: string } = await res
        .json()
        .catch(() => ({} as { guide?: string; error?: string }));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      if (!data.guide) throw new Error("No guide returned");
      setGuide(data.guide);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate study guide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 pb-12">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
            {viewingId ? "Study Guide" : "AI Study Guide"}
          </h1>
          {!viewingId && (
            <p className="text-pink-100 flex items-center justify-center gap-2">
              <BookOpen className="h-5 w-5 text-[#FB9590]" />
              Create comprehensive guides from your materials ✨
            </p>
          )}
        </div>

        {!guide && !viewingId && (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#FB9590]" />
                Select Your Study Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <MultiCombo label="Notes" options={allNotes} selectedIds={selectedNoteIds} setSelectedIds={setSelectedNoteIds} />
                <MultiCombo label="Summaries" options={allSummaries} selectedIds={selectedSummaryIds} setSelectedIds={setSelectedSummaryIds} />
              </div>

              {error && (
                <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-4 py-3 bg-transparent border border-[#FFBB94] text-[#FFBB94] rounded-lg hover:bg-[#852E4E]/30"
                >
                  ← Back
                </button>
                <button
                  onClick={generateGuide}
                  disabled={loading || disableSubmit}
                  className="flex-1 bg-gradient-to-r from-[#852E4E] to-[#A33757] hover:from-[#A33757] hover:to-[#852E4E] text-white font-semibold py-3 rounded-lg shadow-lg shadow-pink-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? "Generating..." : "Generate Study Guide"}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {guide && (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                    <BookOpen className="h-5 w-5 text-[#FB9590]" />
                  </div>
                  <span className="text-pink-100">Your Study Guide</span>
                </CardTitle>
                {!viewingId && (
                  <button
                    className="px-4 py-2 bg-[#852E4E]/60 hover:bg-[#A33757] text-[#FFBB94] rounded-lg transition-colors flex items-center gap-2"
                    onClick={() => { setGuide(null); setError(null); }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    New Guide
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {viewingId ? (
                  <>
                    <input
                      type="text"
                      className="w-full px-2 py-2 rounded bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                    />
                    <button
                      className="px-3 py-2 text-xs rounded border border-[#FFBB94] text-[#FFBB94] bg-transparent hover:bg-[#852E4E]/30 disabled:opacity-60"
                      disabled={savingTitle || !titleInput.trim()}
                      onClick={async () => {
                        if (!viewingId) return;
                        const title = titleInput.trim();
                        try {
                          setSavingTitle(true);
                          await fetch(`/api/study_guides/${viewingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title }) });
                        } finally { setSavingTitle(false); }
                      }}
                    >
                      {savingTitle ? "Saving…" : "Save"}
                    </button>
                  </>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="px-4 py-3 bg-gradient-to-r from-[#852E4E] to-[#A33757] hover:from-[#A33757] hover:to-[#852E4E] text-white font-semibold rounded-lg shadow-lg shadow-pink-900/30 disabled:opacity-60"
                  disabled={saving || savedGuideId !== null}
                  onClick={async () => {
                    if (!guide || savedGuideId !== null) return;
                    setSaveError(null);
                    setSaveSuccess(null);
                    setSaving(true);
                    try {
                      const now = new Date();
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const title = `Study Guide ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
                      const res = await fetch('/api/study_guides', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ title, content: guide }),
                      });
                      const data: { id?: number; error?: string } = await res.json().catch(() => ({} as { id?: number; error?: string }));
                      if (!res.ok) throw new Error(data?.error || `Failed to save (${res.status})`);
                      if (data?.id) setSavedGuideId(Number(data.id));
                      setSaveSuccess('Study Guide saved');
                    } catch (e: unknown) {
                      setSaveError(e instanceof Error ? e.message : 'Failed to save study guide');
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {savedGuideId !== null ? 'Saved' : (saving ? 'Saving…' : 'Save Study Guide')}
                </button>
                {saveSuccess && <span className="text-green-300 text-sm">{saveSuccess}</span>}
                {saveError && <span className="text-red-300 text-sm">{saveError}</span>}
              </div>

              <div className="bg-[#852E4E]/20 p-6 rounded-lg border border-pink-700/30">
                <MarkdownMathRenderer text={guide} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}