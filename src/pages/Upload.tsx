import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("http://127.0.0.1:5000/api/upload", {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
      }

      // Navigate to summary page with the response data
      navigate("/summary", { state: { summary: data.summary, result: data } });
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Upload a file</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Upload & Summarize"}
        </button>
      </form>
      {error && <p className="text-red-600 mt-3">{error}</p>}
    </div>
  );
}
