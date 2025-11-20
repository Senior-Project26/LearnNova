import type { ChatMessage, ChatState, ChatThread } from "@/types/chat";

const STORAGE_KEY = "ln_chat_threads_v1";

export type PersistedState = {
  currentThreadId: string | null;
  threads: Record<string, ChatThread>;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadState(): PersistedState {
  const data = safeParse<PersistedState>(localStorage.getItem(STORAGE_KEY), {
    currentThreadId: null,
    threads: {},
  });
  // migration guard: ensure required fields
  if (!data || typeof data !== "object" || !data.threads) {
    return { currentThreadId: null, threads: {} };
  }
  return data;
}

let debounceTimer: number | undefined;
export function saveStateDebounced(state: PersistedState, ms = 250) {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => saveState(state), ms);
}

export function saveState(state: PersistedState) {
  // persist all threads; ensure currentThreadId is valid
  const threadsArr = Object.values(state.threads).sort((a, b) => b.updatedAt - a.updatedAt);
  const threadsMap: Record<string, ChatThread> = {};
  for (const t of threadsArr) threadsMap[t.id] = t;
  const payload: PersistedState = {
    currentThreadId:
      state.currentThreadId && threadsMap[state.currentThreadId]
        ? state.currentThreadId
        : threadsArr[0]?.id ?? null,
    threads: threadsMap,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function newId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export function makeThread(title = "New Chat"): ChatThread {
  const now = Date.now();
  return {
    id: newId("thread"),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function appendMessage(thread: ChatThread, msg: ChatMessage): ChatThread {
  const messages = [...thread.messages, msg];
  return { ...thread, messages, updatedAt: msg.createdAt };
}

export function renameThread(thread: ChatThread, title: string): ChatThread {
  return { ...thread, title, updatedAt: Date.now() };
}

export function setThreads(
  state: ChatState,
  threads: Record<string, ChatThread>
): ChatState {
  return { ...state, threads };
}
