import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

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
  const extractedText: string = useMemo(() => String(extractedFromState || ""), [extractedFromState]);

  // Fetch latest ids to compute default next number for placeholder and fallback title
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [sRes, nRes] = await Promise.all([
          fetch("/api/dashboard/summaries", { credentials: "include" }),
          fetch("/api/dashboard/notes", { credentials: "include" }),
        ]);
        if (!mounted) return;
        if (sRes.ok) {
          const sj = await sRes.json();
          const ids: number[] = (sj.items || []).map((it: any) => Number(it.id)).filter((x: any) => Number.isFinite(x));
          const maxId = ids.length ? Math.max(...ids) : 0;
          setNextSummaryNumber(maxId + 1);
        }
        if (nRes.ok) {
          const nj = await nRes.json();
          const ids: number[] = (nj.items || []).map((it: any) => Number(it.id)).filter((x: any) => Number.isFinite(x));
          const maxId = ids.length ? Math.max(...ids) : 0;
          setNextNoteNumber(maxId + 1);
        }
      } catch {
        // ignore
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
    <div className="container mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Summary</h1>
      {!summary ? (
        <div className="space-y-3">
          <p>No summary data found. Please upload a file first.</p>
          <Link className="text-blue-600 underline" to="/upload">Go to Upload</Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="w-full max-w-xl px-3 py-2 border rounded"
              placeholder={`Title your ${showExtracted ? "Note" : "Summary"}. Defaults to '${showExtracted ? `Note #${nextNoteNumber ?? "?"}` : `Summary #${nextSummaryNumber ?? "?"}`}'`}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExtracted((s) => !s)}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            >
              {showExtracted ? "Show Summary" : "Show Extracted Text"}
            </button>
          </div>
          {showExtracted ? (
            <pre className="whitespace-pre bg-gray-50 p-4 rounded border overflow-x-auto">{extractedText || "(no extracted text)"}</pre>
          ) : (
            <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded border">{summary}</pre>
          )}
          {result && (
            <details className="mt-4">
              <summary className="cursor-pointer">View raw response</summary>
              <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded border mt-2">{JSON.stringify(result, null, 2)}</pre>
            </details>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={showExtracted ? ensureNoteSaved : ensureSummarySaved}
              disabled={(showExtracted ? !extractedText : !summary) || saving}
              className="px-4 py-2 bg-blue-700 text-white rounded disabled:opacity-60"
            >
              {showExtracted
                ? (savedNoteId ? "Saved" : "Save Notes")
                : (savedSummaryId ? "Saved" : "Save Summary")}
            </button>
            <span className="text-sm text-muted-foreground">
              If you select "Quiz Me!" or "Study Guide" your summary will automatically be saved if it hasn't been
            </span>
            <button onClick={quizMe} className="px-4 py-2 bg-green-600 text-white rounded">
              Quiz Me!
            </button>
            <button onClick={studyGuide} className="px-4 py-2 bg-purple-600 text-white rounded">
              Study Guide
            </button>
          </div>
          <Link className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded" to="/upload">
            Upload another file
          </Link>
        </div>
      )}
    </div>
  );
}
