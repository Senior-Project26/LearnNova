import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Copy } from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { formatHHmm } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

function CodeBlock({ inline, children }: { inline?: boolean; children?: React.ReactNode }) {
  if (inline) return <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">{children}</code>;
  const text = String(children ?? "");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.debug("copy failed", err);
    }
  };
  return (
    <div className="relative group">
      <pre className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 overflow-auto text-sm">
        <code>{text}</code>
      </pre>
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
        onClick={copy}
        aria-label="Copy code"
      >
        <Copy className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function MessageItem({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const { user } = useAuth();
  const userPhoto = user?.photoURL || undefined;
  const userInitials = (user?.displayName || "YOU")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <Avatar className="w-8 h-8">
          <AvatarFallback>LN</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${
          isUser
            ? "bg-[#4C1D3D] text-white"
            : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
        }`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={{
            code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) => (
              <CodeBlock inline={inline}>{children}</CodeBlock>
            ),
          }}
        >
          {msg.content}
        </ReactMarkdown>
        <div className={`mt-1 text-xs opacity-70 ${isUser ? "text-neutral-200" : "text-neutral-500"}`}>
          {formatHHmm(msg.createdAt)}
        </div>
      </div>
      {isUser && (
        <Avatar className="w-8 h-8">
          {userPhoto && <AvatarImage src={userPhoto} alt={user?.displayName || "You"} />}
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
