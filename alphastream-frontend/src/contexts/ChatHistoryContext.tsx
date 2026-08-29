import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authJson } from "@/lib/authFetch";

export interface ChatThread {
  id: string;
  title: string;
  context_label: string | null;
  chat_mode: string | null;
  route_path: string | null;
  updated_at: string;
  message_count: number;
}

export interface ChatThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatThreadFull extends ChatThread {
  created_at: string;
  messages: ChatThreadMessage[];
}

interface ChatHistoryContextType {
  threads: ChatThread[];
  isLoading: boolean;
  refreshThreads: () => Promise<void>;
  loadThread: (threadId: string) => Promise<ChatThreadFull | null>;
  createThread: (opts: {
    title: string;
    contextLabel?: string;
    chatMode?: string;
    routePath?: string;
  }) => Promise<string | null>;
  saveMessage: (
    threadId: string,
    role: string,
    content: string,
  ) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(
  undefined,
);

const MAX_TITLE_LEN = 55;

export function generateThreadTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= MAX_TITLE_LEN) return trimmed;
  return trimmed.slice(0, MAX_TITLE_LEN).replace(/\s+\S*$/, "") + "…";
}

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshThreads = useCallback(async () => {
    if (!user) {
      setThreads([]);
      return;
    }
    try {
      setIsLoading(true);
      const data = await authJson<ChatThread[]>("/api/chat/threads");
      setThreads(data);
    } catch (err) {
      console.error("[ChatHistory] Failed to load threads", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  const loadThread = useCallback(
    async (threadId: string): Promise<ChatThreadFull | null> => {
      try {
        return await authJson<ChatThreadFull>(
          `/api/chat/threads/${threadId}`,
        );
      } catch {
        return null;
      }
    },
    [],
  );

  const createThread = useCallback(
    async (opts: {
      title: string;
      contextLabel?: string;
      chatMode?: string;
      routePath?: string;
    }): Promise<string | null> => {
      try {
        const thread = await authJson<{ id: string }>("/api/chat/threads", {
          method: "POST",
          body: JSON.stringify({
            title: opts.title,
            context_label: opts.contextLabel ?? null,
            chat_mode: opts.chatMode ?? null,
            route_path: opts.routePath ?? null,
          }),
        });
        return thread.id;
      } catch (err) {
        console.error("[ChatHistory] Failed to create thread", err);
        return null;
      }
    },
    [],
  );

  const saveMessage = useCallback(
    async (threadId: string, role: string, content: string) => {
      try {
        await authJson(`/api/chat/threads/${threadId}/messages`, {
          method: "POST",
          body: JSON.stringify({ role, content }),
        });
      } catch (err) {
        console.error("[ChatHistory] Failed to save message", err);
      }
    },
    [],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      try {
        await authJson(`/api/chat/threads/${threadId}`, {
          method: "DELETE",
        });
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
      } catch (err) {
        console.error("[ChatHistory] Failed to delete thread", err);
      }
    },
    [],
  );

  return (
    <ChatHistoryContext.Provider
      value={{
        threads,
        isLoading,
        refreshThreads,
        loadThread,
        createThread,
        saveMessage,
        deleteThread,
      }}
    >
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory() {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) {
    throw new Error("useChatHistory must be inside ChatHistoryProvider");
  }
  return ctx;
}
