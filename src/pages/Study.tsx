import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import MarkdownMathRenderer from "@/components/MarkdownMathRenderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  BookOpen,
  FileUp,
  Brain,
  Sparkles,
  Trash2,
  Plus,
  FolderOpen,
  PenTool,
} from "lucide-react";

type RecentItem = { type: 'study_set' | 'study_guide' | 'note' | 'summary'; id: number; name?: string; title?: string; created_at?: string };
type RecentResponse = { items?: RecentItem[]; error?: string };
type StudySetListItem = { id: number; name?: string; course?: { name?: string }; cards?: unknown[]; cardsCount?: number };
type StudySetListResponse = { items?: StudySetListItem[]; error?: string };
type NoteOrSummary = { title?: string; content?: string; error?: string };

const Study = () => {
  // ---- STATE ----
  const navigate = useNavigate();
  const [studySets, setStudySets] = useState<Array<{ id: number; name: string; cardsCount: number; courseName?: string }>>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [setsError, setSetsError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ type: 'study_set' | 'study_guide' | 'note' | 'summary'; id: number; name?: string; title?: string; created_at?: string }>>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalBody, setModalBody] = useState<string>("");
  const [modalLoading, setModalLoading] = useState(false);
  const [currentRecentIndex, setCurrentRecentIndex] = useState<number | null>(null);

  const openRecentAt = async (i: number) => {
    const items = recent;
    if (i < 0 || i >= items.length) return;
    const it = items[i];
    if (it.type === 'note' || it.type === 'summary') {
      const label = it.title || `${it.type === 'note' ? 'Note' : 'Summary'} #${it.id}`;
      try {
        setModalTitle(label);
        setModalBody("");
        setModalLoading(true);
        setModalOpen(true);
        setCurrentRecentIndex(i);
        const path = it.type === 'note' ? `/api/notes/${it.id}` : `/api/summaries/${it.id}`;
        const r = await fetch(path, { credentials: 'include' });
        const j: { title?: string; content?: string; error?: string } = await r.json().catch(() => ({} as { title?: string; content?: string; error?: string }));
        if (r.ok) {
          setModalTitle(j?.title || label);
          setModalBody(j?.content || "");
        } else {
          setModalBody(j?.error || `Failed to load ${it.type}`);
        }
      } finally {
        setModalLoading(false);
      }
    } else if (it.type === 'study_set') {
      navigate(`/study-set/${it.id}`);
    } else if (it.type === 'study_guide') {
      navigate('/study-guide', { state: { studyGuideId: it.id } });
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/recent_sets', { credentials: 'include' });
        const data = (await res.json().catch(() => ({}))) as unknown as RecentResponse;
        if (!res.ok) throw new Error(data?.error || `Failed to load recent (${res.status})`);
        const items = Array.isArray(data?.items) ? data.items : [];
        setRecent(items);
      } catch (e: unknown) {
        setRecent([]);
        setRecentError(e instanceof Error ? e.message : 'Failed to load recent');
      }
    })();
  }, []);

  // Load user's study sets with card counts and course names (if provided by API)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingSets(true);
      setSetsError(null);
      try {
        const res = await fetch('/api/study_sets', { credentials: 'include' });
        const data = (await res.json().catch(() => ({}))) as unknown as StudySetListResponse;
        if (!mounted) return;
        if (!res.ok) throw new Error(data?.error || `Failed to load sets (${res.status})`);
        const items: StudySetListItem[] = Array.isArray(data?.items) ? data.items! : [];
        // For each set, optionally fetch details to get card count and course
        const enriched = await Promise.all(items.map(async (it) => {
          try {
            const r = await fetch(`/api/study_sets/${it.id}`, { credentials: 'include' });
            const j = (await r.json().catch(() => ({}))) as unknown as { cards?: unknown[]; course?: { name?: string } };
            const cardsCount = Array.isArray(j?.cards) ? j.cards!.length : (typeof it.cardsCount === 'number' ? it.cardsCount! : 0);
            const courseName = j?.course?.name || it?.course?.name || undefined;
            return { id: Number(it.id), name: String(it.name || `Set #${it.id}`), cardsCount, courseName };
          } catch {
            return { id: Number(it.id), name: String(it.name || `Set #${it.id}`), cardsCount: 0, courseName: undefined };
          }
        }));
        setStudySets(enriched);
      } catch (e: unknown) {
        if (!mounted) return;
        setSetsError(e instanceof Error ? e.message : 'Failed to load study sets');
        setStudySets([]);
      } finally {
        if (mounted) setLoadingSets(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ---- HANDLERS ----
  const openSet = (id: number) => navigate(`/study-set/${id}`);

  // ---- COMPUTED PROGRESS ----
  const totalProgress = 0;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
      <div className="relative container mx-auto space-y-8 text-white">
        {/* --- Header --- */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
            Your Study Hub
          </h1>
          <p className="text-pink-100">
            Manage your notes, flashcards, and quizzes — powered by LearnNova AI ✨
          </p>
        </div>

        {/* --- Main Grid --- */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* --- Left Column --- */}
          <div className="md:col-span-2 space-y-6">
            {/* Progress Tracker */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-[#FB9590]" /> Study Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Total Progress</span>
                  <span>{totalProgress}%</span>
                </div>
                <Progress value={totalProgress} className="bg-[#852E4E]" />
              </CardContent>
            </Card>

            {/* Recent Sets */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle>Recent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentError && <div className="text-sm text-red-300">{recentError}</div>}
                {recent.length === 0 && !recentError && (
                  <div className="text-sm text-pink-200">No recent items.</div>
                )}
                {recent.map((it, i) => {
                  const when = it.created_at ? new Date(it.created_at).toLocaleString() : '';
                  let label = `#${it.id}`;
                  let badge = '';
                  let onOpen: (() => void) | null = null;
                  if (it.type === 'study_set') {
                    label = it.name || `Set #${it.id}`;
                    badge = 'Flashcards';
                    onOpen = () => navigate(`/study-set/${it.id}`);
                  } else if (it.type === 'study_guide') {
                    label = it.title || `Guide #${it.id}`;
                    badge = 'Study Guide';
                    onOpen = () => navigate('/study-guide', { state: { studyGuideId: it.id } });
                  } else if (it.type === 'note') {
                    label = it.title || `Note #${it.id}`;
                    badge = 'Note';
                    onOpen = async () => {
                      await openRecentAt(i);
                    };
                  } else if (it.type === 'summary') {
                    label = it.title || `Summary #${it.id}`;
                    badge = 'Summary';
                    onOpen = async () => {
                      await openRecentAt(i);
                    };
                  }
                  return (
                    <div key={`${it.type}-${it.id}`} className="flex items-center justify-between p-2 rounded bg-[#852E4E]/30 border border-pink-700/30">
                      <button type="button" onClick={onOpen ?? undefined} className="text-left">
                        <div className="font-medium text-[#FFBB94] hover:underline">{label}</div>
                        {when && <div className="text-xs text-pink-200">{when}</div>}
                      </button>
                      <div className="text-xs px-2 py-1 rounded border border-pink-600/50 text-pink-200">
                        {badge}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Your Study Sets */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle>Your Study Sets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {setsError && <div className="text-sm text-red-300">{setsError}</div>}
                {loadingSets && <div className="text-sm text-pink-200">Loading…</div>}
                {!loadingSets && studySets.length === 0 && !setsError && (
                  <div className="text-sm text-pink-200">No study sets yet.</div>
                )}
                {studySets.map((set) => (
                  <div key={set.id} className="p-4 rounded-lg bg-[#852E4E]/40 border border-pink-700/30 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#FFBB94]">{set.name}</div>
                      <div className="text-xs text-pink-200">{set.cardsCount} cards{set.courseName ? ` • ${set.courseName}` : ''}</div>
                    </div>
                    <Button onClick={() => openSet(set.id)} className="bg-[#852E4E] hover:bg-[#A33757]">Study</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* --- Right Column --- */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#FB9590]" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { icon: <PenTool className="h-4 w-4 mr-2" />, label: "Create New Flashcards", navigateTo: "/flashcards", state: { mode: "create" } },
                  { icon: <Sparkles className="h-4 w-4 mr-2" />, label: "Generate Flashcards (AI)", navigateTo: "/flashcards", state: { mode: "generate" } },
                  { icon: <Brain className="h-4 w-4 mr-2" />, label: "Generate Quiz", navigateTo: "/quiz" },
                  { icon: <FileUp className="h-4 w-4 mr-2" />, label: "Upload Notes or Book Excerpts", navigateTo: "/upload" },
                  { icon: <FolderOpen className="h-4 w-4 mr-2" />, label: "Create Study Guide", navigateTo: "/study-guide" },
                ].map((action, index) => (
                  <Button
                    key={index}
                    className="w-full justify-start transition-all font-medium bg-[#852E4E] hover:bg-[#A33757] text-white"
                    onClick={() => {
                      if ((action as { navigateTo?: string; state?: unknown }).navigateTo) {
                        const { navigateTo, state } = action as { navigateTo?: string; state?: unknown };
                        if (navigateTo) navigate(navigateTo, { state });
                      }
                    }}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Daily Tip */}
            <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white shadow-xl shadow-pink-900/20">
              <CardHeader>
                <CardTitle>Today’s Study Tip</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="italic text-pink-200">
                  “Study smarter, not longer — 25 minutes of focus beats 2 hours of distraction.” 🌙
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Modal mount */}
        <RecentModal
          open={modalOpen}
          onOpenChange={(v) => { setModalOpen(v); if (!v) setCurrentRecentIndex(null); }}
          title={modalTitle}
          body={modalBody}
          loading={modalLoading}
          canPrev={currentRecentIndex !== null && currentRecentIndex > 0}
          canNext={currentRecentIndex !== null && currentRecentIndex < recent.length - 1}
          onPrev={() => {
            if (currentRecentIndex === null) return;
            for (let j = currentRecentIndex - 1; j >= 0; j--) {
              const it = recent[j];
              if (it.type === 'note' || it.type === 'summary') { openRecentAt(j); break; }
            }
          }}
          onNext={() => {
            if (currentRecentIndex === null) return;
            for (let j = currentRecentIndex + 1; j < recent.length; j++) {
              const it = recent[j];
              if (it.type === 'note' || it.type === 'summary') { openRecentAt(j); break; }
            }
          }}
        />
      </div>
    </div>
  );
};

// Modal viewer for Notes/Summaries
function RecentModal({ open, onOpenChange, title, body, loading, canPrev, canNext, onPrev, onNext }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; body: string; loading: boolean; canPrev?: boolean; canNext?: boolean; onPrev?: () => void; onNext?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title || 'Item'}</DialogTitle>
          <DialogDescription className="sr-only">Recent item content</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="max-h-[70vh] overflow-auto text-sm bg-white rounded p-3">
            {loading ? 'Loading…' : <MarkdownMathRenderer text={body || 'No content'} />}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" disabled={!canPrev} onClick={onPrev} className="border-[#FFBB94] text-[#FFBB94]">Previous</Button>
            <Button variant="outline" disabled={!canNext} onClick={onNext} className="border-[#FFBB94] text-[#FFBB94]">Next</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export default Study;
