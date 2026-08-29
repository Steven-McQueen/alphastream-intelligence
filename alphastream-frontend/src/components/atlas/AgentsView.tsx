import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AgentMapView } from '@/components/atlas/AgentMapView';
import { AgentsSettings } from '@/components/settings/AgentsSettings';

/**
 * Intelligence → Agents tab: the agent system map plus in-place agent
 * customization (create/edit profiles, tools, grounding mode).
 */
export function AgentsView() {
  const [section, setSection] = useState<'map' | 'manage'>('map');

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Your agents, how they're wired, and how to customize them. Each runs
            on the model you pick in chat.
          </p>
          <ToggleGroup
            type="single"
            value={section}
            onValueChange={(v) => v && setSection(v as 'map' | 'manage')}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="map">Map</ToggleGroupItem>
            <ToggleGroupItem value="manage">Customize</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {section === 'map' ? <AgentMapView /> : <AgentsSettings />}
      </div>
    </div>
  );
}
