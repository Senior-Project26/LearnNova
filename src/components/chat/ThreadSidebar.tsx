import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { useChat } from "@/hooks/useChat";

export default function ThreadSidebar() {
  const { state, setCurrentThreadId, createNewThread, deleteThread, renameCurrent } = useChat();
  const [q, setQ] = useState("");
  const threads = useMemo(
    () =>
      Object.values(state.threads)
        .filter((t) => t.title.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [state.threads, q]
  );

  return (
    <div className="h-full flex flex-col border-r bg-white/70 dark:bg-neutral-950/70">
      <div className="p-3 border-b bg-gradient-to-r from-[#4C1D3D] to-[#FFBB94] text-white">
        <div className="font-semibold">Your Chats</div>
      </div>
      <div className="p-3 flex items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        <Button onClick={() => createNewThread()} size="sm">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {threads.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
              state.currentThreadId === t.id ? "bg-neutral-100 dark:bg-neutral-800" : ""
            }`}
          >
            <button className="flex-1 text-left" onClick={() => setCurrentThreadId(t.id)}>
              <div className="truncate font-medium">{t.title}</div>
              <div className="text-xs text-neutral-500">{new Date(t.updatedAt).toLocaleString()}</div>
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Rename"
              onClick={() => {
                setCurrentThreadId(t.id);
                const next = window.prompt("Rename chat", t.title)?.trim();
                if (next) renameCurrent(next);
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteThread(t.id)} aria-label="Delete">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {threads.length === 0 && <div className="text-sm text-neutral-500 p-3">No threads yet</div>}
      </div>
    </div>
  );
}
