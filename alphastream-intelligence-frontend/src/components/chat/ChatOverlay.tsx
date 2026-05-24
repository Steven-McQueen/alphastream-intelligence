import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, ArrowUp } from 'lucide-react';
import { useChatStream } from '@/hooks/useChatStream';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export type ChatMode = 'Portfolio' | 'Database' | 'FMP' | 'Internet';

export interface ChatOverlayProps {
  /** 'popup' floats above a ChatBar; 'embedded' renders inline */
  mode?: 'popup' | 'embedded';
  /** Only for popup mode — whether the overlay is visible */
  isOpen?: boolean;
  /** Only for popup mode — close handler */
  onClose?: () => void;
  /** Label shown in the top bar, e.g. "Finance", "AAPL" */
  contextLabel?: string;
  /** Suggested prompt chips shown when no messages exist */
  suggestedPrompts?: string[];
  /** Additional CSS classes */
  className?: string;
  /** External message list (controlled) — if provided, overlay won't manage its own */
  messages?: ChatMessage[];
  /** External send handler — if provided, overlay calls this instead of managing internally */
  onSendMessage?: (text: string) => void;
  /** External generating state */
  isGenerating?: boolean;
  /** Hide the close button (for embedded full-page usage) */
  hideClose?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */
function TypingDots() {
  return (
    <div className="flex items-start gap-3">
      <MsgAvatar />
      <div className="flex gap-[0.4rem] items-center py-[0.2rem]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[0.375rem] h-[0.375rem] rounded-full"
            style={{
              background: 'var(--chat-faint)',
              animation: `chat-bounce 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Message avatar                                                     */
/* ------------------------------------------------------------------ */
function MsgAvatar() {
  return (
    <div
      className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
      style={{
        background: 'var(--chat-surface-up)',
        border: '1px solid var(--chat-border)',
        color: 'var(--chat-faint)',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9A9 9 0 0 1 3 12a9 9 0 0 1 9-9Z" />
        <path d="M12 8v4l3 3" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Markdown components for assistant messages                         */
/* ------------------------------------------------------------------ */
const MD_PLUGINS = [remarkGfm];

const mdComponents: Components = {
  p: ({ children }) => <p className="chat-md-p">{children}</p>,
  ul: ({ children }) => <ul className="chat-md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="chat-md-ol">{children}</ol>,
  li: ({ children }) => <li className="chat-md-li">{children}</li>,
  strong: ({ children }) => <strong className="chat-md-strong">{children}</strong>,
  em: ({ children }) => <em className="chat-md-em">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="chat-md-a">{children}</a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return <code className={cn('chat-md-code-block', className)} {...props}>{children}</code>;
    }
    return <code className="chat-md-code" {...props}>{children}</code>;
  },
  pre: ({ children }) => <pre className="chat-md-pre">{children}</pre>,
  h1: ({ children }) => <h3 className="chat-md-heading">{children}</h3>,
  h2: ({ children }) => <h3 className="chat-md-heading">{children}</h3>,
  h3: ({ children }) => <h3 className="chat-md-heading">{children}</h3>,
  h4: ({ children }) => <h4 className="chat-md-heading chat-md-heading-sm">{children}</h4>,
  table: ({ children }) => (
    <div className="chat-md-table-wrap"><table className="chat-md-table">{children}</table></div>
  ),
  thead: ({ children }) => <thead className="chat-md-thead">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="chat-md-tr">{children}</tr>,
  th: ({ children }) => <th className="chat-md-th">{children}</th>,
  td: ({ children }) => <td className="chat-md-td">{children}</td>,
  hr: () => <hr className="chat-md-hr" />,
  blockquote: ({ children }) => <blockquote className="chat-md-blockquote">{children}</blockquote>,
};

/* ------------------------------------------------------------------ */
/*  Message bubble                                                     */
/* ------------------------------------------------------------------ */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[84%] px-3.5 py-2 text-sm leading-relaxed"
          style={{
            fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
            color: 'var(--chat-muted)',
            background: 'var(--chat-surface-up)',
            border: '1px solid var(--chat-border)',
            borderRadius: '0.75rem',
            borderBottomRightRadius: '0.25rem',
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <MsgAvatar />
      <div
        className="chat-md max-w-[84%]"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '0.9375rem',
          lineHeight: '1.72',
          color: 'var(--chat-text)',
        }}
      >
        <ReactMarkdown remarkPlugins={MD_PLUGINS} components={mdComponents}>
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Composer (textarea + send button)                                  */
/* ------------------------------------------------------------------ */
function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = text.trim().length > 0 && !disabled;

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div
      className="border-t"
      style={{ borderColor: 'var(--chat-border)', padding: '0.75rem 1rem 1rem' }}
    >
      <div
        className="flex flex-col gap-2 rounded-[0.875rem] px-4 pt-3 pb-2.5"
        style={{
          background: 'var(--chat-surface-up)',
          border: '1px solid var(--chat-border)',
        }}
      >
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={disabled}
            rows={1}
            className="w-full bg-transparent border-none outline-none resize-none overflow-auto text-sm leading-relaxed"
            style={{
              fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
              color: 'var(--chat-text)',
              caretColor: 'var(--chat-text)',
              minHeight: '1.5rem',
              maxHeight: '12.5rem',
            }}
            aria-label="Ask anything about US markets"
          />
          {!text && (
            <span
              className="pointer-events-none absolute top-0 left-0 text-sm leading-relaxed select-none"
              style={{ color: 'var(--chat-faint)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
            >
              Ask anything about US markets
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span
            className="text-[0.7rem]"
            style={{ color: 'var(--chat-faint)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
          >
            &crarr; Enter to send &middot; &uArr; Shift+Enter for newline
          </span>

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-150"
            style={{
              background: canSend ? 'var(--chat-send)' : 'var(--chat-surface-up)',
              color: canSend ? 'var(--chat-send-fg)' : 'var(--chat-faint)',
              border: canSend ? '1px solid transparent' : '1px solid var(--chat-border)',
            }}
            aria-label="Send"
          >
            <ArrowUp className="w-3 h-3" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Suggestion chips (shown before first message)                      */
/* ------------------------------------------------------------------ */
function SuggestionChips({
  prompts,
  onSelect,
  contextLabel,
}: {
  prompts: string[];
  onSelect: (text: string) => void;
  contextLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-6 px-4">
      <h2
        className="text-lg font-semibold"
        style={{ color: 'var(--chat-text)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
      >
        {contextLabel ? `Ask about ${contextLabel}` : 'Ask anything'}
      </h2>
      <p
        className="text-sm"
        style={{ color: 'var(--chat-muted)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
      >
        AI-powered market analysis and insights
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="text-xs rounded-full px-3 py-1.5 cursor-pointer transition-colors duration-150"
            style={{
              color: 'var(--chat-muted)',
              border: '1px solid var(--chat-border)',
              background: 'transparent',
              fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--chat-border-h)';
              e.currentTarget.style.color = 'var(--chat-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--chat-border)';
              e.currentTarget.style.color = 'var(--chat-muted)';
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mode selector buttons                                              */
/* ------------------------------------------------------------------ */
const MODES: ChatMode[] = ['Portfolio', 'Database', 'FMP', 'Internet'];

function ModeSelector({ activeMode, onChange }: { activeMode: ChatMode; onChange: (m: ChatMode) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[0.7rem] uppercase tracking-wider"
        style={{ color: 'var(--chat-faint)' }}
      >
        Mode
      </span>
      <div
        className="flex rounded-full p-[3px] gap-[3px]"
        style={{ background: 'var(--chat-surface-up)', border: '1px solid var(--chat-border)' }}
      >
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className="px-2.5 py-0.5 rounded-full text-[0.7rem] border-none cursor-pointer transition-all duration-150"
            style={{
              fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
              background: activeMode === mode ? 'var(--chat-surface)' : 'transparent',
              color: activeMode === mode ? 'var(--chat-text)' : 'var(--chat-faint)',
              boxShadow: activeMode === mode ? '0 1px 3px oklch(0 0 0 / 0.3)' : 'none',
            }}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ChatOverlay component                                         */
/* ------------------------------------------------------------------ */
export function ChatOverlay({
  mode = 'embedded',
  isOpen = true,
  onClose,
  contextLabel,
  suggestedPrompts = [],
  className,
  messages: externalMessages,
  onSendMessage,
  isGenerating: externalGenerating,
  hideClose = false,
}: ChatOverlayProps) {
  const [chatMode, setChatMode] = useState<ChatMode>('Portfolio');
  const scrollRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isControlled = !!externalMessages;

  const hook = useChatStream({
    contextLabel: contextLabel,
    chatMode: chatMode,
  });

  const messages = isControlled ? externalMessages! : hook.messages;
  const isGenerating = isControlled ? (externalGenerating ?? false) : hook.isGenerating;

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Close on outside click (popup mode)
  useEffect(() => {
    if (mode !== 'popup' || !isOpen) return;
    const handle = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setTimeout(() => onClose?.(), 0);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [mode, isOpen, onClose]);

  const handleSend = (text: string) => {
    if (onSendMessage) {
      onSendMessage(text);
      return;
    }
    hook.sendMessage(text);
  };

  // Popup mode: don't render if closed
  if (mode === 'popup' && !isOpen) return null;
  // Popup mode with no content: don't render
  if (mode === 'popup' && messages.length === 0 && !isGenerating) return null;

  const badgeLabel = contextLabel || 'Finance';
  const userCount = messages.filter((m) => m.role === 'user').length;
  const showClose = !hideClose && onClose;

  return (
    <div
      ref={overlayRef}
      className={cn(
        'flex flex-col overflow-hidden',
        mode === 'popup' && 'absolute bottom-full left-0 right-0 mb-2 z-50 max-h-[500px] animate-search-dialog-in',
        className,
      )}
      style={{
        background: 'var(--chat-surface)',
        border: '1px solid var(--chat-border)',
        borderRadius: '1.25rem',
        boxShadow: mode === 'popup' ? '0 24px 64px oklch(0 0 0 / 0.45)' : '0 4px 24px oklch(0 0 0 / 0.25)',
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--chat-border)' }}
      >
        <div className="flex items-center gap-2">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--chat-faint)' }}
          >
            <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9A9 9 0 0 1 3 12a9 9 0 0 1 9-9Z" />
            <path d="M12 8v4l3 3" />
          </svg>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--chat-text)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
          >
            {contextLabel ? `Ask about ${contextLabel}` : 'New Thread'}
          </span>
          <span
            className="text-[0.7rem] px-2.5 py-0.5 rounded-full"
            style={{
              color: 'var(--chat-muted)',
              background: 'var(--chat-surface-up)',
              border: '1px solid var(--chat-border)',
            }}
          >
            {badgeLabel}
          </span>
          {userCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--chat-faint)' }}>
              {userCount} message{userCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ModeSelector activeMode={chatMode} onChange={setChatMode} />
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-full cursor-pointer transition-colors duration-100"
              style={{ color: 'var(--chat-faint)', background: 'transparent', border: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--chat-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--chat-faint)')}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain scrollbar-slim"
        style={{ minHeight: mode === 'embedded' ? '200px' : undefined }}
      >
        {messages.length === 0 && !isGenerating ? (
          <SuggestionChips
            prompts={suggestedPrompts}
            onSelect={handleSend}
            contextLabel={contextLabel}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isGenerating && <TypingDots />}
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer onSend={handleSend} disabled={isGenerating} />
    </div>
  );
}
