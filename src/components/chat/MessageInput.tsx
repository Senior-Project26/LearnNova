import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send } from "lucide-react";

export default function MessageInput({
  onSend,
  loading,
}: {
  onSend: (text: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        ref.current?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const send = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onAttach = () => {
    // Stub handler
    // accept: .pdf,.png,.jpg,.jpeg,.txt,.md
    // TODO: integrate uploads
  };

  return (
    <div className="border-t p-3 bg-white/70 dark:bg-neutral-950/70 backdrop-blur">
      <div className="flex items-end gap-2">
        <button
          className="shrink-0 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          onClick={onAttach}
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={onKeyDown}
          className="min-h-[56px] max-h-40 resize-y"
        />
        <Button onClick={send} disabled={!value.trim() || loading}>
          {loading ? (
            <span className="animate-pulse">Sending…</span>
          ) : (
            <>
              <Send className="w-4 h-4 mr-1" />
              Send
            </>
          )}
        </Button>
      </div>
      <div className="text-xs text-neutral-500 mt-1">Enter to send · Shift+Enter for newline</div>
    </div>
  );
}
