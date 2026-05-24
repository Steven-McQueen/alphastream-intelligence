import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ChatOverlay } from "@/components/chat/ChatOverlay";
import { useChatStream, type ChatMessage } from "@/hooks/useChatStream";
import {
  useChatHistory,
  generateThreadTitle,
} from "@/contexts/ChatHistoryContext";
import { cn } from "@/lib/utils";
import { Brain, Database, BookOpen } from "lucide-react";

type TabKey = "agent" | "database" | "explanation";

const TABS: { key: TabKey; label: string; icon: typeof Brain }[] = [
  { key: "agent", label: "Assistant", icon: Brain },
  { key: "database", label: "Database Overview", icon: Database },
  { key: "explanation", label: "Explanation", icon: BookOpen },
];

const AGENT_PROMPTS = [
  "What's moving the market today?",
  "Summarize recent earnings surprises",
  "Show me undervalued tech stocks",
  "Analyze current sector rotation",
];

export default function Intelligence() {
  const [activeTab, setActiveTab] = useState<TabKey>("agent");
  const [searchParams, setSearchParams] = useSearchParams();
  const threadIdParam = searchParams.get("thread");

  const { createThread, saveMessage, loadThread, refreshThreads } =
    useChatHistory();

  const activeThreadRef = useRef<string | null>(threadIdParam);
  const skipNextRestoreRef = useRef(false);

  const handleStreamComplete = useCallback(
    async (userContent: string, assistantContent: string) => {
      let tid = activeThreadRef.current;

      if (!tid) {
        const title = generateThreadTitle(userContent);
        tid = await createThread({
          title,
          contextLabel: "Assistant",
          routePath: "/intelligence",
        });
        if (!tid) return;
        activeThreadRef.current = tid;
      }

      await saveMessage(tid, "user", userContent);
      await saveMessage(tid, "assistant", assistantContent);
      refreshThreads();

      // Update URL only after messages are persisted, and skip the
      // restore effect since the conversation is already in the UI.
      if (!threadIdParam || threadIdParam !== tid) {
        skipNextRestoreRef.current = true;
        setSearchParams({ thread: tid }, { replace: true });
      }
    },
    [createThread, saveMessage, refreshThreads, setSearchParams, threadIdParam],
  );

  const chat = useChatStream({
    contextLabel: "Assistant",
    onStreamComplete: handleStreamComplete,
  });

  useEffect(() => {
    activeThreadRef.current = threadIdParam;

    if (!threadIdParam) {
      chat.clearMessages();
      return;
    }

    // When we just created a thread ourselves the messages are already
    // rendered — no need to reload from the server.
    if (skipNextRestoreRef.current) {
      skipNextRestoreRef.current = false;
      return;
    }

    let cancelled = false;

    loadThread(threadIdParam).then((thread) => {
      if (cancelled) return;
      if (!thread) {
        chat.clearMessages();
        return;
      }

      const restored: ChatMessage[] = thread.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }));
      chat.setInitialMessages(restored);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadIdParam]);

  return (
    <div className="relative flex flex-col h-full bg-background">
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Intelligence Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered market analysis and insights
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-40 px-6 py-3 bg-background/95 backdrop-blur-sm border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  active
                    ? "bg-positive/20 text-positive border border-positive/30"
                    : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 py-4">
        {activeTab === "agent" && (
          <ChatOverlay
            mode="embedded"
            contextLabel="Assistant"
            suggestedPrompts={AGENT_PROMPTS}
            messages={chat.messages}
            onSendMessage={chat.sendMessage}
            isGenerating={chat.isGenerating}
            className="h-full"
            hideClose
          />
        )}

        {activeTab === "database" && (
          <div className="flex flex-col items-center justify-center h-full">
            <Database className="h-16 w-16 text-dim mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              Database Overview
            </h2>
            <p className="text-sm text-dim">Coming soon...</p>
          </div>
        )}

        {activeTab === "explanation" && (
          <div className="flex flex-col items-center justify-center h-full">
            <BookOpen className="h-16 w-16 text-dim mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              Model Explanation
            </h2>
            <p className="text-sm text-dim">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
