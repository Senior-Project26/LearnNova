import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import MessageItem from "./MessageItem";
import TypingIndicator from "./TypingIndicator";

export default function MessageList({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    if (atBottom) containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [messages, isStreaming, atBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 24;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
      setAtBottom(nearBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
      {messages.map((m) => (
        <MessageItem key={m.id} msg={m} />
      ))}
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <TypingIndicator />
          <span>Typing…</span>
        </div>
      )}
      {!atBottom && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" })}
          className="fixed bottom-24 right-6 bg-white/90 dark:bg-neutral-900/90 backdrop-blur px-3 py-1.5 rounded-full shadow border text-sm"
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}
