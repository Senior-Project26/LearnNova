import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatState, ChatThread } from "@/types/chat";
import { appendMessage, loadState, makeThread, renameThread, saveStateDebounced } from "@/lib/chatStorage";
import { formatHHmm } from "@/lib/time";
import { sendChat, getSession, listCloudThreads, getCloudThread, createCloudThread, appendCloudMessage, renameCloudThread, deleteCloudThread } from "@/lib/chatApi";

export function useChat(initialThread?: ChatThread) {
  const [state, setState] = useState<ChatState>(() => {
    const persisted = loadState();
    let threads = persisted.threads;
    let current = persisted.currentThreadId;
    if (initialThread) {
      threads = { ...threads, [initialThread.id]: initialThread };
      current = initialThread.id;
    }
    return {
      currentThreadId: current,
      threads,
      isStreaming: false,
      streamMode: null,
      error: null,
    };
  });

  const currentThread = useMemo<ChatThread | null>(() => {
    if (!state.currentThreadId) return null;
    return state.threads[state.currentThreadId] ?? null;
  }, [state]);

  useEffect(() => {
    saveStateDebounced({ currentThreadId: state.currentThreadId, threads: state.threads });
  }, [state.currentThreadId, state.threads]);

  // Load cloud threads if authenticated
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sess = await getSession();
        if (!sess) return; // not signed in
        const list = await listCloudThreads();
        const items = list.items || [];
        const cloudThreads: Record<string, ChatThread> = {};
        for (const it of items) {
          try {
            const t = await getCloudThread(it.id);
            const id = `cloud_${t.id}`;
            const msgs: ChatMessage[] = (t.messages || []).map((m) => ({
              id: `m_${m.id}`,
              role: m.role,
              content: m.content,
              createdAt: m.created_at ? Date.parse(m.created_at) : Date.now(),
            }));
            const createdAt = t.created_at ? Date.parse(t.created_at) : Date.now();
            const updatedAt = t.updated_at ? Date.parse(t.updated_at) : createdAt;
            cloudThreads[id] = { id, title: t.title, messages: msgs, createdAt, updatedAt };
          } catch (e) {
            continue;
          }
        }
        if (cancelled) return;
        setState((s) => {
          // Merge: prefer cloud threads; keep local too
          const merged = { ...cloudThreads, ...s.threads };
          // Set current to previous if still exists, else most recent cloud/local
          const nextCurrent = s.currentThreadId && merged[s.currentThreadId]
            ? s.currentThreadId
            : Object.values(merged).sort((a,b)=>b.updatedAt - a.updatedAt)[0]?.id ?? null;
          return { ...s, threads: merged, currentThreadId: nextCurrent };
        });
      } catch (e) {
        // ignore cloud load errors; stay local
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setCurrentThreadId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, currentThreadId: id }));
  }, []);

  const createNewThread = useCallback((title?: string) => {
    const t = makeThread(title ?? "New Chat");
    // Attempt to create cloud thread if signed in
    (async () => {
      try {
        const sess = await getSession();
        if (!sess) return; // local only
        const created = await createCloudThread(t.title);
        const cloudId = `cloud_${created.id}`;
        setState((s) => ({
          ...s,
          currentThreadId: cloudId,
          threads: {
            ...s.threads,
            [cloudId]: { ...t, id: cloudId, createdAt: created.created_at ? Date.parse(created.created_at) : t.createdAt, updatedAt: created.updated_at ? Date.parse(created.updated_at) : t.updatedAt },
          },
        }));
        return;
      } catch (e) { void e; }
    })();
    // Fallback: local thread immediately
    setState((s) => ({
      ...s,
      currentThreadId: t.id,
      threads: { ...s.threads, [t.id]: t },
    }));
    return t.id;
  }, []);

  const deleteThread = useCallback((id: string) => {
    setState((s) => {
      const { [id]: _, ...rest } = s.threads;
      const nextId = s.currentThreadId === id ? Object.values(rest).sort((a,b)=>b.updatedAt - a.updatedAt)[0]?.id ?? null : s.currentThreadId;
      return { ...s, threads: rest, currentThreadId: nextId };
    });
    // Try delete on server if cloud thread
    (async () => {
      if (id.startsWith("cloud_")) {
        const cloudId = parseInt(id.replace("cloud_", ""), 10);
        if (!Number.isNaN(cloudId)) {
          try { await deleteCloudThread(cloudId); } catch (e) { void e; }
        }
      }
    })();
  }, []);

  const renameCurrent = useCallback((title: string) => {
    setState((s) => {
      const t = s.currentThreadId ? s.threads[s.currentThreadId] : null;
      if (!t) return s;
      const updated = renameThread(t, title);
      return { ...s, threads: { ...s.threads, [t.id]: updated } };
    });
    // Try rename on server
    (async () => {
      const id = state.currentThreadId;
      if (id && id.startsWith("cloud_")) {
        const cloudId = parseInt(id.replace("cloud_", ""), 10);
        if (!Number.isNaN(cloudId)) {
          try { await renameCloudThread(cloudId, title); } catch (e) { void e; }
        }
      }
    })();
  }, [state.currentThreadId]);

  const abortCtrlRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortCtrlRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string, meta?: Record<string, unknown>) => {
      const content = text.trim();
      if (!content) return;

      // ensure thread
      let threadId = state.currentThreadId;
      if (!threadId) {
        threadId = createNewThread(content.split(/\r?\n/)[0].slice(0, 50));
      }

      const now = Date.now();
      const userMsg: ChatMessage = {
        id: `m_${now}`,
        role: "user",
        content,
        createdAt: now,
      };

      const draft: ChatMessage = {
        id: `m_${now + 1}`,
        role: "assistant",
        content: "",
        createdAt: now + 1,
      };

      setState((s) => {
        let t = s.threads[threadId!];
        // Auto-rename if still default
        const defaultTitle = "New Chat";
        if ((t.title ?? defaultTitle) === defaultTitle) {
          const newTitle = content.split(/\r?\n/)[0].slice(0, 50).trim() || defaultTitle;
          t = renameThread(t, newTitle);
        }
        const t1 = appendMessage(t, userMsg);
        const t2 = appendMessage(t1, draft);
        return { ...s, currentThreadId: threadId!, threads: { ...s.threads, [threadId!]: t2 }, isStreaming: true, error: null };
      });

      // Cloud: append user message immediately if cloud thread
      (async () => {
        if (threadId!.startsWith("cloud_")) {
          const cloudId = parseInt(threadId!.replace("cloud_", ""), 10);
          if (!Number.isNaN(cloudId)) {
            try { await appendCloudMessage(cloudId, "user", content); } catch (e) { void e; }
          }
        }
      })();

      const controller = new AbortController();
      abortCtrlRef.current = controller;

      const onToken = (delta: string) => {
        setState((s) => {
          const t = s.threads[threadId!];
          const msgs = t.messages.map((m) => (m.id === draft.id ? { ...m, content: m.content + delta } : m));
          const updated = { ...t, messages: msgs, updatedAt: Date.now() };
          return { ...s, threads: { ...s.threads, [t.id]: updated } };
        });
      };

      const onDone = () => {
        abortCtrlRef.current = null;
        setState((s) => ({ ...s, isStreaming: false }));
      };

      const onError = (err: Error) => {
        abortCtrlRef.current = null;
        setState((s) => ({ ...s, isStreaming: false, error: err.message }));
      };

      try {
        await sendChat(
          // Exclude ids/createdAt for server
          [{ role: "user", content }],
          meta,
          { onToken, onDone, onError, signal: controller.signal }
        );
        // After streaming completes, push assistant content to cloud
        if (threadId!.startsWith("cloud_")) {
          const cloudId = parseInt(threadId!.replace("cloud_", ""), 10);
          if (!Number.isNaN(cloudId)) {
            try {
              const assistantContent = (() => {
                const t = (state.threads[threadId!] || currentThread) as ChatThread | null;
                if (!t) return "";
                const m = t.messages.find((m) => m.id === draft.id);
                return m?.content || "";
              })();
              if (assistantContent) await appendCloudMessage(cloudId, "assistant", assistantContent);
            } catch (e) { void e; }
          }
        }
      } catch (e) {
        onError(e as Error);
      }
    },
    [state.currentThreadId, createNewThread, currentThread, state.threads]
  );

  const currentTime = useCallback((ms: number) => formatHHmm(ms), []);

  return {
    state,
    currentThread,
    setCurrentThreadId,
    createNewThread,
    deleteThread,
    renameCurrent,
    send,
    stop,
    currentTime,
  } as const;
}
