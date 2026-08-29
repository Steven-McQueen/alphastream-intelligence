import { cn } from '@/lib/utils';
import { useComposerChatModels } from '@/hooks/useComposerChatModels';
import { ProviderIcon, resolveProviderIconKey } from '@/lib/modelProviderIcons';
import type { ChatModelDefinition } from '@/config/chatModels';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';

export interface ModelSelectorProps {
  activeModelId: string;
  onChange: (modelId: string) => void;
  className?: string;
}

/** Human-readable provider headings for the grouped dropdown. */
const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  moonshot: 'Moonshot',
  deepseek: 'DeepSeek',
};

function providerLabel(model: ChatModelDefinition): string {
  const key = resolveProviderIconKey(model.provider, model.model_id);
  return PROVIDER_LABELS[key] ?? model.provider;
}

/** Shared label + chip shell so loading / empty states stay visually consistent. */
function SelectorShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <span className="chat-model-label text-[0.7rem] uppercase tracking-wider shrink-0 text-[var(--chat-faint)]">
        Model
      </span>
      {children}
    </div>
  );
}

function PlaceholderChip({ text }: { text: string }) {
  return (
    <div
      className="chat-model-trigger flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] min-w-0 max-w-[11rem] opacity-70 cursor-default"
      aria-disabled
    >
      <span className="truncate text-[var(--chat-faint)]">{text}</span>
    </div>
  );
}

export function ModelSelector({ activeModelId, onChange, className }: ModelSelectorProps) {
  const { models, isLoading } = useComposerChatModels();

  // Never silently vanish: surface a disabled placeholder chip while the
  // catalog is still loading or when no models are available.
  if (models.length === 0) {
    return (
      <SelectorShell className={className}>
        <PlaceholderChip text={isLoading ? 'Loading…' : 'No models'} />
      </SelectorShell>
    );
  }

  const selectedId = models.some((m) => m.model_id === activeModelId)
    ? activeModelId
    : models[0].model_id;

  const selected = models.find((m) => m.model_id === selectedId) ?? models[0];

  // Preserve catalog order while grouping models under their provider.
  const groups: { provider: string; label: string; models: ChatModelDefinition[] }[] = [];
  for (const model of models) {
    const key = resolveProviderIconKey(model.provider, model.model_id);
    let group = groups.find((g) => g.provider === key);
    if (!group) {
      group = { provider: key, label: providerLabel(model), models: [] };
      groups.push(group);
    }
    group.models.push(model);
  }

  return (
    <SelectorShell className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="chat-model-trigger flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] cursor-pointer transition-all duration-150 min-w-0 max-w-[11rem] outline-none focus-visible:ring-1 focus-visible:ring-[var(--chat-text)]"
          aria-label="Select AI model"
        >
          <ProviderIcon
            provider={selected.provider}
            modelId={selected.model_id}
            className="text-[var(--chat-muted)]"
          />
          <span className="truncate text-[var(--chat-text)]">{selected.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-[var(--chat-faint)]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="chat-model-menu min-w-[13rem] p-1">
          {groups.map((group, groupIndex) => (
            <div key={group.provider}>
              {groupIndex > 0 && <DropdownMenuSeparator className="my-1" />}
              <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1 text-[0.65rem] uppercase tracking-wider text-[var(--chat-faint)]">
                <ProviderIcon
                  provider={group.provider}
                  className="h-3 w-3 text-[var(--chat-faint)]"
                />
                {group.label}
              </DropdownMenuLabel>
              {group.models.map((model) => {
                const isActive = model.model_id === selectedId;
                return (
                  <DropdownMenuItem
                    key={model.model_id}
                    onClick={() => onChange(model.model_id)}
                    className={cn(
                      'chat-model-menu-item flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] cursor-pointer',
                      isActive && 'chat-model-menu-item-active',
                    )}
                  >
                    <ProviderIcon
                      provider={model.provider}
                      modelId={model.model_id}
                      className="text-[var(--chat-muted)]"
                    />
                    <span className="flex-1 truncate">{model.label}</span>
                    {isActive && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--chat-text)]" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SelectorShell>
  );
}
