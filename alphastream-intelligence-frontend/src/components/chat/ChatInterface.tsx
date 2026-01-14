import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Loader2, Sparkles, Send, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Model configuration
export type ModelId = 'claude' | 'gpt' | 'gemini-flash' | 'gemini-pro' | 'grok' | 'sonar';

interface ModelOption {
  id: ModelId;
  name: string;
  color: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude', name: 'Claude Sonnet', color: '#8B5CF6' },
  { id: 'gpt', name: 'GPT-4', color: '#10B981' },
  { id: 'gemini-flash', name: 'Gemini Flash', color: '#3B82F6' },
  { id: 'gemini-pro', name: 'Gemini Pro', color: '#3B82F6' },
  { id: 'grok', name: 'Grok', color: '#71717A' },
  { id: 'sonar', name: 'Sonar Pro', color: '#F59E0B' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  contextType?: 'stock' | 'portfolio' | 'index' | 'general';
  contextLabel?: string; // e.g., "AAPL", "Portfolio", "S&P 500"
  placeholder?: string;
  suggestedPrompts?: string[];
  onSubmit?: (message: string, model: ModelId) => Promise<string>;
  className?: string;
  compact?: boolean;
  defaultModel?: ModelId;
}

// Animated gradient mesh background component
function GradientMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
      
      {/* Animated gradient orbs */}
      <div 
        className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full opacity-30 blur-3xl animate-gradient-1"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
        }}
      />
      <div 
        className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-20 blur-3xl animate-gradient-2"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
        }}
      />
      <div 
        className="absolute top-1/4 right-1/4 w-1/2 h-1/2 rounded-full opacity-15 blur-3xl animate-gradient-3"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
        }}
      />
      
      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Top gradient fade for text readability */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-zinc-950/80 to-transparent" />
    </div>
  );
}

// Message bubble component
function MessageBubble({ message, isTyping }: { message: Message; isTyping?: boolean }) {
  const isUser = message.role === 'user';
  
  if (isTyping) {
    return (
      <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-violet-400" />
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2", isUser && "flex-row-reverse")}>
      <div 
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border",
          isUser 
            ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30" 
            : "bg-gradient-to-br from-violet-500/20 to-blue-500/20 border-white/10"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-blue-400" />
        ) : (
          <Bot className="h-4 w-4 text-violet-400" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] px-4 py-3 border backdrop-blur-sm",
          isUser
            ? "bg-blue-500/10 border-blue-500/20 rounded-2xl rounded-tr-sm"
            : "bg-white/5 border-white/10 rounded-2xl rounded-tl-sm"
        )}
      >
        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}

export function ChatInterface({
  contextType = 'general',
  contextLabel,
  placeholder,
  suggestedPrompts = [],
  onSubmit,
  className,
  compact = false,
  defaultModel = 'gemini-flash',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(defaultModel);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeModel = MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const defaultPlaceholder = contextLabel 
    ? `Ask about ${contextLabel}...` 
    : 'Ask anything about markets, stocks, or analysis...';

  const handleSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add typing indicator
    const typingId = `${userMessage.id}-typing`;
    setMessages((prev) => [...prev, { id: typingId, role: 'assistant', content: '__typing__' }]);

    try {
      let response: string;
      
      if (onSubmit) {
        response = await onSubmit(text.trim(), selectedModel);
      } else {
        // Mock response for demo
        await new Promise((resolve) => setTimeout(resolve, 1500));
        response = `I am analyzing your question about ${contextLabel || 'the market'}... "${text.trim()}" — Here's a comprehensive analysis with key insights, data points, and recommendations.`;
      }

      // Remove typing indicator and add response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== typingId);
        return [...filtered, { id: `${userMessage.id}-response`, role: 'assistant', content: response }];
      });
    } catch (error) {
      // Remove typing indicator on error
      setMessages((prev) => prev.filter((m) => m.id !== typingId));
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(inputValue);
    }
  };

  const handlePromptClick = (prompt: string) => {
    handleSubmit(prompt);
  };

  return (
    <div className={cn("relative rounded-xl overflow-hidden border border-white/10", className)}>
      {/* Animated Background */}
      <GradientMeshBackground />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/10 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 animate-pulse" />
            <span className="text-sm font-medium text-white/80">
              {contextLabel ? `Ask about ${contextLabel}` : 'AlphaStream AI'}
            </span>
          </div>
          
          {/* Model Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: activeModel.color }}
                />
                <span>{activeModel.name}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-48 bg-zinc-900 border border-zinc-800 rounded-lg p-1"
            >
              {MODEL_OPTIONS.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onSelect={() => setSelectedModel(model.id)}
                  className="flex items-center gap-2 text-sm text-zinc-300 rounded-md px-3 py-2 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: model.color }}
                  />
                  <span className="flex-1">{model.name}</span>
                  {selectedModel === model.id && <Check className="h-4 w-4 text-zinc-200" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages Area */}
        <ScrollArea 
          className={cn("flex-1 p-4", compact ? "max-h-[350px]" : "min-h-[400px]")} 
          ref={scrollRef}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="mb-6">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-white/10 mb-4 mx-auto">
                  <Sparkles className="h-6 w-6 text-violet-400" />
                </div>
                <h2 className="text-lg font-semibold text-white/90 mb-1">
                  {contextLabel ? `Ask about ${contextLabel}` : 'Ask AlphaStream'}
                </h2>
                <p className="text-sm text-zinc-500 max-w-sm">
                  AI-powered insights for investment analysis, market trends, and portfolio optimization.
                </p>
              </div>

              {/* Suggested Prompts */}
              {suggestedPrompts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePromptClick(prompt)}
                      className="text-left text-xs text-zinc-400 hover:text-white px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                message.content === '__typing__' ? (
                  <MessageBubble key={message.id} message={message} isTyping />
                ) : (
                  <MessageBubble key={message.id} message={message} />
                )
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || defaultPlaceholder}
                disabled={isLoading}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => handleSubmit(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                inputValue.trim() && !isLoading
                  ? "bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:opacity-90"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 text-center mt-2">
            AI analysis is for informational purposes only. Not financial advice.
          </p>
        </div>
      </div>

      {/* CSS for gradient animations */}
      <style>{`
        @keyframes gradient-1 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          25% { transform: translate(10%, 10%) scale(1.1); }
          50% { transform: translate(5%, -5%) scale(0.95); }
          75% { transform: translate(-10%, 5%) scale(1.05); }
        }
        @keyframes gradient-2 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          25% { transform: translate(-10%, -10%) scale(1.05); }
          50% { transform: translate(-5%, 10%) scale(1.1); }
          75% { transform: translate(10%, -5%) scale(0.95); }
        }
        @keyframes gradient-3 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33% { transform: translate(15%, -10%) scale(1.1); }
          66% { transform: translate(-10%, 15%) scale(0.9); }
        }
        .animate-gradient-1 { animation: gradient-1 15s ease-in-out infinite; }
        .animate-gradient-2 { animation: gradient-2 18s ease-in-out infinite; }
        .animate-gradient-3 { animation: gradient-3 20s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

