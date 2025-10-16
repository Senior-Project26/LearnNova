import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Sparkles, AlertCircle, RotateCcw } from "lucide-react";

export default function StudyGuide() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [savedGuideId, setSavedGuideId] = useState<number | null>(null);
  const location = useLocation() as { state?: { studyGuideId?: number } };
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
    <div className="min-h-screen pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text mb-2">
            Study Guide Generator
          </h1>
          <p className="text-pink-100 flex items-center justify-center gap-2">
            <BookOpen className="h-4 w-4 text-[#FB9590]" />
            Create comprehensive study guides from your materials
          </p>
        </div>

        {!guide ? (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                  <Sparkles className="h-5 w-5 text-[#FB9590]" />
                </div>
                <span className="text-pink-100">Input Your Content</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block">
                  <span className="font-medium text-pink-100 mb-2 block">
                    Paste notes or summary (minimum 240 characters)
                  </span>
                  <textarea
                    className="w-full min-h-[16rem] p-4 bg-[#852E4E]/20 border border-pink-700/40 rounded-lg text-pink-100 placeholder:text-pink-300/50 focus:outline-none focus:ring-2 focus:ring-[#FB9590] focus:border-transparent transition-all"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your notes or summary here..."
                  />
                  <div className="mt-2 text-sm text-pink-300/70">
                    {text.length} / 240 characters minimum
                  </div>
                </label>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                onClick={generateGuide}
                disabled={loading || disableSubmit}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#DC586D] to-[#A33757] text-white rounded-xl font-medium shadow-lg hover:shadow-pink-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Generate Study Guide</span>
                  </>
                )}
              </button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                    <BookOpen className="h-5 w-5 text-[#FB9590]" />
                  </div>
                  <span className="text-pink-100">Your Study Guide</span>
                </CardTitle>
                <button
                  className="px-4 py-2 bg-[#852E4E]/60 hover:bg-[#A33757] text-[#FFBB94] rounded-lg transition-colors flex items-center gap-2"
                  onClick={() => { setGuide(null); setError(null); }}
                >
                  <RotateCcw className="h-4 w-4" />
                  New Guide
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-[#852E4E]/20 p-6 rounded-lg border border-pink-700/30">
                <pre className="whitespace-pre-wrap text-pink-100 text-sm leading-relaxed">{guide}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
