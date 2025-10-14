import { useEffect, useMemo, useState } from "react";
import MarkdownMathRenderer from "@/components/MarkdownMathRenderer";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw } from "lucide-react";

interface Flashcard {
  question: string;
  answer: string;
}

type ComboOption = { id: number; title: string };
type ApiList<T> = { items?: T[] };
interface Course { id: number; name: string }
type CoursesResponse = { courses?: Course[] };
type StudySetCreateResponse = { id?: number; name?: string; error?: string };
type ContentItem = { title?: string; content?: string };
type ErrorResponse = { error?: string };

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
        className="mt-2 w-full p-2 border rounded flex items-center justify-between bg-[#4C1D3D]/60 text-white border-pink-700/40 hover:bg-[#4C1D3D]/70"
        onClick={() => setOpen(o => !o)}
      >
        <span>{count > 0 ? `${count} selected` : `Select ${label.toLowerCase()}`}</span>
        <span className="text-gray-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-[#4C1D3D] border border-pink-700/40 rounded shadow-lg p-2 text-white">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1 rounded bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 focus:outline-none focus:ring-2 focus:ring-pink-400/40"
            />
            <button
              className="text-xs px-2 py-1 rounded bg-[#852E4E] text-white hover:bg-[#A33757]"
              onClick={clearAll}
              type="button"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-56 overflow-auto space-y-1">
            {filtered.map(opt => (
              <li key={opt.id}>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#852E4E]/30 cursor-pointer">
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
              <li className="text-xs text-pink-200 px-2 py-1">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const Flashcards = () => {
  const location = useLocation() as { state?: { mode?: "create" | "generate" } };
  const modeFromNav = location.state?.mode;
  const [mode, setMode] = useState<"create" | "generate">(modeFromNav === "create" ? "create" : "generate");

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Generate-mode selections
  const [allNotes, setAllNotes] = useState<ComboOption[]>([]);
  const [allSummaries, setAllSummaries] = useState<ComboOption[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<number[]>([]);
  const disableGenerate = useMemo(
    () => !text.trim() && (selectedNoteIds.length + selectedSummaryIds.length) <= 0,
    [text, selectedNoteIds, selectedSummaryIds]
  );

  useEffect(() => {
    if (mode !== "generate") return;
    (async () => {
      try {
        const [nRes, sRes] = await Promise.all([
          fetch("/api/all_notes", { credentials: "include" }),
          fetch("/api/all_summaries", { credentials: "include" }),
        ]);
        if (nRes.ok) {
          const n: ApiList<ComboOption> = await nRes
            .json()
            .catch(() => ({ items: [] } as ApiList<ComboOption>));
          setAllNotes((n.items ?? []).map(x => ({ id: x.id, title: x.title })));
        }
        if (sRes.ok) {
          const s: ApiList<ComboOption> = await sRes
            .json()
            .catch(() => ({ items: [] } as ApiList<ComboOption>));
          setAllSummaries((s.items ?? []).map(x => ({ id: x.id, title: x.title })));
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [mode]);

  // Create-mode local editable card state
  const [isFront, setIsFront] = useState(true);
  const [frontText, setFrontText] = useState("");
  const [backText, setBackText] = useState("");

  // Create-mode: Course dropdown (from DB)
  const [courses, setCourses] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");

  useEffect(() => {
    // Load courses on mount and when mode changes
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/courses", { credentials: "include" });
        const data: CoursesResponse = await res
          .json()
          .catch(() => ({} as CoursesResponse));
        if (!mounted) return;
        if (res.status === 401) {
          setUnauthorized(true);
          setCourses([]);
          return;
        }
        if (res.ok) {
          const list = Array.isArray(data.courses) ? data.courses : [];
          setCourses(list.map((c: Course) => ({ id: c.id, name: c.name })));
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false; };
  }, [mode]);

  const addCourse = async () => {
    const name = newCourseName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description: name }),
      });
      const data = (await res.json().catch(() => ({}))) as { course?: { id?: number; name?: string }; error?: string };
      const createdId = data?.course?.id;
      const createdName = data?.course?.name || name;
      if (!res.ok || typeof createdId !== "number") throw new Error(data?.error || `Failed to add course (${res.status})`);
      setCourses(prev => [...prev, { id: createdId!, name: createdName }]);
      setSelectedCourseId(createdId!);
      setNewCourseName("");
    } catch (e) {
      console.error(e);
    }
  };

  // Create-mode: Study Set list from backend; show 'Default Set' only when list is empty
  const [studySets, setStudySets] = useState<Array<{ id: number; name: string }>>([]);
  const [newSetName, setNewSetName] = useState("");
  const [selectedStudySetId, setSelectedStudySetId] = useState<number | "" | "new">("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Per-generated-card controls
  const [perCardSelectedSet, setPerCardSelectedSet] = useState<Record<number, string | number>>({});
  const [perCardNewSetName, setPerCardNewSetName] = useState<Record<number, string>>({});
  const [perCardMsg, setPerCardMsg] = useState<Record<number, string>>({});
  const [perCardLoading, setPerCardLoading] = useState<Record<number, boolean>>({});

  const addGeneratedCardToSet = async (idx: number, card: Flashcard) => {
    try {
      setPerCardMsg(m => ({ ...m, [idx]: "" }));
      setPerCardLoading(m => ({ ...m, [idx]: true }));
      let targetSetId: number | null = null;
      const choice = perCardSelectedSet[idx];
      if (!choice || choice === "") return; // require a selection
      if (choice === "new") {
        const name = (perCardNewSetName[idx] || "").trim();
        if (!name) return;
        const res = await fetch("/api/study_sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, course_id: typeof selectedCourseId === "number" ? selectedCourseId : null }),
        });
        const j = (await res.json().catch(() => ({}))) as StudySetCreateResponse;
        if (!res.ok || typeof j?.id !== "number") throw new Error(j?.error || `Failed to create set (${res.status})`);
        targetSetId = j.id!;
        setStudySets(prev => [...prev, { id: targetSetId!, name }]);
        setPerCardNewSetName(m => ({ ...m, [idx]: "" }));
        setPerCardSelectedSet(m => ({ ...m, [idx]: String(targetSetId) }));
      } else if (choice === "default") {
        const res = await fetch("/api/study_sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: "Default Set", course_id: typeof selectedCourseId === "number" ? selectedCourseId : null }),
        });
        const j = (await res.json().catch(() => ({}))) as StudySetCreateResponse;
        if (!res.ok || typeof j?.id !== "number") throw new Error(j?.error || `Failed to create Default Set (${res.status})`);
        targetSetId = j.id!;
        setStudySets(prev => [...prev, { id: targetSetId!, name: "Default Set" }]);
        setPerCardSelectedSet(m => ({ ...m, [idx]: String(targetSetId) }));
      } else {
        targetSetId = Number(choice);
      }

      if (typeof targetSetId === "number") {
        const res2 = await fetch(`/api/study_sets/${targetSetId}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ question: card.question, answer: card.answer }),
        });
        const j2: ErrorResponse = (await res2.json().catch(() => ({} as ErrorResponse)));
        if (!res2.ok) throw new Error(j2?.error || `Failed to add card (${res2.status})`);
        const setName = choice === "default" ? "Default Set" : (choice === "new" ? (perCardNewSetName[idx] || "New Set") : (studySets.find(s => String(s.id) === String(choice))?.name || "Set"));
        setPerCardMsg(m => ({ ...m, [idx]: `Flashcard added to ${setName}.` }));
      }
    } catch (e) {
      console.error(e);
      setPerCardMsg(m => ({ ...m, [idx]: "Failed to add flashcard." }));
    } finally {
      setPerCardLoading(m => ({ ...m, [idx]: false }));
    }
  };

  // Load study sets from backend (optionally filtered by course)
  useEffect(() => {
    // Load study sets for the selected course (available in both modes)
    let mounted = true;
    (async () => {
      try {
        const qs = selectedCourseId ? `?course_id=${selectedCourseId}` : "";
        const res = await fetch(`/api/study_sets${qs}`, { credentials: "include" });
        const data: ApiList<{ id: number; name: string }> = await res
          .json()
          .catch(() => ({ items: [] }));
        if (!mounted) return;
        if (res.ok) {
          const items = Array.isArray(data.items) ? data.items : [];
          setStudySets(items.map(x => ({ id: x.id, name: x.name })));
          if (items.length === 0) {
            setSelectedStudySetId("new");
          }
        } else if (res.status === 401) {
          setStudySets([]);
        }
      } catch {
        if (!mounted) return;
        setStudySets([]);
      }
    })();
    return () => { mounted = false; };
  }, [mode, selectedCourseId]);

  const addStudySet = async () => {
    const name = newSetName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/study_sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, course_id: typeof selectedCourseId === "number" ? selectedCourseId : null }),
      });
      const data: StudySetCreateResponse = await res
        .json()
        .catch(() => ({} as StudySetCreateResponse));
      if (!res.ok) throw new Error(data.error || `Failed to add study set (${res.status})`);
      const created = data;
      if (typeof created?.id === "number") {
        setStudySets(prev => [...prev, { id: created.id, name }]);
        setSelectedStudySetId(created.id);
        setNewSetName("");
      }
    } catch (e) {
      // keep UI silent for now
      console.error(e);
    }
  };

  const generate = async () => {
    setError(null);
    setLoading(true);
    setCards([]);
    try {
      // Build combined text from selections if provided
      let combined = text.trim();
      if (!combined && (selectedNoteIds.length > 0 || selectedSummaryIds.length > 0)) {
        const notePromises = selectedNoteIds.map(async (id) => {
          const r = await fetch(`/api/notes/${id}`, { credentials: "include" });
          const j: ContentItem = await r.json().catch(() => ({} as ContentItem));
          return (j?.title ? `# Note: ${j.title}\n` : "") + (j?.content || "");
        });
        const summaryPromises = selectedSummaryIds.map(async (id) => {
          const r = await fetch(`/api/summaries/${id}`, { credentials: "include" });
          const j: ContentItem = await r.json().catch(() => ({} as ContentItem));
          return (j?.title ? `# Summary: ${j.title}\n` : "") + (j?.content || "");
        });
        const parts = await Promise.all([...notePromises, ...summaryPromises]);
        combined = parts.filter(Boolean).join("\n\n").trim();
      }

      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim() || "Flashcards",
          text: combined,
          course_id: typeof selectedCourseId === "number" ? selectedCourseId : null,
        }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({} as ErrorResponse))).error || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      const data = await res.json();
      const list: Flashcard[] = Array.isArray(data?.cards) ? data.cards : [];
      setCards(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate flashcards.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
      <div className="container mx-auto space-y-6 text-white">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
            {mode === "create" ? "Create Flashcards" : "Generate Flashcards (AI)"}
          </h1>
          {mode === "generate" ? (
            <p className="text-pink-100">Select notes and summaries or paste text, then generate AI flashcards.</p>
          ) : (
            <p className="text-pink-100">Write your question or definition on the front and your answer on the back. Flip the card anytime to review or edit. You can also add cards to a study set for easier organization and review.</p>
          )}
        </div>

        {/* Global Course selector */}
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
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="New course name"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              className="bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 focus-visible:ring-pink-400/40"
            />
            <Button type="button" onClick={addCourse} className="bg-[#852E4E] hover:bg-[#A33757]">Add Course</Button>
          </div>
          {unauthorized && (
            <p className="text-xs text-pink-200">Log in to view and create your courses.</p>
          )}
        </div>

        {mode === "generate" ? (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white">
            <CardHeader>
              <CardTitle>Generate from your content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="space-y-2">
                <label className="text-sm text-pink-200">Or paste additional text</label>
                <Textarea
                  placeholder="Paste your notes or summary here... (optional)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-40 bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 focus-visible:ring-pink-400/40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Set title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 focus-visible:ring-pink-400/40"
                />
                <Button onClick={generate} disabled={loading || disableGenerate} className="bg-[#852E4E] hover:bg-[#A33757]">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
                </Button>
              </div>
              {error && <div className="text-sm text-red-300">{error}</div>}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white">
            <CardHeader>
              <CardTitle>Draft a Flashcard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Study Set selector (local only) */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Study Set</label>
                <div className="flex items-center gap-2">
                  <select
                    className="block w-full border rounded p-2 bg-[#4C1D3D]/60 text-white border-pink-700/40 focus:outline-none focus:ring-2 focus:ring-pink-400/40"
                    value={String(selectedStudySetId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") return setSelectedStudySetId("");
                      if (v === "new") return setSelectedStudySetId("new");
                      setSelectedStudySetId(Number(v));
                    }}
                  >
                    {studySets.length === 0 ? (
                      // Only Create New when no custom study sets exist
                      <option value="new">Create New…</option>
                    ) : (
                      <>
                        <option value="new">Create New…</option>
                        {studySets.map((studySet) => (
                          <option key={studySet.id} value={studySet.id}>{studySet.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                  <Button type="button" onClick={addStudySet} className="bg-[#852E4E] hover:bg-[#A33757]">Add</Button>
                </div>
                {selectedStudySetId === "new" && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Name your set"
                      value={newSetName}
                      onChange={(e) => setNewSetName(e.target.value)}
                      className="bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 focus-visible:ring-pink-400/40"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="text-[#FFBB94] border-[#FFBB94] hover:bg-[#852E4E]/30"
                  onClick={() => setIsFront(f => !f)}
                  title="Flip card"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 rounded-lg bg-[#852E4E]/30 border border-pink-700/40">
                <div className="text-sm text-pink-200 mb-2">
                  {isFront
                    ? "Write the question or definition on this side"
                    : "Write the word or answer to the question on this side"}
                </div>
                {isFront ? (
                  <Textarea
                    placeholder="Front (question/definition)"
                    value={frontText}
                    onChange={(e) => setFrontText(e.target.value)}
                    className="min-h-32 bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 focus-visible:ring-pink-400/40"
                  />
                ) : (
                  <Textarea
                    placeholder="Back (answer/term)"
                    value={backText}
                    onChange={(e) => setBackText(e.target.value)}
                    className="min-h-32 bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 focus-visible:ring-pink-400/40"
                  />
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#852E4E] hover:bg-[#A33757]"
                  disabled={
                    selectedStudySetId === "" ||
                    !frontText.trim() ||
                    !backText.trim() ||
                    (selectedStudySetId === "new" && !newSetName.trim())
                  }
                  onClick={async () => {
                    if (selectedStudySetId === "") return;
                    if (!frontText.trim() || !backText.trim()) {
                      setSaveError("Please fill both the front and the back before saving.");
                      return;
                    }
                    setSaveError(null);
                    try {
                      let targetSetId: number | null = null;
                      if (selectedStudySetId === "new") {
                        const name = newSetName.trim();
                        if (!name) return;
                        setSaveLoading(true);
                        const res = await fetch("/api/study_sets", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ name, course_id: typeof selectedCourseId === "number" ? selectedCourseId : null }),
                        });
                        const data = (await res.json().catch(() => ({} as StudySetCreateResponse))) as StudySetCreateResponse;
                        if (!res.ok || typeof data?.id !== "number") {
                          throw new Error(data?.error || `Failed to create study set (${res.status})`);
                        }
                        targetSetId = Number(data.id);
                        setStudySets(prev => [...prev, { id: targetSetId!, name }]);
                        setSelectedStudySetId(targetSetId);
                        setNewSetName("");
                      } else {
                        // Use the existing selected study set
                        targetSetId = Number(selectedStudySetId);
                        setSaveLoading(true);
                      }

                      // If we have a target set, attempt to save the flashcard
                      if (typeof targetSetId === "number") {
                        const res2 = await fetch(`/api/study_sets/${targetSetId}/cards`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ question: frontText.trim(), answer: backText.trim() }),
                        });
                        const j: ErrorResponse = await res2.json().catch(() => ({} as ErrorResponse));
                        if (!res2.ok) {
                          throw new Error(j?.error || `Failed to save (${res2.status})`);
                        }
                        // Reset inputs after successful save
                        setFrontText("");
                        setBackText("");
                      }
                    } catch (e: unknown) {
                      setSaveError(e instanceof Error ? e.message : "Failed to save flashcard.");
                    } finally {
                      setSaveLoading(false);
                    }
                  }}
                >
                  {saveLoading ? "Saving…" : "Save"}
                </Button>
              </div>
              {saveError && <div className="text-sm text-red-300 mt-2">{saveError}</div>}
            </CardContent>
          </Card>
        )}
        {cards.length > 0 && (
          <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white">
            <CardHeader>
              <CardTitle>Generated Flashcards ({cards.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-3">
                {cards.map((c, idx) => (
                  <li key={idx} className="p-3 rounded-md bg-[#852E4E]/40">
                    <div className="font-semibold text-[#FFBB94]">
                      Q:
                      <MarkdownMathRenderer text={c.question} />
                    </div>
                    <div className="text-pink-100 mt-1">
                      A:
                      <MarkdownMathRenderer text={c.answer} />
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          className="block w-56 border rounded p-2 bg-[#4C1D3D]/60 text-white border-pink-700/40 focus:outline-none focus:ring-2 focus:ring-pink-400/40"
                          value={String(perCardSelectedSet[idx] ?? "")}
                          onChange={(e) => setPerCardSelectedSet(m => ({ ...m, [idx]: e.target.value }))}
                        >
                          <option value="">Select Set…</option>
                          <option value="default">Default Set</option>
                          <option value="new">Create New…</option>
                          {studySets.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          disabled={!perCardSelectedSet[idx] || perCardSelectedSet[idx] === "new" && !(perCardNewSetName[idx] || "").trim() || !!perCardLoading[idx]}
                          onClick={() => addGeneratedCardToSet(idx, c)}
                          className="bg-[#852E4E] hover:bg-[#A33757]"
                        >
                          {perCardLoading[idx] ? "Adding…" : "Add to Set"}
                        </Button>
                      </div>
                      {perCardSelectedSet[idx] === "new" && (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="New set name"
                            value={perCardNewSetName[idx] || ""}
                            onChange={(e) => setPerCardNewSetName(m => ({ ...m, [idx]: e.target.value }))}
                            className="bg-[#4C1D3D]/60 text-white placeholder-pink-200/60 border border-pink-700/40 focus-visible:ring-pink-400/40 w-56"
                          />
                        </div>
                      )}
                      {perCardMsg[idx] && (
                        <div className="text-xs text-pink-200">{perCardMsg[idx]}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Flashcards;
