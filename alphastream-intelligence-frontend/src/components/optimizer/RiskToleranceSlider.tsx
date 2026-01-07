import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Shield } from 'lucide-react';

interface RiskToleranceSliderProps {
  targetVolatility: number;
  onTargetVolatilityChange: (value: number) => void;
  targetReturn: number;
  onTargetReturnChange: (value: number) => void;
}

export function RiskToleranceSlider({
  targetVolatility,
  onTargetVolatilityChange,
  targetReturn,
  onTargetReturnChange,
}: RiskToleranceSliderProps) {
  const getRiskLevel = (vol: number): { label: string; color: string } => {
    if (vol < 12) return { label: 'Conservative', color: 'bg-blue-500' };
    if (vol < 18) return { label: 'Moderate', color: 'bg-amber-500' };
    if (vol < 25) return { label: 'Aggressive', color: 'bg-orange-500' };
    return { label: 'Very Aggressive', color: 'bg-red-500' };
  };

  const riskLevel = getRiskLevel(targetVolatility);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Target className="w-4 h-4" />
            Risk Tolerance
          </CardTitle>
          <Badge variant="secondary" className={`${riskLevel.color} text-white`}>
            {riskLevel.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Volatility */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              Target Volatility
            </Label>
            <span className="text-sm font-mono font-medium">
              {targetVolatility.toFixed(1)}%
            </span>
          </div>
          <Slider
            value={[targetVolatility]}
            onValueChange={(value) => onTargetVolatilityChange(value[0])}
            min={8}
            max={32}
            step={0.5}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>8%</span>
            <span>Low Risk</span>
            <span>High Risk</span>
            <span>32%</span>
          </div>
        </div>

        {/* Target Return */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              Minimum Return Target
            </Label>
            <span className="text-sm font-mono font-medium">
              {targetReturn.toFixed(1)}%
            </span>
          </div>
          <Slider
            value={[targetReturn]}
            onValueChange={(value) => onTargetReturnChange(value[0])}
            min={4}
            max={25}
            step={0.5}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>4%</span>
            <span>Risk-Free</span>
            <span>Aggressive</span>
            <span>25%</span>
          </div>
        </div>

        {/* Quick presets */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Quick Presets</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onTargetVolatilityChange(10); onTargetReturnChange(6); }}
              className="flex-1 px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Conservative
            </button>
            <button
              onClick={() => { onTargetVolatilityChange(16); onTargetReturnChange(10); }}
              className="flex-1 px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Balanced
            </button>
            <button
              onClick={() => { onTargetVolatilityChange(22); onTargetReturnChange(15); }}
              className="flex-1 px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Growth
            </button>
            <button
              onClick={() => { onTargetVolatilityChange(28); onTargetReturnChange(20); }}
              className="flex-1 px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Aggressive
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
