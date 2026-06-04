import { cn } from '@/lib/utils';
import { useComposerAgents } from '@/hooks/useComposerAgents';
import { AUTO_AGENT_ID } from '@/config/chatAgents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bot, Check, ChevronDown, Sparkles } from 'lucide-react';

export interface AgentSelectorProps {
  activeAgentId: string;
  onChange: (agentId: string) => void;
  className?: string;
}

/** Composer agent picker: "Auto" (heuristic routing) + each enabled agent. */
export function AgentSelector({ activeAgentId, onChange, className }: AgentSelectorProps) {
  const { agents } = useComposerAgents();

  const selectedLabel =
    activeAgentId === AUTO_AGENT_ID
      ? 'Auto'
      : agents.find((a) => a.slug === activeAgentId)?.name ?? 'Auto';
  const isAuto = activeAgentId === AUTO_AGENT_ID;

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <span className="chat-model-label text-[0.7rem] uppercase tracking-wider shrink-0 text-[var(--chat-faint)]">
        Agent
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="chat-model-trigger flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] cursor-pointer transition-all duration-150 min-w-0 max-w-[11rem] outline-none focus-visible:ring-1 focus-visible:ring-[var(--chat-text)]"
          aria-label="Select agent"
        >
          {isAuto ? (
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--chat-muted)]" />
          ) : (
            <Bot className="h-4 w-4 shrink-0 text-[var(--chat-muted)]" />
          )}
          <span className="truncate text-[var(--chat-text)]">{selectedLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-[var(--chat-faint)]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="chat-model-menu min-w-[13rem] p-1">
          <DropdownMenuItem
            onClick={() => onChange(AUTO_AGENT_ID)}
            className={cn(
              'chat-model-menu-item flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] cursor-pointer',
              isAuto && 'chat-model-menu-item-active',
            )}
          >
            <Sparkles className="h-4 w-4 text-[var(--chat-muted)]" />
            <span className="flex-1 truncate">Auto</span>
            {isAuto && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--chat-text)]" />}
          </DropdownMenuItem>

          {agents.length > 0 && <DropdownMenuSeparator className="my-1" />}
          <DropdownMenuLabel className="px-2 py-1 text-[0.65rem] uppercase tracking-wider text-[var(--chat-faint)]">
            Agents
          </DropdownMenuLabel>
          {agents.map((agent) => {
            const isActive = agent.slug === activeAgentId;
            return (
              <DropdownMenuItem
                key={agent.slug}
                onClick={() => onChange(agent.slug)}
                className={cn(
                  'chat-model-menu-item flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] cursor-pointer',
                  isActive && 'chat-model-menu-item-active',
                )}
              >
                <Bot className="h-4 w-4 text-[var(--chat-muted)]" />
                <span className="flex-1 truncate">{agent.name}</span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--chat-text)]" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
