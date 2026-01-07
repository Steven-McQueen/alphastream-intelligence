import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings2, X } from 'lucide-react';
import type { OptimizationConstraints } from '@/data/mockOptimizer';

interface ConstraintControlsProps {
  constraints: OptimizationConstraints;
  onConstraintsChange: (constraints: OptimizationConstraints) => void;
}

const AVAILABLE_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'JPM', 'V', 'UNH', 'JNJ'];

export function ConstraintControls({ constraints, onConstraintsChange }: ConstraintControlsProps) {
  const [longOnly, setLongOnly] = useState(true);
  const [sectorNeutral, setSectorNeutral] = useState(false);

  const updateConstraint = <K extends keyof OptimizationConstraints>(
    key: K,
    value: OptimizationConstraints[K]
  ) => {
    onConstraintsChange({ ...constraints, [key]: value });
  };

  const toggleExcludeTicker = (ticker: string) => {
    const excluded = constraints.excludeTickers.includes(ticker)
      ? constraints.excludeTickers.filter((t) => t !== ticker)
      : [...constraints.excludeTickers, ticker];
    updateConstraint('excludeTickers', excluded);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Optimization Constraints
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Position Size Limits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Max Position Size</Label>
            <span className="text-sm font-mono font-medium">
              {constraints.maxPositionSize}%
            </span>
          </div>
          <Slider
            value={[constraints.maxPositionSize]}
            onValueChange={(value) => updateConstraint('maxPositionSize', value[0])}
            min={5}
            max={50}
            step={1}
            className="cursor-pointer"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Min Position Size</Label>
            <span className="text-sm font-mono font-medium">
              {constraints.minPositionSize}%
            </span>
          </div>
          <Slider
            value={[constraints.minPositionSize]}
            onValueChange={(value) => updateConstraint('minPositionSize', value[0])}
            min={0}
            max={10}
            step={0.5}
            className="cursor-pointer"
          />
        </div>

        {/* Sector Weight */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Max Sector Weight</Label>
            <span className="text-sm font-mono font-medium">
              {constraints.maxSectorWeight}%
            </span>
          </div>
          <Slider
            value={[constraints.maxSectorWeight]}
            onValueChange={(value) => updateConstraint('maxSectorWeight', value[0])}
            min={15}
            max={60}
            step={1}
            className="cursor-pointer"
          />
        </div>

        {/* Turnover Limit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Max Turnover</Label>
            <span className="text-sm font-mono font-medium">
              {constraints.turnoverLimit}%
            </span>
          </div>
          <Slider
            value={[constraints.turnoverLimit]}
            onValueChange={(value) => updateConstraint('turnoverLimit', value[0])}
            min={5}
            max={100}
            step={5}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Limits total portfolio rebalancing per optimization
          </p>
        </div>

        {/* Toggle constraints */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Long Only</Label>
            <Switch checked={longOnly} onCheckedChange={setLongOnly} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Sector Neutral</Label>
            <Switch checked={sectorNeutral} onCheckedChange={setSectorNeutral} />
          </div>
        </div>

        {/* Exclude tickers */}
        <div className="space-y-3 pt-3 border-t border-border">
          <Label className="text-sm">Exclude from Optimization</Label>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_TICKERS.map((ticker) => {
              const isExcluded = constraints.excludeTickers.includes(ticker);
              return (
                <Badge
                  key={ticker}
                  variant={isExcluded ? 'destructive' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleExcludeTicker(ticker)}
                >
                  {ticker}
                  {isExcluded && <X className="w-3 h-3 ml-1" />}
                </Badge>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Click to exclude/include assets from optimization
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
