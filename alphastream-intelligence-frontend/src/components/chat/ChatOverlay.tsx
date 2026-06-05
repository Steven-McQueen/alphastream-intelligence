import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, ArrowUp, AlertTriangle, Copy, Check, Download, RefreshCw, Plug, ChevronDown } from 'lucide-react';
import { useChatStream } from '@/hooks/useChatStream';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { AgentSelector } from '@/components/chat/AgentSelector';
import { useComposerChatModels } from '@/hooks/useComposerChatModels';
import { useComposerAgents } from '@/hooks/useComposerAgents';
import { getStoredModelId, setStoredModelId } from '@/config/chatModels';
import { getStoredAgentId, setStoredAgentId } from '@/config/chatAgents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { copyText, downloadMarkdown, downloadDoc, exportPdf } from '@/lib/chatExport';
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

/** Centered reading column — Claude-style comfortable measure */
const CHAT_COLUMN = 'max-w-[44rem] mx-auto w-full';

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
  /** Active model id (controlled). If omitted, the overlay manages its own, seeded from storage. */
  modelId?: string;
  /** Called when the user picks a model (controlled). If omitted, the overlay persists locally. */
  onModelIdChange?: (modelId: string) => void;
  /** External error message to surface in the banner (controlled mode) */
  error?: string | null;
  /** Re-run the last user turn (controlled mode). If omitted, the overlay uses its own hook. */
  onRegenerate?: () => void;
  /** Show the internal header bar (title + close). Default true. Popup mode always shows it. */
  showHeader?: boolean;
  /** Blend into the page: transparent background, no border/shadow. Default false. */
  seamless?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */
function TypingDots() {
  return (
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
  );
}

/** Shown while the agent is calling FMP tools, before the answer streams. */
function ToolActivityIndicator({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 py-[0.2rem] text-[0.8125rem]"
      style={{ color: 'var(--chat-muted)' }}
    >
      <span
        className="w-[0.875rem] h-[0.875rem] rounded-full border-2 border-current border-t-transparent animate-spin"
        aria-hidden
      />
      <span>{label}…</span>
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
/*  Assistant message actions (signature + toolbar)                    */
/* ------------------------------------------------------------------ */
function AssistantActions({
  content,
  modelLabel,
  canRegenerate,
  onRegenerate,
}: {
  content: string;
  modelLabel?: string;
  canRegenerate: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {modelLabel && (
        <span
          className="text-[0.78rem]"
          style={{ color: 'var(--chat-faint)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
        >
          Prepared using {modelLabel}
        </span>
      )}

      <div className="flex items-center gap-0.5 -ml-1.5">
        <button
          type="button"
          onClick={handleCopy}
          className="chat-action-btn"
          aria-label={copied ? 'Copied' : 'Copy'}
          title="Copy"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="chat-action-btn" aria-label="Download" title="Download">
            <Download className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="chat-model-menu min-w-[10rem] p-1">
            <DropdownMenuItem
              onClick={() => downloadMarkdown(content)}
              className="chat-model-menu-item rounded-md px-2 py-1.5 text-[0.8125rem] cursor-pointer"
            >
              Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => downloadDoc(content)}
              className="chat-model-menu-item rounded-md px-2 py-1.5 text-[0.8125rem] cursor-pointer"
            >
              Word / Docs (.doc)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportPdf(content)}
              className="chat-model-menu-item rounded-md px-2 py-1.5 text-[0.8125rem] cursor-pointer"
            >
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {canRegenerate && onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="chat-action-btn"
            aria-label="Regenerate response"
            title="Regenerate"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Message bubble                                                     */
/* ------------------------------------------------------------------ */
function MessageBubble({
  message,
  modelLabel,
  showActions,
  canRegenerate,
  onRegenerate,
}: {
  message: ChatMessage;
  modelLabel?: string;
  showActions?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] px-4 py-2.5 text-[0.9375rem] leading-relaxed"
          style={{
            fontFamily: 'var(--font-page-heading)',
            color: 'var(--chat-text)',
            background: 'var(--chat-surface-up)',
            borderRadius: '1.125rem',
            borderBottomRightRadius: '0.375rem',
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div>
      {message.agent && (
        <div className="mb-1 text-[0.7rem] uppercase tracking-wider text-[var(--chat-faint)]">
          via {message.agent.name}
        </div>
      )}
      <div
        className="chat-md"
        style={{
          fontFamily: 'var(--font-page-heading)',
          fontSize: '1rem',
          lineHeight: '1.74',
          color: 'var(--chat-text)',
        }}
      >
        <ReactMarkdown remarkPlugins={MD_PLUGINS} components={mdComponents}>
          {message.content}
        </ReactMarkdown>
      </div>
      {showActions && message.content.trim().length > 0 && (
        <AssistantActions
          content={message.content}
          modelLabel={modelLabel}
          canRegenerate={!!canRegenerate}
          onRegenerate={onRegenerate}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Composer (textarea + send button)                                  */
/* ------------------------------------------------------------------ */
function Composer({
  onSend,
  disabled,
  modelId,
  onModelIdChange,
  agentId,
  onAgentIdChange,
  connectors,
  onToggleConnector,
  floating = false,
  suggestedPrompts = [],
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  modelId: string;
  onModelIdChange: (modelId: string) => void;
  agentId: string;
  onAgentIdChange: (agentId: string) => void;
  connectors: ConnectorState;
  onToggleConnector: (key: ChatMode) => void;
  /** Free-floating landing mode: prompts rise above the input on focus. */
  floating?: boolean;
  suggestedPrompts?: string[];
}) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = text.trim().length > 0 && !disabled;
  const showPrompts = floating && focused && suggestedPrompts.length > 0;

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
    <div style={floating ? undefined : { padding: '0.5rem 1.25rem 1.25rem' }}>
      <div className={CHAT_COLUMN}>
        {showPrompts && (
          <div className="mb-2.5 flex flex-col gap-1.5 animate-chat-prompts">
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={prompt}
                type="button"
                // mouseDown fires before the textarea blur, so the panel
                // doesn't vanish before the click registers.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSend(prompt);
                }}
                className="chat-suggest-row chat-prompt-item group flex items-center justify-between gap-3 text-left text-[0.875rem] rounded-xl px-4 py-2.5 cursor-pointer"
                style={{ animationDelay: `${i * 40}ms`, fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
              >
                <span>{prompt}</span>
                <ArrowUp
                  className="w-3.5 h-3.5 shrink-0 rotate-45 opacity-0 transition-opacity duration-150 group-hover:opacity-60"
                  strokeWidth={2}
                />
              </button>
            ))}
          </div>
        )}
        <div className="chat-composer flex flex-col gap-2.5 px-4 pt-3.5 pb-2.5">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
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
              className="w-full bg-transparent border-none outline-none resize-none overflow-auto text-[0.9375rem] leading-relaxed"
              style={{
                fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
                color: 'var(--chat-text)',
                caretColor: 'var(--chat-send)',
                minHeight: '1.5rem',
                maxHeight: '12.5rem',
              }}
              aria-label="Ask anything about US markets"
            />
            {!text && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-[0.9375rem] leading-relaxed select-none"
                style={{ color: 'var(--chat-faint)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
              >
                Ask anything about US markets
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <AgentSelector
                activeAgentId={agentId}
                onChange={onAgentIdChange}
                className="min-w-0"
              />
              <ModelSelector
                activeModelId={modelId}
                onChange={onModelIdChange}
                className="min-w-0"
              />
              <ConnectorsButton connectors={connectors} onToggle={onToggleConnector} />
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-all duration-150"
              style={{
                background: canSend ? 'var(--chat-send)' : 'var(--chat-surface)',
                color: canSend ? 'var(--chat-send-fg)' : 'var(--chat-faint)',
                border: canSend ? '1px solid transparent' : '1px solid var(--chat-border)',
              }}
              aria-label="Send"
            >
              <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Connectors toggle                                                  */
/* ------------------------------------------------------------------ */
/** Toggleable data sources. Underlying wiring is intentionally not built yet. */
export const CONNECTORS: ChatMode[] = ['Portfolio', 'Database', 'FMP', 'Internet'];

export type ConnectorState = Record<ChatMode, boolean>;

function ConnectorsButton({
  connectors,
  onToggle,
}: {
  connectors: ConnectorState;
  onToggle: (key: ChatMode) => void;
}) {
  const activeCount = CONNECTORS.filter((c) => connectors[c]).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="chat-model-trigger flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] cursor-pointer transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-[var(--chat-text)]"
        aria-label="Connectors"
      >
        <Plug className="h-3.5 w-3.5 text-[var(--chat-muted)]" />
        <span className="text-[var(--chat-text)]">Connectors</span>
        {activeCount > 0 && (
          <span
            className="flex items-center justify-center min-w-[1.05rem] h-[1.05rem] px-1 rounded-full text-[0.625rem] font-semibold"
            style={{ background: 'var(--chat-send)', color: 'var(--chat-send-fg)' }}
          >
            {activeCount}
          </span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 text-[var(--chat-faint)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="chat-model-menu min-w-[12rem] p-1">
        <DropdownMenuLabel className="px-2 py-1 text-[0.65rem] uppercase tracking-wider text-[var(--chat-faint)]">
          Connectors
        </DropdownMenuLabel>
        {CONNECTORS.map((c) => (
          <DropdownMenuCheckboxItem
            key={c}
            checked={connectors[c]}
            onCheckedChange={() => onToggle(c)}
            onSelect={(e) => e.preventDefault()}
            className="chat-model-menu-item rounded-md py-1.5 text-[0.8125rem] cursor-pointer"
          >
            {c}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
  modelId: externalModelId,
  onModelIdChange,
  error: externalError,
  onRegenerate,
  showHeader = true,
  seamless = false,
}: ChatOverlayProps) {
  const [connectors, setConnectors] = useState<ConnectorState>({
    Portfolio: false,
    Database: false,
    FMP: false,
    Internet: false,
  });
  const [internalModelId, setInternalModelId] = useState<string>(() => getStoredModelId());
  const [agentId, setAgentId] = useState<string>(() => getStoredAgentId());
  const { agents } = useComposerAgents();

  const toggleConnector = (key: ChatMode) =>
    setConnectors((prev) => ({ ...prev, [key]: !prev[key] }));

  // Active connectors feed chat_mode for now; real wiring comes later.
  const activeConnectors = CONNECTORS.filter((c) => connectors[c]);
  const chatModeValue = activeConnectors.length ? activeConnectors.join(', ') : undefined;
  const scrollRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { models } = useComposerChatModels();

  const isControlled = !!externalMessages;

  // Model is controlled when the parent supplies a value; otherwise the
  // overlay owns it and persists to localStorage (uncontrolled usage).
  const activeModelId = externalModelId ?? internalModelId;

  const activeModelLabel =
    models.find((m) => m.model_id === activeModelId)?.label ?? activeModelId;

  const hook = useChatStream({
    contextLabel: contextLabel,
    chatMode: chatModeValue,
    modelId: activeModelId,
    agent: agentId,
  });

  const messages = isControlled ? externalMessages! : hook.messages;
  const isGenerating = isControlled ? (externalGenerating ?? false) : hook.isGenerating;
  const toolActivity = isControlled ? null : hook.toolActivity;
  const displayError = externalError ?? hook.error;
  const handleRegenerate = onRegenerate ?? hook.regenerate;

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  const handleModelIdChange = (id: string) => {
    if (onModelIdChange) {
      onModelIdChange(id);
    } else {
      setInternalModelId(id);
      setStoredModelId(id);
    }
  };

  const handleAgentIdChange = (id: string) => {
    setAgentId(id);
    setStoredAgentId(id);
  };

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
    // Slash accelerator: a leading "/slug" routes this one message to that
    // agent (e.g. "/financial_advisor what's AAPL's P/E"), regardless of the
    // composer's selected agent.
    const slash = text.match(/^\/([a-z0-9_-]+)\s+([\s\S]+)$/i);
    if (slash) {
      const slug = slash[1].toLowerCase();
      if (agents.some((a) => a.slug === slug)) {
        hook.sendMessage(slash[2].trim(), slug);
        return;
      }
    }
    hook.sendMessage(text);
  };

  // Popup mode: don't render if closed
  if (mode === 'popup' && !isOpen) return null;
  // Popup mode with no content: don't render
  if (mode === 'popup' && messages.length === 0 && !isGenerating) return null;

  const showClose = !hideClose && onClose;
  // Popup always needs a header (title + close); embedded can opt out.
  const renderHeader = mode === 'popup' || showHeader;

  return (
    <div
      ref={overlayRef}
      className={cn(
        'flex flex-col overflow-hidden',
        mode === 'popup' && 'absolute bottom-full left-0 right-0 mb-2 z-50 max-h-[500px] animate-search-dialog-in',
        className,
      )}
      style={{
        background: seamless ? 'transparent' : 'var(--chat-surface)',
        border: seamless ? 'none' : '1px solid var(--chat-border)',
        borderRadius: seamless ? '0' : '1.25rem',
        boxShadow: mode === 'popup' ? '0 24px 64px oklch(0 0 0 / 0.45)' : 'none',
      }}
    >
      {/* Top bar */}
      {renderHeader && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--chat-border)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
              style={{ color: 'var(--chat-faint)' }}
            >
              <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9A9 9 0 0 1 3 12a9 9 0 0 1 9-9Z" />
              <path d="M12 8v4l3 3" />
            </svg>
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--chat-text)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
            >
              {contextLabel || 'New Thread'}
            </span>
          </div>

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
      )}

      {messages.length === 0 && !isGenerating ? (
        /* Free-floating landing: centered input; prompts rise on focus. */
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 animate-chat-empty-in">
          <div className={cn(CHAT_COLUMN, 'w-full')}>
            <div className="text-center mb-7 flex flex-col items-center gap-2">
              <h2
                className="text-[1.7rem] leading-tight"
                style={{ color: 'var(--chat-text)', fontFamily: 'var(--font-serif)' }}
              >
                {!contextLabel || contextLabel === 'Assistant'
                  ? 'How can I help?'
                  : `Ask about ${contextLabel}`}
              </h2>
              <p
                className="text-sm"
                style={{ color: 'var(--chat-faint)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
              >
                AI-powered market analysis and insights
              </p>
            </div>
            {displayError && (
              <p className="text-center text-[0.8rem] mb-3" style={{ color: 'var(--chat-accent)' }}>
                {displayError}
              </p>
            )}
            <Composer
              floating
              suggestedPrompts={suggestedPrompts}
              onSend={handleSend}
              disabled={isGenerating}
              modelId={activeModelId}
              onModelIdChange={handleModelIdChange}
              agentId={agentId}
              onAgentIdChange={handleAgentIdChange}
              connectors={connectors}
              onToggleConnector={toggleConnector}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Messages area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-6 overscroll-contain scrollbar-slim animate-chat-conv-enter"
            style={{ minHeight: mode === 'embedded' ? '200px' : undefined }}
          >
            <div className={cn(CHAT_COLUMN, 'flex flex-col gap-6')}>
              {messages.map((msg, idx) => {
                const isLastAssistant = idx === lastAssistantIdx;
                const isStreamingThis = isLastAssistant && isGenerating;
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    modelLabel={activeModelLabel}
                    showActions={msg.role === 'assistant' && !isStreamingThis}
                    canRegenerate={isLastAssistant && !isGenerating}
                    onRegenerate={handleRegenerate}
                  />
                );
              })}
              {isGenerating && lastAssistantIdx >= 0 && messages[lastAssistantIdx].content === '' &&
                (toolActivity ? <ToolActivityIndicator label={toolActivity} /> : <TypingDots />)}
            </div>
          </div>

          {/* Error banner */}
          {displayError && (
            <div
              className="border-t"
              style={{ borderColor: 'var(--chat-border)', background: 'var(--chat-surface-up)' }}
              role="alert"
            >
              <div
                className={cn(CHAT_COLUMN, 'flex items-start gap-2 py-2.5 text-[0.8rem]')}
                style={{ color: 'var(--chat-muted)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--chat-accent)' }} />
                <span>{displayError}</span>
              </div>
            </div>
          )}

          {/* Composer (docked) */}
          <Composer
            onSend={handleSend}
            disabled={isGenerating}
            modelId={activeModelId}
            onModelIdChange={handleModelIdChange}
            agentId={agentId}
            onAgentIdChange={handleAgentIdChange}
            connectors={connectors}
            onToggleConnector={toggleConnector}
          />
        </>
      )}
    </div>
  );
}
