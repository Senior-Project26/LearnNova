import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { useChat } from "@/hooks/useChat";
import { Plus, Trash2, Edit3, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

export default function ChatWindow({ mode = "full" }: { mode?: "full" | "compact" }) {
  const { currentThread, state, send, stop, createNewThread, deleteThread, renameCurrent, setCurrentThreadId } = useChat();
  const { toast } = useToast();
  const messages = useMemo(() => currentThread?.messages ?? [], [currentThread]);
  const title = useMemo(() => currentThread?.title ?? "New Chat", [currentThread]);
  const [showAuth, setShowAuth] = useState(false);
  const threadsList = useMemo(() => Object.values(state.threads).sort((a,b)=>b.updatedAt - a.updatedAt), [state.threads]);
  const [eli5, setEli5] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [tutorNoAnswer, setTutorNoAnswer] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("learnnova_settings");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const ai = parsed?.ai || {};
      if (typeof ai.explainLike5 === "boolean") setEli5(ai.explainLike5);
      if (typeof ai.detailed === "boolean") setDetailed(ai.detailed);
      if (typeof ai.tutorNoAnswer === "boolean") setTutorNoAnswer(ai.tutorNoAnswer);
    } catch { void 0; }
  }, []);

  const lastUserMessage = useMemo(() => [...messages].reverse().find((m) => m.role === "user"), [messages]);
  const onRetry = () => {
    if (lastUserMessage) send(lastUserMessage.content);
  };
  if (state.error) {
    if (state.error === "auth") {
      setShowAuth(true);
    } else if (state.error === "rate") {
      toast({ title: "Rate limit", description: "You have sent too many requests. Please wait a moment.", variant: "default" });
    } else {
      toast({ title: "Network error", description: state.error, variant: "default" });
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl overflow-hidden border shadow bg-white/80 dark:bg-neutral-950/80">
      <div className="bg-gradient-to-r from-[#4C1D3D] to-[#FFBB94] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-semibold truncate">{title}</div>
          <select
            className="md:hidden ml-2 bg-white/20 text-white text-sm rounded px-2 py-1 focus:outline-none"
            aria-label="Switch chat"
            value={state.currentThreadId ?? ""}
            onChange={(e) => setCurrentThreadId(e.target.value || null)}
          >
            <option value="">New Chat</option>
            {threadsList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 pr-1">
            <label className="flex items-center gap-1 text-xs">
              <span>ELI5</span>
              <Switch checked={eli5} onCheckedChange={setEli5} />
            </label>
            <label className="flex items-center gap-1 text-xs">
              <span>Detailed</span>
              <Switch checked={detailed} onCheckedChange={setDetailed} />
            </label>
            <label className="flex items-center gap-1 text-xs">
              <span>Tutor</span>
              <Switch checked={tutorNoAnswer} onCheckedChange={setTutorNoAnswer} />
            </label>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="px-2" title="Actions">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <div className="px-2 py-1.5 text-xs font-medium text-neutral-500">Style</div>
              <DropdownMenuItem asChild>
                <div className="flex items-center justify-between w-full">
                  <span>ELI5</span>
                  <Switch checked={eli5} onCheckedChange={setEli5} />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <div className="flex items-center justify-between w-full">
                  <span>Detailed</span>
                  <Switch checked={detailed} onCheckedChange={setDetailed} />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <div className="flex items-center justify-between w-full">
                  <span>Tutor (no answers)</span>
                  <Switch checked={tutorNoAnswer} onCheckedChange={setTutorNoAnswer} />
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => createNewThread()}>
                <Plus className="mr-2 h-4 w-4" /> New chat
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!currentThread}
                onClick={() => {
                  if (!currentThread) return;
                  const name = window.prompt("Rename chat", currentThread?.title ?? "");
                  if (name && name.trim()) renameCurrent(name.trim());
                }}
              >
                <Edit3 className="mr-2 h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!currentThread}
                onClick={() => {
                  if (!currentThread) return;
                  const ok = window.confirm("Delete this chat?");
                  if (ok) deleteThread(currentThread.id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
              {state.isStreaming ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={stop}>Stop generating</DropdownMenuItem>
                </>
              ) : null}
              {mode === "compact" ? (
                <>
                  <DropdownMenuSeparator />
                  <SheetClose asChild>
                    <DropdownMenuItem>Close</DropdownMenuItem>
                  </SheetClose>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <AlertDialog open={showAuth} onOpenChange={setShowAuth}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign in required</AlertDialogTitle>
              <AlertDialogDescription>
                You need to sign in to use chat.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction asChild>
                <Link to="/signin">Go to sign in</Link>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {state.error && (
          <div className="m-3 p-3 rounded-lg border bg-red-50 text-red-700 text-sm flex items-center justify-between">
            <span>{state.error === "auth" ? "Sign in required" : state.error === "rate" ? "You are being rate limited" : "A network error occurred"}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>
              {(state.error === "auth") && (
                <Link to="/signin" className="underline text-sm">Sign in</Link>
              )}
            </div>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="h-full grid place-items-center p-6 text-center">
            <div>
              <div className="text-lg font-medium mb-3">How can I help?</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "Turn these notes into flashcards",
                  "Quiz me on Calc I limits",
                  "Summarize this PDF",
                ].map((p) => (
                  <Button key={p} variant="secondary" size="sm" onClick={() => send(p, { explainLike5: eli5, detailed, tutorNoAnswer })}>
                    {p}
                  </Button>
                ))}
              </div>
              {mode === "compact" && (
                <div className="mt-4 text-sm">
                  <Link className="underline" to="/chat">Open full chat</Link>
                </div>
              )}
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={state.isStreaming} />
        )}
      </div>
      <MessageInput onSend={(t) => send(t, { explainLike5: eli5, detailed, tutorNoAnswer })} loading={state.isStreaming} />
      {mode === "compact" && (
        <div className="px-3 py-2 text-xs text-neutral-500">
          <Link className="underline" to="/chat">Open full chat</Link>
        </div>
      )}
    </div>
  );
}
