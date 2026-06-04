import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AgentGraph, type LayoutMode } from '@/components/atlas/AgentGraph';
import {
  fetchAtlasGraph,
  fetchAtlasSchema,
  type AtlasAgentNode,
  type AtlasGraph,
  type AtlasNode,
  type AtlasToolNode,
} from '@/lib/atlasApi';
import { Bot, Crown, Database, Sparkles, Wrench } from 'lucide-react';

/**
 * Atlas — system overview. Functional, dependency-free hierarchical view of
 * the agent registry + a curated database map. A React Flow graph view is a
 * planned visual upgrade (requires @xyflow/react).
 */

function agentNodes(graph?: AtlasGraph): AtlasAgentNode[] {
  return (graph?.nodes.filter((n) => n.type === 'agent') as AtlasAgentNode[]) ?? [];
}
function toolNodes(graph?: AtlasGraph): AtlasToolNode[] {
  return (graph?.nodes.filter((n) => n.type === 'tool') as AtlasToolNode[]) ?? [];
}

function AgentCard({ agent }: { agent: AtlasAgentNode }) {
  const d = agent.data;
  const isSupervisor = d.role === 'supervisor';
  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {isSupervisor ? (
              <Crown className="h-4 w-4 text-primary" />
            ) : (
              <Bot className="h-4 w-4 text-muted-foreground" />
            )}
            {d.name}
            {d.is_default && <Sparkles className="h-3.5 w-3.5 text-primary" />}
          </CardTitle>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[0.65rem]">{d.role}</Badge>
            <Badge variant="secondary" className="text-[0.65rem]">{d.grounding_mode}</Badge>
            {!d.enabled && <Badge variant="destructive" className="text-[0.65rem]">disabled</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-mono text-[0.7rem] text-muted-foreground">{d.slug}</p>
        {d.process_doc && (
          <p className="text-xs text-muted-foreground line-clamp-3">
            {d.process_doc.replace(/[#*`]/g, '')}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {d.tools.length === 0 ? (
            <span className="text-[0.7rem] text-muted-foreground">no tools</span>
          ) : (
            d.tools.map((t) => (
              <Badge key={t} variant="outline" className="text-[0.65rem] font-mono">
                {t}
              </Badge>
            ))
          )}
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          Model: {d.suggested_model_id ?? 'user-selected'}
        </p>
      </CardContent>
    </Card>
  );
}

function NodeDetail({ node }: { node: AtlasNode }) {
  if (node.type === 'tool') {
    return (
      <div className="space-y-2">
        <Badge variant="outline" className="font-mono text-xs">{node.data.name}</Badge>
        <p className="text-sm text-muted-foreground">{node.data.description}</p>
      </div>
    );
  }
  const d = node.data;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-1.5">
        <Badge variant="outline">{d.role}</Badge>
        <Badge variant="secondary">{d.grounding_mode}</Badge>
        {d.is_default && <Badge>default</Badge>}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Persona</p>
        <p className="text-muted-foreground">{d.process_doc?.replace(/[#*`]/g, '') || '—'}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Model</p>
        <p className="text-muted-foreground">{d.suggested_model_id ?? 'user-selected'}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Tools</p>
        <div className="flex flex-wrap gap-1">
          {d.tools.length === 0
            ? <span className="text-muted-foreground text-xs">none</span>
            : d.tools.map((t) => (
                <Badge key={t} variant="outline" className="font-mono text-[0.65rem]">{t}</Badge>
              ))}
        </div>
      </div>
    </div>
  );
}

export default function Atlas() {
  const graphQuery = useQuery({ queryKey: ['atlas-graph'], queryFn: fetchAtlasGraph });
  const schemaQuery = useQuery({ queryKey: ['atlas-schema'], queryFn: fetchAtlasSchema });
  const [view, setView] = useState<'cards' | 'graph'>('cards');
  const [layout, setLayout] = useState<LayoutMode>('hierarchical');
  const [selected, setSelected] = useState<AtlasNode | null>(null);

  const agents = agentNodes(graphQuery.data);
  const supervisors = agents.filter((a) => a.data.role === 'supervisor');
  const specialists = agents.filter((a) => a.data.role !== 'supervisor');
  const tools = toolNodes(graphQuery.data);
  const tables = schemaQuery.data?.tables ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Atlas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A live map of the agent system and the database. Always current — it
          reads the registry, so every agent you add appears here automatically.
        </p>
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents" className="gap-1.5">
            <Bot className="h-4 w-4" /> Agents
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-1.5">
            <Database className="h-4 w-4" /> Database
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as 'cards' | 'graph')}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="cards">Cards</ToggleGroupItem>
              <ToggleGroupItem value="graph">Graph</ToggleGroupItem>
            </ToggleGroup>
            {view === 'graph' && (
              <ToggleGroup
                type="single"
                value={layout}
                onValueChange={(v) => v && setLayout(v as LayoutMode)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="hierarchical">Hierarchy</ToggleGroupItem>
                <ToggleGroupItem value="organic">Organic</ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>

          {graphQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}

          {view === 'graph' && graphQuery.data ? (
            <AgentGraph graph={graphQuery.data} layout={layout} onSelect={setSelected} />
          ) : (
          <div className="space-y-6">

          {supervisors.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
                Orchestration
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {supervisors.map((a) => <AgentCard key={a.id} agent={a} />)}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
              Specialists
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {specialists.map((a) => <AgentCard key={a.id} agent={a} />)}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Tools
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((t) => (
                <div key={t.id} className="rounded-md border border-border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{t.data.name}</span>
                    {!t.data.used && (
                      <Badge variant="outline" className="text-[0.6rem]">unused</Badge>
                    )}
                  </div>
                  <p className="text-[0.7rem] text-muted-foreground mt-1 line-clamp-2">
                    {t.data.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
          </div>
          )}
        </TabsContent>

        <TabsContent value="database" className="space-y-3">
          {schemaQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {tables.map((tbl) => (
              <Card key={tbl.table} className="bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-mono text-sm">{tbl.table}</CardTitle>
                  <p className="text-xs text-muted-foreground">{tbl.purpose}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {tbl.key_columns.map((c) => (
                      <Badge key={c} variant="outline" className="text-[0.65rem] font-mono">
                        {c}
                      </Badge>
                    ))}
                  </div>
                  {tbl.relationships.length > 0 && (
                    <ul className="text-[0.7rem] text-muted-foreground space-y-0.5">
                      {tbl.relationships.map((r) => <li key={r}>↳ {r}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.type === 'agent' ? selected.data.name : selected.data.name}
                </SheetTitle>
                <SheetDescription>
                  {selected.type === 'agent' ? 'Agent profile' : 'Tool'}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <NodeDetail node={selected} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
