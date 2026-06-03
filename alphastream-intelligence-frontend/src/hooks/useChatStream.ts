import { useState, useCallback, useRef } from "react";
import { API_BASE_URL } from "@/config/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseChatStreamOptions {
  contextLabel?: string;
  chatMode?: string;
  modelId?: string;
  onStreamComplete?: (userContent: string, assistantContent: string) => void;
}

interface UseChatStreamReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  /** Re-run the most recent user turn, overwriting the last assistant answer. */
  regenerate: () => void;
  isGenerating: boolean;
  error: string | null;
  clearMessages: () => void;
  setInitialMessages: (msgs: ChatMessage[]) => void;
}

interface OutgoingMessage {
  role: "user" | "assistant";
  content: string;
}

export function useChatStream({
  contextLabel,
  chatMode,
  modelId,
  onStreamComplete,
}: UseChatStreamOptions = {}): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onStreamComplete);
  onCompleteRef.current = onStreamComplete;

  const setInitialMessages = useCallback((msgs: ChatMessage[]) => {
    abortRef.current?.abort();
    setMessages(msgs);
    setIsGenerating(false);
    setError(null);
  }, []);

  /**
   * Streams a completion into the placeholder assistant message identified by
   * `assistantId`. Shared by both fresh sends and regenerations. When
   * `userContent` is provided, the persistence callback fires on completion.
   */
  const runStream = useCallback(
    (
      outgoing: OutgoingMessage[],
      assistantId: string,
      userContent: string | null,
    ) => {
      setIsGenerating(true);
      setError(null);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        let finalAssistantContent = "";
        try {
          const res = await fetch(`${API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: outgoing,
              contextLabel: contextLabel || null,
              chatMode: chatMode || null,
              model_id: modelId || null,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            throw new Error(`Server responded with ${res.status}`);
          }

          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data: ")) continue;

              const jsonStr = trimmedLine.slice(6);
              try {
                const event = JSON.parse(jsonStr);

                if (event.token) {
                  finalAssistantContent += event.token;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + event.token }
                        : m,
                    ),
                  );
                }

                if (event.done) {
                  setIsGenerating(false);
                  if (userContent !== null) {
                    onCompleteRef.current?.(userContent, finalAssistantContent);
                  }
                  return;
                }

                if (event.error) {
                  setError(event.error);
                  setMessages((prev) =>
                    prev.filter((m) => m.id !== assistantId),
                  );
                  setIsGenerating(false);
                  return;
                }
              } catch {
                /* skip malformed JSON lines */
              }
            }
          }

          setIsGenerating(false);
          if (finalAssistantContent && userContent !== null) {
            onCompleteRef.current?.(userContent, finalAssistantContent);
          }
        } catch (err: unknown) {
          if ((err as Error).name === "AbortError") return;
          const message =
            err instanceof Error ? err.message : "Connection failed";
          setError(message);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setIsGenerating(false);
        }
      })();
    },
    [contextLabel, chatMode, modelId],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const outgoing = [...messages, userMsg].map(({ role, content }) => ({
        role,
        content,
      }));

      runStream(outgoing, assistantId, trimmed);
    },
    [messages, isGenerating, runStream],
  );

  const regenerate = useCallback(() => {
    if (isGenerating) return;

    // Find the most recent user turn to replay.
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;

    // Keep history through the user turn; drop any answer that followed it.
    const base = messages.slice(0, lastUserIdx + 1);
    const outgoing = base.map(({ role, content }) => ({ role, content }));

    const assistantId = `assistant-${Date.now()}`;
    setMessages([...base, { id: assistantId, role: "assistant", content: "" }]);

    // Frontend-only phase: skip the persistence callback so regenerated
    // answers don't double-write the thread. Backend phase will update in place.
    runStream(outgoing, assistantId, null);
  }, [messages, isGenerating, runStream]);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsGenerating(false);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    regenerate,
    isGenerating,
    error,
    clearMessages,
    setInitialMessages,
  };
}
