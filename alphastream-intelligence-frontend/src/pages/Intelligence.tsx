import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ChatOverlay } from "@/components/chat/ChatOverlay";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import { useChatStream, type ChatMessage } from "@/hooks/useChatStream";
import { getStoredModelId, setStoredModelId } from "@/config/chatModels";
import {
  useChatHistory,
  generateThreadTitle,
} from "@/contexts/ChatHistoryContext";
import { cn } from "@/lib/utils";
import { Brain, Database, Network } from "lucide-react";
import { SchemaView } from "@/components/atlas/SchemaView";
import { AgentsView } from "@/components/atlas/AgentsView";

type TabKey = "agent" | "database" | "agents";

const TABS: { key: TabKey; label: string; icon: typeof Brain }[] = [
  { key: "agent", label: "Assistant", icon: Brain },
  { key: "database", label: "Database Overview", icon: Database },
  { key: "agents", label: "Agents", icon: Network },
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

  const [modelId, setModelId] = useState<string>(() => getStoredModelId());

  const handleModelIdChange = useCallback((id: string) => {
    setModelId(id);
    setStoredModelId(id);
  }, []);

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
    modelId,
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
      <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3 border-b border-border/50 flex-shrink-0">
        <h1
          className="text-lg font-semibold text-foreground shrink-0"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Intelligence Center
        </h1>
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "agent" && (
          <div className="flex h-full">
            <ChatHistorySidebar />
            <div className="flex-1 min-w-0 h-full">
              <ChatOverlay
                mode="embedded"
                contextLabel="Assistant"
                suggestedPrompts={AGENT_PROMPTS}
                messages={chat.messages}
                onSendMessage={chat.sendMessage}
                onRegenerate={chat.regenerate}
                isGenerating={chat.isGenerating}
                modelId={modelId}
                onModelIdChange={handleModelIdChange}
                error={chat.error}
                className="h-full"
                hideClose
                showHeader={false}
                seamless
              />
            </div>
          </div>
        )}

        {activeTab === "database" && <SchemaView />}

        {activeTab === "agents" && <AgentsView />}
      </div>
    </div>
  );
}
