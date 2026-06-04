import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Check, Plus, Star, Trash2 } from 'lucide-react';
import {
  fetchAgentConfig,
  fetchAvailableTools,
  saveAgentConfig,
  type AgentConfig,
  type AgentToolInfo,
} from '@/lib/agentConfigApi';

const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

function blankAgent(): AgentConfig {
  const suffix = Date.now().toString(36).slice(-4);
  return {
    slug: `new_agent_${suffix}`,
    name: 'New Agent',
    persona: 'You are a specialist agent in the AlphaStream terminal.',
    role: 'specialist',
    grounding_mode: 'inject',
    suggested_model_id: null,
    context_sources: [],
    tools: [],
    process_doc: '',
    enabled: false,
    visible: false,
    is_default: false,
    sort_order: 50,
  };
}

export function AgentsSettings() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [tools, setTools] = useState<AgentToolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cfg, toolList] = await Promise.all([
        fetchAgentConfig(),
        fetchAvailableTools(),
      ]);
      setAgents(cfg);
      setTools(toolList);
    } catch (e) {
      toast.error('Could not load agents — check login and that the backend is running');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (idx: number, patch: Partial<AgentConfig>) =>
    setAgents((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const toggleTool = (idx: number, name: string) =>
    setAgents((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const has = a.tools.includes(name);
        return { ...a, tools: has ? a.tools.filter((t) => t !== name) : [...a.tools, name] };
      }),
    );

  const setDefault = (idx: number) =>
    setAgents((prev) => prev.map((a, i) => ({ ...a, is_default: i === idx })));

  const addAgent = () => setAgents((prev) => [...prev, blankAgent()]);
  const removeAgent = (idx: number) =>
    setAgents((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    // Client-side validation mirrors the backend.
    const slugs = new Set<string>();
    for (const a of agents) {
      if (!SLUG_RE.test(a.slug)) {
        toast.error(`Invalid slug "${a.slug}" — lowercase, digits, _ and - only`);
        return;
      }
      if (slugs.has(a.slug)) {
        toast.error(`Duplicate slug: ${a.slug}`);
        return;
      }
      slugs.add(a.slug);
      if (!a.name.trim() || !a.persona.trim()) {
        toast.error(`Name and persona are required (${a.slug})`);
        return;
      }
    }
    const defaults = agents.filter((a) => a.is_default && a.enabled && a.visible);
    if (defaults.length !== 1) {
      toast.error('Exactly one enabled + visible agent must be the default');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveAgentConfig(agents);
      setAgents(saved);
      toast.success('Agents saved');
    } catch (e) {
      toast.error('Save failed — check login and validation');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading agents…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {agents.length} agent{agents.length === 1 ? '' : 's'}. The selected chat model is
          always used — an agent's model is only a suggestion.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addAgent}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add agent
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {agents.map((agent, idx) => (
          <AccordionItem
            key={agent.slug + idx}
            value={agent.slug + idx}
            className="border border-border rounded-lg px-3"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2 text-sm">
                {agent.name}
                <span className="font-mono text-[0.65rem] text-muted-foreground">
                  {agent.slug}
                </span>
                {agent.is_default && <Star className="h-3.5 w-3.5 fill-current text-primary" />}
                {!agent.enabled && (
                  <span className="text-[0.65rem] text-muted-foreground">(disabled)</span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={agent.name}
                    onChange={(e) => update(idx, { name: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Slug</Label>
                  <Input
                    value={agent.slug}
                    onChange={(e) => update(idx, { slug: e.target.value.toLowerCase() })}
                    className="h-8 font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Select
                    value={agent.role}
                    onValueChange={(v) => update(idx, { role: v as AgentConfig['role'] })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="specialist">specialist</SelectItem>
                      <SelectItem value="supervisor">supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grounding mode</Label>
                  <Select
                    value={agent.grounding_mode}
                    onValueChange={(v) =>
                      update(idx, { grounding_mode: v as AgentConfig['grounding_mode'] })
                    }
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inject">inject (1 call, pre-fetched)</SelectItem>
                      <SelectItem value="tools">tools (agent fetches)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Persona (system prompt)</Label>
                <Textarea
                  value={agent.persona}
                  onChange={(e) => update(idx, { persona: e.target.value })}
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Process notes (shown in Atlas)</Label>
                <Textarea
                  value={agent.process_doc}
                  onChange={(e) => update(idx, { process_doc: e.target.value })}
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tools</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tools.map((t) => {
                    const on = agent.tools.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        title={t.description}
                        onClick={() => toggleTool(idx, t.name)}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[0.65rem] font-mono transition-colors',
                          on
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                {agent.grounding_mode === 'tools' && agent.tools.length === 0 && (
                  <p className="text-[0.65rem] text-amber-600">
                    Tools mode with no tools falls back to a single inject call.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={agent.enabled}
                    onCheckedChange={(c) =>
                      update(idx, { enabled: c, ...(c ? {} : { visible: false }) })
                    }
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={agent.visible}
                    disabled={!agent.enabled}
                    onCheckedChange={(c) => update(idx, { visible: c })}
                  />
                  Visible in composer
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!agent.enabled || !agent.visible}
                  onClick={() => setDefault(idx)}
                  className={cn('h-7', agent.is_default && 'text-primary')}
                >
                  <Star className={cn('h-3.5 w-3.5 mr-1', agent.is_default && 'fill-current')} />
                  Default
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAgent(idx)}
                  className="h-7 ml-auto text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isSaving}>
          <Check className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving…' : 'Save agents'}
        </Button>
        <Button type="button" variant="outline" onClick={load} disabled={isSaving}>
          Reload
        </Button>
      </div>
    </div>
  );
}
