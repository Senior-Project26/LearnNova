import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatWindow from "./ChatWindow";

export default function FloatingChatBubble() {
  const [open, setOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);
  const [position, setPosition] = useState({ bottom: 24, right: 24 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [origin, setOrigin] = useState<{ bottom: number; right: number }>({ bottom: 24, right: 24 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        setOpen((v) => !v);
        e.preventDefault();
      }
      if (e.key === "Escape") setOpen(false);
    };

    const onOpenWithPrompt = (ev: CustomEvent<{ prompt?: string }>) => {
      const prompt = ev.detail?.prompt;
      if (prompt && prompt.trim()) {
        setInitialPrompt(prompt.trim());
      }
      setOpen(true);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("learnnova:openChatWithPrompt", onOpenWithPrompt as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("learnnova:openChatWithPrompt", onOpenWithPrompt as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      if (!dragStart) return;
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPosition({
        bottom: Math.max(8, origin.bottom - deltaY),
        right: Math.max(8, origin.right - deltaX),
      });
    };
    const handleUp = () => {
      setDragging(false);
      setOrigin(position);
      setDragStart(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, dragStart, origin, position]);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="fixed z-50 w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-[#4C1D3D] to-[#FFBB94] text-white flex items-center justify-center cursor-grab active:cursor-grabbing"
              style={{ bottom: position.bottom, right: position.right }}
              onMouseDown={(e) => {
                setDragging(true);
                setDragStart({ x: e.clientX, y: e.clientY });
              }}
              onClick={() => {
                if (!dragging) setOpen(true);
              }}
              aria-label="Open chat (Ctrl/Cmd+J)"
            >
              <MessageCircle className="w-6 h-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Open chat (Ctrl/Cmd+J)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Chat</SheetTitle>
            <SheetDescription>Ask LearnNova</SheetDescription>
          </SheetHeader>
          <div className="h-full p-2">
            <ChatWindow mode="compact" initialPrompt={initialPrompt} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
