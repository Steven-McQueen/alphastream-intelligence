import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useChatHistory } from "@/contexts/ChatHistoryContext";
import { cn } from "@/lib/utils";
import { Plus, Trash2, MessageSquare } from "lucide-react";

export function ChatHistoryList() {
  const { threads, isLoading, deleteThread } = useChatHistory();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const activeThreadId =
    location.pathname === "/intelligence"
      ? searchParams.get("thread")
      : null;

  const handleNewChat = () => {
    navigate("/intelligence");
  };

  const handleSelectThread = (threadId: string) => {
    navigate(`/intelligence?thread=${threadId}`);
  };

  const handleDelete = async (
    e: React.MouseEvent,
    threadId: string,
  ) => {
    e.stopPropagation();
    await deleteThread(threadId);
    if (activeThreadId === threadId) {
      navigate("/intelligence");
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-[11px] uppercase tracking-[0.08em] text-dim">
          Chat History
        </p>
        <button
          onClick={handleNewChat}
          className="rounded-md p-1 text-dim hover:text-foreground hover:bg-muted transition-colors"
          title="New chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-0.5 max-h-[220px] overflow-y-auto scrollbar-thin">
        {isLoading && threads.length === 0 && (
          <div className="text-xs text-dim px-2 py-2">Loading…</div>
        )}
        {!isLoading && threads.length === 0 && (
          <div className="text-xs text-dim px-2 py-2">
            No conversations yet
          </div>
        )}
        {threads.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => handleSelectThread(t.id)}
            onKeyDown={(e) => e.key === "Enter" && handleSelectThread(t.id)}
            className={cn(
              "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all duration-100 cursor-pointer",
              activeThreadId === t.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{t.title}</p>
              <p className="text-[10px] text-dim">{formatTime(t.updated_at)}</p>
            </div>
            <button
              onClick={(e) => handleDelete(e, t.id)}
              className="hidden group-hover:flex shrink-0 rounded p-0.5 text-dim hover:text-negative transition-colors"
              title="Delete thread"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
