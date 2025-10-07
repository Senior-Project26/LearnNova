import { useEffect, useMemo, useState } from "react";

export default function StudyGuide() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);

  // Prefill from last summary if available
  useEffect(() => {
    try {
      const last = sessionStorage.getItem("lastUploadResult");
      if (last && !text) {
        const parsed = JSON.parse(last);
        if (parsed?.summary && typeof parsed.summary === "string") {
          setText(parsed.summary);
        }
      }
    } catch {}
  }, []);

  const disableSubmit = useMemo(() => text.trim().length < 300, [text]);

  const generateGuide = async () => {
    setError(null);
    setGuide(null);
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5050/api/study_guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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
      <h1 className="text-2xl font-semibold">Study Guide Generator</h1>
      {!guide && (
        <div className="space-y-3">
          <label className="block">
            <span className="font-medium">Paste notes or summary</span>
            <textarea
              className="mt-2 w-full min-h-40 p-3 border rounded"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your notes or summary here..."
            />
          </label>
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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Study Guide</h2>
            <button
              className="px-3 py-1.5 bg-gray-800 text-white rounded"
              onClick={() => { setGuide(null); setError(null); }}
            >
              New Guide
            </button>
          </div>
          <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded border">{guide}</pre>
        </div>
      )}
    </div>
  );
}
