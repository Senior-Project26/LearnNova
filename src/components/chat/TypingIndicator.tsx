export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
      <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.2s]"></span>
      <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.1s]"></span>
      <span className="inline-block w-2 h-2 rounded-full bg-current animate-bounce"></span>
      <span className="sr-only">Typing…</span>
    </div>
  );
}
