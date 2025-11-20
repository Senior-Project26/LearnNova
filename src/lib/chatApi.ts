import type { ChatMessage } from "@/types/chat";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const DEFAULT_MODE = (import.meta.env.VITE_CHAT_STREAM_MODE as
  | "sse"
  | "fetch"
  | "json"
  | undefined) ?? "fetch";

export type StreamCallbacks = {
  onToken: (delta: string) => void;
  onDone: (final?: string) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
};

export async function sendChat(
  messages: Pick<ChatMessage, "role" | "content">[],
  meta: Record<string, unknown> | undefined,
  cb: StreamCallbacks
) {
  const mode = DEFAULT_MODE;
  if (mode === "sse") {
    try {
      await streamSSE(messages, meta, cb);
      return;
    } catch (e) {
      // fall through to fetch/json
    }
  }
  if (mode === "fetch") {
    try {
      await streamFetch(messages, meta, cb);
      return;
    } catch (e) {
      // fall through to json
    }
  }
  await fetchJSON(messages, meta, cb);
}

export async function getSession() {
  const res = await fetch(`/api/session`, { credentials: "include" });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function listCloudThreads() {
  const res = await fetch(`/api/chat_threads`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { items: { id: number; title: string; created_at?: string; updated_at?: string }[] };
}

export async function createCloudThread(title: string) {
  const res = await fetch(`/api/chat_threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { id: number; title: string; created_at?: string; updated_at?: string };
}

export async function renameCloudThread(id: number, title: string) {
  const res = await fetch(`/api/chat_threads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { id: number; title: string; created_at?: string; updated_at?: string };
}

export async function deleteCloudThread(id: number) {
  const res = await fetch(`/api/chat_threads/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

export async function getCloudThread(id: number) {
  const res = await fetch(`/api/chat_threads/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as {
    id: number;
    title: string;
    created_at?: string;
    updated_at?: string;
    messages: { id: number; role: ChatMessage["role"]; content: string; created_at?: string }[];
  };
}

export async function appendCloudMessage(threadId: number, role: ChatMessage["role"], content: string) {
  const res = await fetch(`/api/chat_threads/${threadId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ role, content }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { id: number; role: ChatMessage["role"]; content: string; created_at?: string };
}

async function streamSSE(
  messages: Pick<ChatMessage, "role" | "content">[],
  meta: Record<string, unknown> | undefined,
  { onToken, onDone, onError, signal }: StreamCallbacks
) {
  // Unsupported with POST payload in this app; fall back.
  throw new Error("SSE unsupported with POST payload; falling back");
}

async function streamFetch(
  messages: Pick<ChatMessage, "role" | "content">[],
  meta: Record<string, unknown> | undefined,
  { onToken, onDone, onError, signal }: StreamCallbacks
) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/plain, application/x-ndjson, application/json",
    },
    body: JSON.stringify({ messages, meta }),
    credentials: "include",
    signal,
  });

  if (res.status === 401 || res.status === 403) {
    onError(new Error("auth"));
    return;
  }
  if (res.status === 429) {
    onError(new Error("rate"));
    return;
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const ctype = res.headers.get("content-type") || "";
  if (!res.body || (!ctype.includes("text") && !ctype.includes("ndjson"))) {
    // not a stream, treat as JSON fallback
    try {
      const json = await res.json();
      const final = json?.message?.content ?? "";
      if (final) onToken(final);
      onDone(final);
      return;
    } catch (e) {
      throw new Error("Invalid JSON response");
    }
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let buffer = "";
  while (!done) {
    const { value, done: d } = await reader.read();
    done = d ?? false;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      // support JSONL with {"delta":"..."} or plain text chunks
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const text = line.trim();
        if (!text) continue;
        if (text.startsWith("{")) {
          try {
            const obj = JSON.parse(text);
            if (typeof obj.delta === "string") onToken(obj.delta);
          } catch {
            onToken(text);
          }
        } else {
          onToken(text);
        }
      }
    }
  }
  if (buffer) onToken(buffer);
  onDone();
}

async function fetchJSON(
  messages: Pick<ChatMessage, "role" | "content">[],
  meta: Record<string, unknown> | undefined,
  { onToken, onDone, onError, signal }: StreamCallbacks
) {
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, meta }),
      credentials: "include",
      signal,
    });
    if (res.status === 401 || res.status === 403) {
      onError(new Error("auth"));
      return;
    }
    if (res.status === 429) {
      onError(new Error("rate"));
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const final = json?.message?.content ?? "";
    if (final) onToken(final);
    onDone(final);
  } catch (e) {
    onError(e as Error);
  }
}
