import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useChatHistory } from '@/contexts/ChatHistoryContext';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Claude / Perplexity-style conversation rail for the Intelligence page.
 * Lives beside the chat (not in the global app sidebar).
 */
export function ChatHistorySidebar({ className }: { className?: string }) {
  const { threads, isLoading, deleteThread } = useChatHistory();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const activeThreadId =
    location.pathname === '/intelligence' ? searchParams.get('thread') : null;

  const handleNewChat = () => navigate('/intelligence');
  const handleSelectThread = (threadId: string) =>
    navigate(`/intelligence?thread=${threadId}`);

  const handleDelete = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    await deleteThread(threadId);
    if (activeThreadId === threadId) navigate('/intelligence');
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full w-[14.5rem] shrink-0',
        className,
      )}
    >
      <div className="px-2 pt-3 pb-1">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={{
            color: 'var(--chat-muted)',
            background: 'transparent',
            fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--chat-surface-up)';
            e.currentTarget.style.color = 'var(--chat-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--chat-muted)';
          }}
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="px-3 pt-2 pb-1.5">
        <p
          className="text-[0.65rem] uppercase tracking-[0.1em]"
          style={{ color: 'var(--chat-faint)' }}
        >
          Recent
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 scrollbar-slim">
        {isLoading && threads.length === 0 && (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--chat-faint)' }}>
            Loading…
          </div>
        )}
        {!isLoading && threads.length === 0 && (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--chat-faint)' }}>
            No conversations yet
          </div>
        )}
        {threads.map((t) => {
          const active = activeThreadId === t.id;
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectThread(t.id)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectThread(t.id)}
              className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left cursor-pointer transition-colors"
              style={{
                background: active ? 'var(--chat-surface-up)' : 'transparent',
                color: active ? 'var(--chat-text)' : 'var(--chat-muted)',
                fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--chat-surface-up)';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[0.8125rem] font-medium truncate">{t.title}</p>
                <p className="text-[0.7rem]" style={{ color: 'var(--chat-faint)' }}>
                  {formatTime(t.updated_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => handleDelete(e, t.id)}
                className="hidden group-hover:flex shrink-0 rounded p-1 transition-colors"
                style={{ color: 'var(--chat-faint)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--chat-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--chat-faint)')}
                title="Delete conversation"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
