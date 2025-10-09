import { useLocation, Link, useNavigate } from "react-router-dom";

export default function Summary() {
  const location = useLocation() as { state?: { summary?: string; result?: any } };
  const summary = location.state?.summary;
  const result = location.state?.result;
  const navigate = useNavigate();

  const quizMe = () => {
    if (!summary) return;
    try {
      // Persist summary for Quiz.tsx prefill
      sessionStorage.setItem(
        "lastUploadResult",
        JSON.stringify({ summary })
      );
    } catch {}
    navigate("/quiz");
  };

  const studyGuide = () => {
    if (!summary) return;
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
          <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded border">{summary}</pre>
          {result && (
            <details className="mt-4">
              <summary className="cursor-pointer">View raw response</summary>
              <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded border mt-2">{JSON.stringify(result, null, 2)}</pre>
            </details>
          )}
          <div className="flex items-center gap-3">
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
