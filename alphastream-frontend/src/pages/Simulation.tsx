import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitCompare, GitBranch, Beaker } from 'lucide-react';
import { ShadowPortfolioComparison } from '@/components/simulation/ShadowPortfolioComparison';
import { DivergenceTracking } from '@/components/simulation/DivergenceTracking';
import { WhatIfAnalysis } from '@/components/simulation/WhatIfAnalysis';

export default function Simulation() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulation</h1>
        <p className="text-sm text-muted-foreground">
          Compare shadow portfolios, track divergence, and analyze what-if scenarios
        </p>
      </div>

      <Tabs defaultValue="shadow" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="shadow" className="gap-2">
            <GitCompare className="w-4 h-4" />
            Shadow Portfolios
          </TabsTrigger>
          <TabsTrigger value="divergence" className="gap-2">
            <GitBranch className="w-4 h-4" />
            Divergence Tracking
          </TabsTrigger>
          <TabsTrigger value="whatif" className="gap-2">
            <Beaker className="w-4 h-4" />
            What-If Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shadow" className="space-y-6">
          <ShadowPortfolioComparison />
        </TabsContent>

        <TabsContent value="divergence" className="space-y-6">
          <DivergenceTracking />
        </TabsContent>

        <TabsContent value="whatif" className="space-y-6">
          <WhatIfAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
}
