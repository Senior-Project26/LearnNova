import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      } catch (e: any) {
        if (!mounted) return;
        console.error(e);
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
    } catch (err: any) {
      setError(err?.message || "Upload failed");
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
    } catch (e: any) {
      setCourseFormError(e?.message || "Failed to create course");
    }
  };

  return (
    <div className="container mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Upload a file</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Course selection row */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Course</label>
          <div className="flex items-center gap-2">
            <select
              className="block w-full border rounded p-2 bg-white"
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
            <button
              type="button"
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setIsCourseModalOpen(true)}
            >
              Add Course
            </button>
          </div>
          {unauthorized && (
            <p className="text-xs text-muted-foreground">You are not logged in. Log in to view and manage your courses.</p>
          )}
        </div>

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
