import { FormEvent, KeyboardEvent } from 'react';
import { Paperclip, Send, Sparkles } from 'lucide-react';

interface PerplexitySearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (prompt?: string) => void;
  suggestions: { text: string; prompt: string }[];
  placeholder?: string;
}

export function PerplexitySearchBar({
  query,
  onQueryChange,
  onSubmit,
  suggestions,
  placeholder,
}: PerplexitySearchBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(query);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(query);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit}>
        <div className="flex h-14 items-center gap-2 rounded-2xl border border-zinc-800/60 bg-[#18181b] px-3 shadow-sm shadow-black/40 transition focus-within:ring-1 focus-within:ring-zinc-700">
          <button
            type="button"
            className="flex items-center gap-1 rounded-full bg-zinc-900/50 px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 cursor-pointer"
            aria-label="Finance focus"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Finance</span>
          </button>

          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 border-none bg-transparent text-[16px] text-zinc-200 placeholder:text-zinc-500 outline-none"
          />

          <button
            type="button"
            className="text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-all hover:bg-zinc-700"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.prompt}
            type="button"
            onClick={() => onSubmit(suggestion.prompt)}
            className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
          >
            {suggestion.text}
          </button>
        ))}
      </div>
    </div>
  );
}

