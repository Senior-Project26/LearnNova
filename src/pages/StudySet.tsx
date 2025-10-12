import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import MarkdownMathRenderer from "@/components/MarkdownMathRenderer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Flashcard { question: string; answer: string }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function dynamicFontSize(text: string, isFront: boolean): React.CSSProperties {
  const t = (text || "").trim();
  const len = t.length || 1;
  // Larger font for short text, smaller for long
  // Map length (0..400) -> font size (2.5rem..1rem)
  const sizeRem = 2.5 - clamp(len, 0, 400) * (1.5 / 400);
  return {
    fontSize: `${sizeRem}rem`,
    lineHeight: 1.2,
    textAlign: "center",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    fontWeight: isFront ? 700 : 500,
  };
}

export default function StudySet() {
  const { sid } = useParams<{ sid: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  // Shuffled study order: holds indices into `cards`
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0); // position within `order`
  const [isFront, setIsFront] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/study_sets/${sid}`, { credentials: "include" });
        const j = await res.json().catch(() => ({} as any));
        if (!mounted) return;
        if (!res.ok) throw new Error((j as any)?.error || `Failed to load study set (${res.status})`);
        const cs: Flashcard[] = Array.isArray(j?.cards) ? j.cards : [];
        const nm = String(j?.name || "Study Set");
        setName(nm);
        setRenameInput(nm);
        setCards(cs);
        // Build shuffled order of indices so backend indices remain stable
        const base = Array.from({ length: cs.length }, (_, i) => i);
        for (let i = base.length - 1; i > 0; i--) {
          const r = Math.floor(Math.random() * (i + 1));
          [base[i], base[r]] = [base[r], base[i]];
        }
        setOrder(base);
        setIdx(0);
        setIsFront(true);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load study set.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [sid]);

  const canPrev = useMemo(() => idx > 0, [idx]);
  const canNext = useMemo(() => idx < Math.max(0, order.length - 1), [idx, order.length]);
  const current = useMemo(() => {
    if (order.length === 0) return null;
    const oi = order[idx] ?? 0;
    return cards[oi] ?? null;
  }, [cards, order, idx]);

  return (
    <>
    <div className="relative min-h-screen overflow-hidden px-4 pt-24 pb-12">
      <div className="container mx-auto text-white space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#FFBB94] to-[#FB9590] text-transparent bg-clip-text">
              {name || "Study Set"}
            </h1>
            <Button
              variant="outline"
              className="h-8 px-3 text-xs border-pink-400 text-pink-200 hover:bg-pink-500/10"
              onClick={() => { setRenameOpen(true); setRenameInput(name || ""); setRenameError(null); }}
            >
              Rename
            </Button>
          </div>
          <p className="text-pink-100 mt-1">{cards.length} flashcard{cards.length === 1 ? "" : "s"}</p>
        </div>

        <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Flashcard Viewer</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="text-[#FFBB94] border-[#FFBB94] hover:bg-[#852E4E]/30" onClick={() => setIsFront(f => !f)} title="Flip card">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-24 text-center text-pink-100">Loading…</div>
            ) : error ? (
              <div className="py-24 text-center text-red-300">{error}</div>
            ) : cards.length === 0 ? (
              <div className="py-24 text-center text-pink-100">No cards in this set yet.</div>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center">
                  <Button variant="ghost" disabled={!canPrev} onClick={() => { if (canPrev) { setIdx(i => i - 1); setIsFront(true); } }} className="hover:bg-transparent">
                    <ChevronLeft className={`h-12 w-12 ${canPrev ? "text-white" : "text-white/30"}`} />
                  </Button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <Button variant="ghost" disabled={!canNext} onClick={() => { if (canNext) { setIdx(i => i + 1); setIsFront(true); } }} className="hover:bg-transparent">
                    <ChevronRight className={`h-12 w-12 ${canNext ? "text-white" : "text-white/30"}`} />
                  </Button>
                </div>

                <div className="px-12 py-10">
                  <div className="min-h-[320px] flex items-center justify-center p-6 rounded-lg bg-[#852E4E]/30 border border-pink-700/40">
                    <div style={dynamicFontSize(isFront ? current!.question : current!.answer, isFront)} className="w-full text-center">
                      <MarkdownMathRenderer text={isFront ? current!.question : current!.answer} />
                    </div>
                  </div>
                  <div className="mt-3 text-center text-sm text-pink-200">Card {order.length === 0 ? 0 : idx + 1} of {order.length} • {isFront ? "Front" : "Back"}</div>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <Button onClick={() => setIsFront(f => !f)} className="bg-[#852E4E] hover:bg-[#A33757]">Flip</Button>
                    {order.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="border-red-400 text-red-300 hover:bg-red-500/10"
                            disabled={deleting}
                          >
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this flashcard?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                if (!current) return;
                                try {
                                  setDeleting(true);
                                  const originalIndex = order[idx] ?? 0;
                                  const res = await fetch(`/api/study_sets/${sid}/cards/${originalIndex}`, { method: 'DELETE', credentials: 'include' });
                                  if (res.status !== 204) {
                                    const j = await res.json().catch(() => ({} as any));
                                    throw new Error((j as any)?.error || `Failed to delete (${res.status})`);
                                  }
                                  // Update cards and order consistently with original index removal
                                  setCards(prev => {
                                    const nextCards = prev.filter((_, i) => i !== originalIndex);
                                    setOrder(prevOrder => {
                                      const withoutCurrent = prevOrder.filter((_, i) => i !== idx);
                                      const remapped = withoutCurrent.map(v => (v > originalIndex ? v - 1 : v));
                                      // adjust idx to remain in bounds
                                      const newIdx = remapped.length === 0 ? 0 : Math.min(idx, remapped.length - 1);
                                      setIdx(newIdx);
                                      return remapped;
                                    });
                                    setIsFront(true);
                                    return nextCards;
                                  });
                                } catch (e) {
                                  console.error(e);
                                } finally {
                                  setDeleting(false);
                                }
                              }}
                            >
                              {deleting ? 'Deleting…' : 'Delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    {/* Rename Dialog */}
    <Dialog open={renameOpen} onOpenChange={(o) => { setRenameOpen(o); if (!o) { setRenameError(null); } }}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Rename Study Set</DialogTitle>
          <DialogDescription>Update the title for this study set.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {renameError && <div className="text-sm text-red-400">{renameError}</div>}
          <input
            type="text"
            className="w-full px-3 py-2 rounded border bg-white text-black"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            placeholder="Study set name"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={renaming}>Cancel</Button>
            <Button
              className="bg-[#852E4E] hover:bg-[#A33757]"
              disabled={renaming || !renameInput.trim()}
              onClick={async () => {
                setRenameError(null);
                const nm = renameInput.trim();
                if (!nm) return;
                try {
                  setRenaming(true);
                  const res = await fetch(`/api/study_sets/${sid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name: nm })
                  });
                  const j = await res.json().catch(() => ({} as any));
                  if (!res.ok) {
                    setRenameError((j as any)?.error || `Failed to rename (${res.status})`);
                    return;
                  }
                  setName(nm);
                  setRenameOpen(false);
                } catch (e: any) {
                  setRenameError(e?.message || 'Failed to rename');
                } finally {
                  setRenaming(false);
                }
              }}
            >
              {renaming ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
