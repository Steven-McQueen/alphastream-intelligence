import { useState, useRef, useEffect, FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, Mic } from 'lucide-react';

interface ChatBarProps {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Called when the user submits a message */
  onSubmit: (text: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disable the input */
  disabled?: boolean;
  /** Keyboard shortcut hint, e.g. "⌘ K" */
  kbdHint?: string;
  /** Controlled value */
  value?: string;
  /** Controlled value change handler */
  onValueChange?: (value: string) => void;
  /** Animated placeholder (overrides static placeholder visually) */
  animatedPlaceholder?: string;
  /** Ref forwarded to the internal input element */
  inputRef?: React.RefObject<HTMLInputElement>;
  /** Focus/blur callbacks */
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}

export function ChatBar({
  placeholder = 'Ask anything about US markets\u2026',
  onSubmit,
  className,
  disabled = false,
  kbdHint,
  value,
  onValueChange,
  animatedPlaceholder,
  inputRef,
  onInputFocus,
  onInputBlur,
}: ChatBarProps) {
  const fallbackRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? fallbackRef;
  const isControlled = typeof value === 'string' && typeof onValueChange === 'function';
  const [internalValue, setInternalValue] = useState('');
  const currentValue = isControlled ? value! : internalValue;
  const setValue = isControlled ? onValueChange! : setInternalValue;

  const canSend = currentValue.trim().length > 0 && !disabled;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    onSubmit(currentValue.trim());
    setValue('');
  };

  return (
    <div className={cn('w-full', className)}>
      <form onSubmit={handleSubmit}>
        <div
          className="flex items-center gap-3 rounded-2xl px-4"
          style={{
            background: 'var(--chat-surface)',
            border: '1px solid var(--chat-border)',
            boxShadow: '0 4px 24px oklch(0 0 0 / 0.25)',
            transition: 'border-color 180ms var(--chat-ease)',
            height: '3.5rem',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--chat-border-h)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--chat-border)')}
          onClick={() => ref.current?.focus()}
        >
          {/* Leading icon */}
          <svg
            className="flex-shrink-0"
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

          {/* Input with animated placeholder overlay */}
          <div className="relative flex-1">
            {!currentValue && animatedPlaceholder && (
              <span
                className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-sm select-none"
                style={{ color: 'var(--chat-faint)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
              >
                {animatedPlaceholder}
              </span>
            )}
            <input
              ref={ref}
              type="text"
              value={currentValue}
              onChange={(e) => setValue(e.target.value)}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              placeholder={animatedPlaceholder ? '' : placeholder}
              disabled={disabled}
              className="w-full bg-transparent border-none outline-none focus-visible:ring-0 text-sm"
              style={{
                color: 'var(--chat-text)',
                fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
                caretColor: 'var(--chat-text)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) {
                    onSubmit(currentValue.trim());
                    setValue('');
                  }
                }
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="flex items-center justify-center w-7 h-7 rounded-full"
              style={{ color: 'var(--chat-faint)' }}
            >
              <Mic className="w-[15px] h-[15px]" />
            </span>

            <button
              type="submit"
              disabled={!canSend}
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-150"
              style={{
                background: canSend ? 'var(--chat-send)' : 'var(--chat-surface-up)',
                color: canSend ? 'var(--chat-send-fg)' : 'var(--chat-faint)',
              }}
              aria-label="Send"
            >
              <ArrowUp className="w-[13px] h-[13px]" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </form>

      {kbdHint && (
        <p
          className="text-center mt-2.5 text-[0.7rem]"
          style={{ color: 'var(--chat-faint)', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
        >
          Press{' '}
          <kbd
            className="inline-flex items-center px-[0.45em] py-[0.1em] rounded-[0.3em] text-[0.7rem]"
            style={{
              background: 'var(--chat-surface-up)',
              border: '1px solid var(--chat-border)',
              color: 'var(--chat-faint)',
              fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
            }}
          >
            {kbdHint}
          </kbd>{' '}
          to open
        </p>
      )}
    </div>
  );
}
