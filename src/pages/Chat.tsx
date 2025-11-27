/*
README note:
Env flags:
- VITE_CHAT_STREAM_MODE: "sse" | "fetch" | "json" (default "fetch").
- VITE_API_BASE: base path to API (default "/api").
Testing:
- You can mock responses by adjusting the Flask /api/chat route.
- Minimal tests suggested under src/tests for utils.
*/

import ThreadSidebar from "@/components/chat/ThreadSidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import { useLocation } from "react-router-dom";

export default function ChatPage() {
  const location = useLocation() as { state?: { initialPrompt?: string } };
  const initialPrompt = location.state?.initialPrompt;

  return (
    <div className="h-[calc(100vh-2rem)] m-4 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
      <div className="hidden md:block rounded-2xl overflow-hidden"><ThreadSidebar /></div>
      <div className="rounded-2xl overflow-hidden"><ChatWindow mode="full" initialPrompt={initialPrompt} /></div>
    </div>
  );
}
