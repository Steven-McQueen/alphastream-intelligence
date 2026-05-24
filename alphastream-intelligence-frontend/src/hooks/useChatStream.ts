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
  onStreamComplete?: (userContent: string, assistantContent: string) => void;
}

interface UseChatStreamReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  isGenerating: boolean;
  error: string | null;
  clearMessages: () => void;
  setInitialMessages: (msgs: ChatMessage[]) => void;
}

export function useChatStream({
  contextLabel,
  chatMode,
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

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      setError(null);

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
      setIsGenerating(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const outgoing = [...messages, userMsg].map(({ role, content }) => ({
        role,
        content,
      }));

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
                  onCompleteRef.current?.(trimmed, finalAssistantContent);
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
          if (finalAssistantContent) {
            onCompleteRef.current?.(trimmed, finalAssistantContent);
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
    [messages, isGenerating, contextLabel, chatMode],
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsGenerating(false);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    isGenerating,
    error,
    clearMessages,
    setInitialMessages,
  };
}
