import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { useNavigate, useParams } from "react-router-dom";
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
interface StudySetResponse { name?: string; cards?: Flashcard[]; error?: string }
interface ErrorResponse { error?: string }

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
  const navigate = useNavigate();
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
  const [hidden, setHidden] = useState<Set<number>>(new Set()); // original card indices marked confident
  const [includeConfident, setIncludeConfident] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/study_sets/${sid}`, { credentials: "include" });
        const j: StudySetResponse = await res.json().catch(() => ({} as StudySetResponse));
        if (!mounted) return;
        if (!res.ok) throw new Error(j?.error || `Failed to load study set (${res.status})`);
        const cs: Flashcard[] = Array.isArray(j?.cards) ? j.cards! : [];
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
        setHidden(new Set());
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load study set.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [sid]);

  const findPrevIndex = useCallback((from: number): number | null => {
    for (let j = from - 1; j >= 0; j--) {
      const orig = order[j];
      if (includeConfident || !hidden.has(orig)) return j;
    }
    return null;
  }, [order, hidden, includeConfident]);
  const findNextIndex = useCallback((from: number): number | null => {
    for (let j = from + 1; j < order.length; j++) {
      const orig = order[j];
      if (includeConfident || !hidden.has(orig)) return j;
    }
    return null;
  }, [order, hidden, includeConfident]);
  const canPrev = useMemo(() => findPrevIndex(idx) !== null, [idx, findPrevIndex]);
  const canNext = useMemo(() => findNextIndex(idx) !== null, [idx, findNextIndex]);
  const hasVisible = useMemo(() => {
    if (order.length === 0) return false;
    if (includeConfident) return order.length > 0;
    return order.some(oi => !hidden.has(oi));
  }, [order, hidden, includeConfident]);
  const current = useMemo(() => {
    if (order.length === 0) return null;
    const oi = order[idx] ?? 0;
    if (!includeConfident && hidden.has(oi)) return null;
    return cards[oi] ?? null;
  }, [cards, order, idx, hidden, includeConfident]);

  useEffect(() => {
    if (!includeConfident && order.length > 0) {
      const orig = order[idx] ?? 0;
      if (hidden.has(orig)) {
        const n = findNextIndex(idx);
        if (n !== null) {
          setIdx(n);
          setIsFront(true);
          return;
        }
        const p = findPrevIndex(idx + 1);
        if (p !== null) {
          setIdx(p);
          setIsFront(true);
        }
      }
    }
  }, [includeConfident, order, idx, hidden, findNextIndex, findPrevIndex]);

  useEffect(() => {
    if (order.length === 0) return;
    if (includeConfident) return; // all visible
    const oi = order[idx] ?? 0;
    if (hidden.has(oi)) {
      const n = findNextIndex(idx);
      if (n !== null) {
        setIdx(n);
        setIsFront(true);
        return;
      }
      const p = findPrevIndex(idx + 1);
      if (p !== null) {
        setIdx(p);
        setIsFront(true);
      }
    }
  }, [order, idx, hidden, includeConfident, findNextIndex, findPrevIndex]);

  useEffect(() => {
    if (current === null && hasVisible) {
      const n = findNextIndex(idx);
      if (n !== null) {
        setIdx(n);
        setIsFront(true);
      } else {
        const p = findPrevIndex(idx + 1);
        if (p !== null) {
          setIdx(p);
          setIsFront(true);
        }
      }
    }
  }, [current, hasVisible, idx, findNextIndex, findPrevIndex]);

  const goPrev = () => {
    const j = findPrevIndex(idx);
    if (j !== null) {
      setIdx(j);
      setIsFront(true);
    }
  };
  const goNext = () => {
    const j = findNextIndex(idx);
    if (j !== null) {
      setIdx(j);
      setIsFront(true);
    }
  };
  const markConfident = () => {
    const orig = order[idx];
    setHidden(prev => {
      const next = new Set(prev);
      next.add(orig);
      return next;
    });
    // Ensure hidden cards are excluded from rotation after hiding
    setIncludeConfident(false);
    // Move to the next available card; if none, try previous
    const n = findNextIndex(idx);
    if (n !== null) {
      setIdx(n);
      setIsFront(true);
    } else {
      const p = findPrevIndex(idx + 1); // allow stepping back from current position
      if (p !== null) {
        setIdx(p);
        setIsFront(true);
      }
    }
  };

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
              className="h-8 px-3 text-xs bg-[#852E4E] hover:bg-[#A33757]"
              onClick={() => { setRenameOpen(true); setRenameInput(name || ""); setRenameError(null); }}
            >
              Rename
            </Button>
            <Button
              className="h-8 px-3 text-xs bg-[#852E4E] hover:bg-[#A33757]"
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
          </div>
          <p className="text-pink-100 mt-1">{cards.length} flashcard{cards.length === 1 ? "" : "s"}</p>
        </div>

        <Card className="bg-[#4C1D3D]/70 backdrop-blur-xl border-pink-700/40 text-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Flashcard Viewer</CardTitle>
            <div className="flex items-center gap-2"></div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-24 text-center text-pink-100">Loading…</div>
            ) : error ? (
              <div className="py-24 text-center text-red-300">{error}</div>
            ) : !hasVisible ? (
              <div className="py-24 text-center text-pink-100">No cards to study. {hidden.size > 0 ? 'You have hidden all cards for this session.' : 'This set is empty.'}</div>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center">
                  <Button disabled={!canPrev} onClick={goPrev} className="bg-[#852E4E] hover:bg-[#A33757]">
                    <ChevronLeft className={`h-12 w-12 ${canPrev ? "text-white" : "text-white/30"}`} />
                  </Button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <Button disabled={!canNext} onClick={goNext} className="bg-[#852E4E] hover:bg-[#A33757]">
                    <ChevronRight className={`h-12 w-12 ${canNext ? "text-white" : "text-white/30"}`} />
                  </Button>
                </div>

                <div className="px-12 py-10">
                  <div
                    className="min-h-[320px] flex items-center justify-center p-6 rounded-lg bg-[#852E4E]/30 border border-pink-700/40 cursor-pointer select-none"
                    onClick={() => setIsFront(f => !f)}
                    title="Flip card"
                  >
                    {current ? (
                      <div style={dynamicFontSize(isFront ? current.question : current.answer, isFront)} className="w-full text-center">
                        <MarkdownMathRenderer text={isFront ? current.question : current.answer} />
                      </div>
                    ) : (
                      <div className="text-pink-100">…</div>
                    )}
                  </div>
                  <div className="mt-3 text-center text-sm text-pink-200">Card {order.length === 0 ? 0 : idx + 1} of {order.length} • {isFront ? "Front" : "Back"}</div>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <Button onClick={markConfident} className="bg-[#852E4E] hover:bg-[#A33757]">Hide Card</Button>
                    <Button
                      className="bg-[#852E4E] hover:bg-[#A33757]"
                      disabled={hidden.size === 0 || includeConfident}
                      onClick={() => setIncludeConfident(true)}
                    >
                      Show Card{hidden.size > 0 ? ` (${hidden.size})` : ''}
                    </Button>
                    <Button
                      className="bg-[#852E4E] hover:bg-[#A33757]"
                      onClick={() => { setHidden(new Set()); setIsFront(true); }}
                    >
                      Reset Session
                    </Button>
                    
                    {order.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            className="bg-[#852E4E] hover:bg-[#A33757]"
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
                            <AlertDialogCancel className="bg-[#852E4E] hover:bg-[#A33757] text-white">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-[#852E4E] hover:bg-[#A33757] text-white"
                              onClick={async () => {
                                if (!current) return;
                                try {
                                  setDeleting(true);
                                  const originalIndex = order[idx] ?? 0;
                                  const res = await fetch(`/api/study_sets/${sid}/cards/${originalIndex}`, { method: 'DELETE', credentials: 'include' });
                                  if (res.status !== 204) {
                                    const j: ErrorResponse = await res.json().catch(() => ({} as ErrorResponse));
                                    throw new Error(j?.error || `Failed to delete (${res.status})`);
                                  }
                                  // Update cards and order consistently with original index removal
                                  setCards(prev => {
                                    const nextCards = prev.filter((_, i) => i !== originalIndex);
                                    setOrder(prevOrder => {
                                      const withoutCurrent = prevOrder.filter((_, i) => i !== idx);
                                      const remapped = withoutCurrent.map(v => (v > originalIndex ? v - 1 : v));
                                      // remap hidden indices as well
                                      setHidden(prevHidden => {
                                        const nh = new Set<number>();
                                        prevHidden.forEach(h => {
                                          if (h === originalIndex) return; // removed card
                                          nh.add(h > originalIndex ? h - 1 : h);
                                        });
                                        return nh;
                                      });
                                      // adjust idx to remain in bounds
                                      const newIdx = remapped.length === 0 ? 0 : Math.min(idx, remapped.length - 1);
                                      setIdx(newIdx);
                                      return remapped;
                                    });
                                    setIsFront(true);
                                    return nextCards;
                                  });
                                } catch (e: unknown) {
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
            <Button className="bg-[#852E4E] hover:bg-[#A33757]" onClick={() => setRenameOpen(false)} disabled={renaming}>Cancel</Button>
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
                  const j: ErrorResponse = await res.json().catch(() => ({} as ErrorResponse));
                  if (!res.ok) {
                    setRenameError(j?.error || `Failed to rename (${res.status})`);
                    return;
                  }
                  setName(nm);
                  setRenameOpen(false);
                } catch (e: unknown) {
                  setRenameError(e instanceof Error ? e.message : 'Failed to rename');
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
