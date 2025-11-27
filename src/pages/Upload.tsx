import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload as UploadIcon, FileText, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Array<{ id: number; name: string; description: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">("");
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [uploadExtractedText, setUploadExtractedText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSummaryId, setSavedSummaryId] = useState<number | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
  const navigate = useNavigate();

  // Auth is session-based (Flask session). No localStorage user id.
  const [unauthorized, setUnauthorized] = useState(false);
  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleSaveNotesAndSummary = async () => {
    if (!uploadSummary && !uploadExtractedText) return;
    try {
      setSaving(true);
      setSaveError(null);
      const baseTitle = file?.name ? file.name.replace(/\.[^/.]+$/, "") : "Uploaded Note";

      if (uploadExtractedText && !savedNoteId) {
        const resNote = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: `${baseTitle} (Notes)`,
            content: uploadExtractedText,
          }),
        });
        if (resNote.ok) {
          const j = await resNote.json().catch(() => ({}));
          const nid = typeof j?.id === "number" ? j.id : null;
          setSavedNoteId(nid);
        }
      }

      if (uploadSummary && !savedSummaryId) {
        const resSummary = await fetch("/api/summaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: `${baseTitle} (Summary)`,
            content: uploadSummary,
            topics: [],
            course_id: selectedCourseId === "" ? null : selectedCourseId,
          }),
        });
        if (resSummary.ok) {
          const j = await resSummary.json().catch(() => ({}));
          const sid = typeof j?.id === "number" ? j.id : null;
          setSavedSummaryId(sid);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save notes and summary";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer?.files?.[0] || null;
    if (dropped) {
      setFile(dropped);
      setError(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const fetchCourses = async () => {
      try {
        // Check Flask session first with small retries to avoid Set-Cookie race
        let sessOk = false;
        for (let i = 0; i < 3; i++) {
          const s = await fetch("/api/session", { credentials: "include" });
          if (s.ok) { sessOk = true; break; }
          await delay(150);
        }
        if (!sessOk) {
          if (!mounted) return;
          setUnauthorized(true);
          setCourses([]);
          return;
        }

        // Load courses (retry once on a transient 401)
        let res = await fetch("/api/courses", { credentials: "include" });
        if (res.status === 401) {
          await delay(150);
          res = await fetch("/api/courses", { credentials: "include" });
        }
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (res.status === 401) {
          setUnauthorized(true);
          setCourses([]);
          return;
        }
        if (!res.ok) throw new Error(data?.error || `Failed to fetch courses (${res.status})`);
        const list = Array.isArray(data?.courses) ? data.courses : [];
        setUnauthorized(false);
        setCourses(list);
      } catch (e: unknown) {
        if (e instanceof Error) {
          if (!mounted) return;
          console.error(e);
        } else {
          console.error("Unknown error:", e);
        }
      }
    };
    fetchCourses();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveError(null);
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
      }
      const summaryText = typeof data?.summary === "string" ? data.summary : null;
      const extractedText = typeof data?.extracted_text === "string" ? data.extracted_text : null;
      setUploadSummary(summaryText);
      setUploadExtractedText(extractedText);
      setSavedSummaryId(null);
      setSavedNoteId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    setCourseFormError(null);
    if (!newCourseName.trim() || !newCourseDescription.trim()) {
      setCourseFormError("Both fields are required.");
      return;
    }
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newCourseName.trim(), description: newCourseDescription.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setCourseFormError("You must be logged in to add a course.");
        return;
      }
      if (!res.ok) throw new Error(data?.error || `Failed to create course (${res.status})`);
      const created = data?.course;
      if (created && typeof created.id === "number") {
        // Refresh list and select the newly created course
        setCourses((prev) => [...prev, created].sort((a, b) => a.id - b.id));
        setSelectedCourseId(created.id);
      }
      setIsCourseModalOpen(false);
      setNewCourseName("");
      setNewCourseDescription("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create course";
      setCourseFormError(msg);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text mb-2">
            Upload Your Materials
          </h1>
          <p className="text-pink-100 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FB9590]" />
            Transform your documents into study materials
          </p>
        </div>

        {/* Upload Card */}
        <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-[#852E4E]/40 rounded-lg">
                <UploadIcon className="h-5 w-5 text-[#FB9590]" />
              </div>
              <span className="text-pink-100">Upload File</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
                  isDragging
                    ? "border-[#FB9590] bg-[#852E4E]/40"
                    : "border-pink-700/40 bg-[#852E4E]/20 hover:bg-[#852E4E]/30"
                }`}
              >
                <input
                  type="file"
                  id="file-input"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] || null;
                    setFile(selectedFile);
                    setError(null);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-4 text-center pointer-events-none">
                  <div className="p-4 bg-[#852E4E]/40 rounded-full">
                    <FileText className="h-12 w-12 text-[#FFBB94]" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-pink-100 mb-1">
                      {file ? file.name : "Drop your file here"}
                    </p>
                    <p className="text-sm text-pink-300/70">
                      or click to browse
                    </p>
                  </div>
                  {file && (
                    <div className="mt-2 px-4 py-2 bg-[#852E4E]/60 rounded-lg border border-pink-700/40">
                      <p className="text-xs text-[#FFBB94]">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !file}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#DC586D] to-[#A33757] text-white rounded-xl font-medium shadow-lg hover:shadow-pink-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Upload & Summarize</span>
                  </>
                )}
              </button>

              {(uploadSummary || uploadExtractedText) && (
                <div className="mt-6 space-y-4">
                  {saveError && (
                    <div className="flex items-start gap-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-200">{saveError}</p>
                    </div>
                  )}

                  {uploadSummary && (
                    <div className="p-4 rounded-lg bg-[#852E4E]/20 border border-pink-700/40">
                      <p className="text-sm font-semibold text-pink-100 mb-2">Summary Preview</p>
                      <p className="text-sm text-pink-200 whitespace-pre-wrap max-h-40 overflow-y-auto">{uploadSummary}</p>
                    </div>
                  )}

                  {uploadExtractedText && (
                    <div className="p-4 rounded-lg bg-[#852E4E]/20 border border-pink-700/40">
                      <p className="text-sm font-semibold text-pink-100 mb-2">Original Notes Preview</p>
                      <p className="text-sm text-pink-200 whitespace-pre-wrap max-h-40 overflow-y-auto">{uploadExtractedText}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveNotesAndSummary}
                    disabled={saving || (!!savedNoteId && !!savedSummaryId)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#DC586D] to-[#A33757] text-white rounded-xl font-medium shadow-lg hover:shadow-pink-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        <span>Saving...</span>
                      </>
                    ) : savedNoteId || savedSummaryId ? (
                      <span>Saved</span>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        <span>Save Notes & Summary</span>
                      </>
                    )}
                  </button>

                  {uploadSummary && (
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/summary", {
                          state: {
                            summary: uploadSummary,
                            result: {
                              extracted_text: uploadExtractedText ?? undefined,
                              filename: file?.name,
                            },
                          },
                        });
                      }}
                      className="w-full px-6 py-3 bg-[#4C1D3D] border border-pink-700/60 text-[#FFBB94] rounded-xl font-medium shadow-lg hover:shadow-pink-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <FileText className="h-5 w-5" />
                      <span>View Summary Page</span>
                    </button>
                  )}
                </div>
              )}
            </form>

            {/* Info Section */}
            <div className="mt-6 pt-6 border-t border-pink-700/30">
              <p className="text-sm text-pink-300/70 text-center">
                Supported formats: PDF, DOCX, TXT, and more
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
