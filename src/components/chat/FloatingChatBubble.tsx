import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatWindow from "./ChatWindow";

export default function FloatingChatBubble() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        setOpen((v) => !v);
        e.preventDefault();
      }
      if (e.key === "Escape") setOpen(false);
    };

    const onOpenWithPrompt = () => {
      setOpen(true);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("learnnova:openChatWithPrompt", onOpenWithPrompt as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("learnnova:openChatWithPrompt", onOpenWithPrompt as EventListener);
    };
  }, []);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-[#4C1D3D] to-[#FFBB94] text-white flex items-center justify-center"
              onClick={() => setOpen(true)}
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
            <ChatWindow mode="compact" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
