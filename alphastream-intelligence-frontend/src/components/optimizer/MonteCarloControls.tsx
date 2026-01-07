import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dices, Play, TrendingUp, Calendar, Target } from 'lucide-react';
import type { MonteCarloParams } from '@/data/mockMonteCarlo';

interface MonteCarloControlsProps {
  params: MonteCarloParams;
  onParamsChange: (params: MonteCarloParams) => void;
  onRunSimulation: () => void;
  isRunning: boolean;
}

export function MonteCarloControls({
  params,
  onParamsChange,
  onRunSimulation,
  isRunning,
}: MonteCarloControlsProps) {
  const updateParam = <K extends keyof MonteCarloParams>(key: K, value: MonteCarloParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Dices className="w-4 h-4" />
            Monte Carlo Simulation
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {params.numSimulations.toLocaleString()} runs
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Time Horizon */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Time Horizon
            </Label>
            <span className="text-sm font-mono font-medium">
              {params.timeHorizonYears} years
            </span>
          </div>
          <Slider
            value={[params.timeHorizonYears]}
            onValueChange={(value) => updateParam('timeHorizonYears', value[0])}
            min={1}
            max={20}
            step={1}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1Y</span>
            <span>5Y</span>
            <span>10Y</span>
            <span>20Y</span>
          </div>
        </div>

        {/* Number of Simulations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm flex items-center gap-2">
              <Dices className="w-3.5 h-3.5 text-muted-foreground" />
              Simulations
            </Label>
            <span className="text-sm font-mono font-medium">
              {params.numSimulations.toLocaleString()}
            </span>
          </div>
          <Slider
            value={[params.numSimulations]}
            onValueChange={(value) => updateParam('numSimulations', value[0])}
            min={100}
            max={10000}
            step={100}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>100</span>
            <span>Fast</span>
            <span>Accurate</span>
            <span>10,000</span>
          </div>
        </div>

        {/* Expected Return Override */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              Expected Return
            </Label>
            <span className="text-sm font-mono font-medium">
              {params.expectedReturn.toFixed(1)}%
            </span>
          </div>
          <Slider
            value={[params.expectedReturn]}
            onValueChange={(value) => updateParam('expectedReturn', value[0])}
            min={0}
            max={25}
            step={0.5}
            className="cursor-pointer"
          />
        </div>

        {/* Target Return */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              Target Return
            </Label>
            <span className="text-sm font-mono font-medium">
              {params.targetReturn.toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[params.targetReturn]}
            onValueChange={(value) => updateParam('targetReturn', value[0])}
            min={0}
            max={100}
            step={5}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Calculate probability of achieving this total return
          </p>
        </div>

        {/* Run button */}
        <Button
          onClick={onRunSimulation}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Dices className="w-4 h-4 mr-2 animate-spin" />
              Running Simulation...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Monte Carlo
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
