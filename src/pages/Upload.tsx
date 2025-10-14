import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const navigate = useNavigate();

  // Auth is session-based (Flask session). No localStorage user id.
  const [unauthorized, setUnauthorized] = useState(false);

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

      // Navigate to summary page with the response data
      navigate("/summary", { state: { summary: data.summary, result: data } });
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
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
      <div className="container mx-auto max-w-2xl text-white">
        <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upload Notes or Book Excerpts</span>
              <Button
                type="button"
                className="bg-[#852E4E] hover:bg-[#A33757]"
                onClick={() => navigate(-1)}
              >
                Back
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Course selection row */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Course</label>
                <div className="flex items-center gap-2">
                  <select
                    className="block w-full border rounded p-2 bg-[#4C1D3D]/60 text-white border-pink-700/40 focus:outline-none focus:ring-2 focus:ring-pink-400/40"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : "")}
                    disabled={unauthorized}
                  >
                    <option value="">None</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button type="button" onClick={() => setIsCourseModalOpen(true)} className="bg-[#852E4E] hover:bg-[#A33757]">
                    Add Course
                  </Button>
                </div>
                {unauthorized && (
                  <p className="text-xs text-pink-200">You are not logged in. Log in to view and manage your courses.</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Choose file</label>
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 file:bg-[#852E4E] file:text-white file:border-0 file:px-3 file:py-1.5"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={loading} className="bg-[#852E4E] hover:bg-[#A33757]">
                  {loading ? "Uploading..." : "Upload & Summarize"}
                </Button>
              </div>

              {error && <p className="text-sm text-red-300">{error}</p>}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Add Course Modal */}
      <Dialog open={isCourseModalOpen} onOpenChange={setIsCourseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Course</DialogTitle>
            <DialogDescription>Create a new course to organize your uploads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name/Course Code</label>
              <input
                className="w-full border rounded p-2"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="What's the Name or Course Code of the course you wish to add?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full border rounded p-2"
                rows={4}
                value={newCourseDescription}
                onChange={(e) => setNewCourseDescription(e.target.value)}
                placeholder="Write a description of the course (this is mostly for if you wish to revisit courses you've completed)"
              />
            </div>
            {courseFormError && <p className="text-red-600 text-sm">{courseFormError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded border"
                onClick={() => setIsCourseModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-blue-600 text-white"
                onClick={handleCreateCourse}
              >
                Submit
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
