import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import MarkdownMathRenderer from "@/components/MarkdownMathRenderer";

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

export default function StudyGuide() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [savedGuideId, setSavedGuideId] = useState<number | null>(null);
  const location = useLocation() as { state?: { studyGuideId?: number } };
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
          const j = await res.json().catch(() => ({} as any));
          if (!res.ok) {
            setError((j as any)?.error || `Failed to load study guide #${gid}`);
            return;
          }
          setGuide(j?.content || null);
          setSavedGuideId(gid);
          setViewingId(gid);
          setTitleInput(j?.title || `Study Guide #${gid}`);
        } catch (e: any) {
          setError(e?.message || "Failed to load study guide");
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
    } catch {}
    // Load selectable lists
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
          const list = ((s?.items as any[]) || []).map(x => ({ id: x.id, title: x.title }));
          setAllSummaries(list);
          // If coming from Summary, auto-select most recent summary (API already returns newest first)
          if (comingFromSummary && list.length > 0) {
            setSelectedSummaryIds((ids) => (ids.length ? ids : [list[0].id]));
          }
        }
      } catch {}
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
          const j = await r.json().catch(() => ({} as any));
          return (j?.title ? `# Note: ${j.title}\n` : "") + (j?.content || "");
        });
        const summaryPromises = selectedSummaryIds.map(async (id) => {
          const r = await fetch(`/api/summaries/${id}`, { credentials: "include" });
          const j = await r.json().catch(() => ({} as any));
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
      const data: { guide?: string; error?: string } = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      if (!data.guide) throw new Error("No guide returned");
      setGuide(data.guide);
    } catch (e: any) {
      setError(e?.message || "Failed to generate study guide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{viewingId ? "Study Guide" : "Study Guide Generator"}</h1>
      {!guide && !viewingId && (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4">
            <MultiCombo
              label="Notes"
              options={allNotes}
              selectedIds={selectedNoteIds}
              setSelectedIds={setSelectedNoteIds}
            />
            <MultiCombo
              label="Summaries"
              options={allSummaries}
              selectedIds={selectedSummaryIds}
              setSelectedIds={setSelectedSummaryIds}
            />
          </div>
          <button
            onClick={generateGuide}
            disabled={loading || disableSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Study Guide"}
          </button>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}

      {guide && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 flex items-center gap-2">
              {viewingId ? (
                <>
                  <input
                    type="text"
                    className="w-full px-2 py-1 border rounded"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                  />
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-60"
                    disabled={savingTitle || !titleInput.trim()}
                    onClick={async () => {
                      if (!viewingId) return;
                      const title = titleInput.trim();
                      try {
                        setSavingTitle(true);
                        const res = await fetch(`/api/study_guides/${viewingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title }) });
                        // No need to update list here; Dashboard will reflect on next load
                      } catch {}
                      finally { setSavingTitle(false); }
                    }}
                  >
                    {savingTitle ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <h2 className="text-xl font-semibold">Study Guide</h2>
              )}
            </div>
            {!viewingId && (
              <button
                className="px-3 py-1.5 bg-gray-800 text-white rounded"
                onClick={() => { setGuide(null); setError(null); }}
              >
                New Guide
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 bg-green-600 text-white rounded disabled:opacity-60"
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
                  const data = await res.json().catch(() => ({} as any));
                  if (!res.ok) throw new Error((data as any)?.error || `Failed to save (${res.status})`);
                  if ((data as any)?.id) setSavedGuideId(Number((data as any).id));
                  setSaveSuccess('Study Guide saved');
                } catch (e: any) {
                  setSaveError(e?.message || 'Failed to save study guide');
                } finally {
                  setSaving(false);
                }
              }}
            >
              {savedGuideId !== null ? 'Saved' : (saving ? 'Saving…' : 'Save Study Guide')}
            </button>
            {saveSuccess && <span className="text-green-700 text-sm">{saveSuccess}</span>}
            {saveError && <span className="text-red-600 text-sm">{saveError}</span>}
          </div>
          <div className="bg-gray-50 p-4 rounded border">
            <MarkdownMathRenderer text={guide} />
          </div>
        </div>
      )}
    </div>
  );
}
