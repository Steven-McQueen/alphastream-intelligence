import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRef } from 'react';

export type ModelId = 'sonar' | 'gpt' | 'gemini-flash' | 'gemini-pro' | 'grok' | 'claude';

interface ModelOption {
  id: ModelId;
  name: string;
  color: string;
}

const MODEL_COLORS: Record<ModelId, string> = {
  'claude': '#8B5CF6',
  'gpt': '#10B981',
  'gemini-flash': '#3B82F6',
  'gemini-pro': '#3B82F6',
  'grok': '#71717A',
  'sonar': '#F59E0B',
};

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude', name: 'Claude Sonnet', color: MODEL_COLORS['claude'] },
  { id: 'gpt', name: 'GPT', color: MODEL_COLORS['gpt'] },
  { id: 'gemini-flash', name: 'Gemini Flash', color: MODEL_COLORS['gemini-flash'] },
  { id: 'gemini-pro', name: 'Gemini Pro', color: MODEL_COLORS['gemini-pro'] },
  { id: 'grok', name: 'Grok', color: MODEL_COLORS['grok'] },
  { id: 'sonar', name: 'Sonar Pro', color: MODEL_COLORS['sonar'] },
];

interface PerplexityChatInputProps {
  onSubmit: (value: string, model: ModelId) => void;
  placeholder?: string;
  disabled?: boolean;
  defaultValue?: string;
  defaultModel?: ModelId;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  animatedPlaceholder?: string;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}

export function PerplexityChatInput({
  onSubmit,
  placeholder = 'Ask about markets, stocks, earnings...',
  disabled = false,
  defaultValue = '',
  defaultModel = 'gemini-flash',
  className,
  value,
  onValueChange,
  inputRef,
  animatedPlaceholder,
  onInputFocus,
  onInputBlur,
}: PerplexityChatInputProps) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const isControlled = typeof value === 'string' && typeof onValueChange === 'function';
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [selectedModel, setSelectedModel] = useState<ModelId>(defaultModel);
  const activeModel =
    MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[MODEL_OPTIONS.length - 1];

  const currentValue = isControlled ? (value as string) : internalValue;
  const setValue = isControlled ? (onValueChange as (v: string) => void) : setInternalValue;

  const canSend = currentValue.trim().length > 0 && !disabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSend) {
      onSubmit(currentValue.trim(), selectedModel);
      if (!isControlled) {
        setInternalValue('');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div
        className={cn(
          'flex h-14 items-center gap-3 rounded-full',
          'bg-zinc-900 border border-white/10 hover:border-white/20 focus-within:border-white/20',
          'px-3 transition-colors'
        )}
      >
        {/* Model Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-full transition-colors"
              disabled={disabled}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: activeModel.color }}
              />
              <span>{activeModel.name}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={10}
            className="w-52 bg-[#18181b] border border-[#27272a] rounded-lg p-1"
          >
            {MODEL_OPTIONS.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onSelect={() => setSelectedModel(model.id)}
                className="flex items-center gap-2 text-sm text-zinc-300 rounded-md px-3 py-2 hover:bg-white/10 hover:text-white"
                data-selected={selectedModel === model.id}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: model.color }}
                />
                <span className="flex-1">{model.name}</span>
                {selectedModel === model.id && <Check className="h-4 w-4 text-zinc-200" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="h-5 w-px bg-white/10" aria-hidden="true" />

        {/* Input */}
        <div className="relative flex-1">
          {!currentValue && animatedPlaceholder && (
            <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-lg text-white/40">
              {animatedPlaceholder}
            </span>
          )}
          <input
            value={currentValue}
            onChange={(e) => setValue(e.target.value)}
            placeholder=""
            disabled={disabled}
            ref={inputRef ?? internalInputRef}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            className="w-full bg-transparent border-none outline-none focus-visible:ring-0 text-lg text-zinc-100 placeholder:text-zinc-500"
          />
        </div>

        {/* Action */}
        <button
          type="submit"
          disabled={!canSend}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
            canSend
              ? 'bg-[#20b8cd] text-white hover:brightness-110'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

