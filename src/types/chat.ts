export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number; // epoch ms
};

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type StreamMode = "sse" | "fetch" | "json" | null;

export type ChatState = {
  currentThreadId: string | null;
  threads: Record<string, ChatThread>;
  isStreaming: boolean;
  streamMode: StreamMode;
  error?: string | null;
};
