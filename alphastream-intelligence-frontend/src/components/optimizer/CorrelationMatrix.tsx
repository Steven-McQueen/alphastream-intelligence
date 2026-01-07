import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Grid3X3, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CorrelationMatrixProps {
  stressMode?: boolean;
}

const TICKERS = ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'META', 'V', 'JPM', 'UNH', 'AMZN', 'JNJ'];

// Generate realistic correlation matrices
function generateCorrelationMatrix(stress: boolean): number[][] {
  const n = TICKERS.length;
  const matrix: number[][] = [];
  
  // Base correlations (normal market)
  const baseCorrelations: Record<string, Record<string, number>> = {
    NVDA: { MSFT: 0.65, AAPL: 0.55, GOOGL: 0.60, META: 0.58, V: 0.35, JPM: 0.30, UNH: 0.20, AMZN: 0.55, JNJ: 0.15 },
    MSFT: { AAPL: 0.72, GOOGL: 0.75, META: 0.68, V: 0.45, JPM: 0.38, UNH: 0.28, AMZN: 0.70, JNJ: 0.22 },
    AAPL: { GOOGL: 0.68, META: 0.62, V: 0.42, JPM: 0.35, UNH: 0.25, AMZN: 0.65, JNJ: 0.20 },
    GOOGL: { META: 0.72, V: 0.40, JPM: 0.32, UNH: 0.22, AMZN: 0.68, JNJ: 0.18 },
    META: { V: 0.38, JPM: 0.30, UNH: 0.18, AMZN: 0.62, JNJ: 0.12 },
    V: { JPM: 0.55, UNH: 0.35, AMZN: 0.42, JNJ: 0.30 },
    JPM: { UNH: 0.32, AMZN: 0.35, JNJ: 0.28 },
    UNH: { AMZN: 0.28, JNJ: 0.45 },
    AMZN: { JNJ: 0.18 },
  };

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        const t1 = TICKERS[Math.min(i, j)];
        const t2 = TICKERS[Math.max(i, j)];
        let corr = baseCorrelations[t1]?.[t2] || baseCorrelations[t2]?.[t1] || 0.3;
        
        // In stress mode, correlations increase (flight to correlation)
        if (stress) {
          corr = Math.min(0.95, corr + 0.25 + Math.random() * 0.1);
        } else {
          // Add some noise
          corr += (Math.random() - 0.5) * 0.08;
        }
        
        matrix[i][j] = Math.max(-0.3, Math.min(1, corr));
      }
    }
  }
  
  return matrix;
}

// Color scale for correlation values
function getCorrelationColor(value: number): string {
  if (value >= 0.8) return 'bg-red-500';
  if (value >= 0.6) return 'bg-orange-500';
  if (value >= 0.4) return 'bg-yellow-500';
  if (value >= 0.2) return 'bg-green-500';
  if (value >= 0) return 'bg-emerald-500';
  if (value >= -0.2) return 'bg-cyan-500';
  return 'bg-blue-500';
}

function getCorrelationTextColor(value: number): string {
  if (value >= 0.6 || value < 0) return 'text-white';
  return 'text-black';
}

export function CorrelationMatrix({ stressMode: initialStress = false }: CorrelationMatrixProps) {
  const [showStress, setShowStress] = useState(initialStress);
  
  const matrix = useMemo(() => generateCorrelationMatrix(showStress), [showStress]);
  
  // Calculate average correlation
  const avgCorrelation = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < TICKERS.length; i++) {
      for (let j = i + 1; j < TICKERS.length; j++) {
        sum += matrix[i][j];
        count++;
      }
    }
    return sum / count;
  }, [matrix]);

  // Find highest correlations (excluding diagonal)
  const highCorrelations = useMemo(() => {
    const pairs: { t1: string; t2: string; corr: number }[] = [];
    for (let i = 0; i < TICKERS.length; i++) {
      for (let j = i + 1; j < TICKERS.length; j++) {
        pairs.push({ t1: TICKERS[i], t2: TICKERS[j], corr: matrix[i][j] });
      }
    }
    return pairs.sort((a, b) => b.corr - a.corr).slice(0, 3);
  }, [matrix]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Grid3X3 className="w-4 h-4" />
            Correlation Matrix
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="stress-mode" className="text-xs text-muted-foreground">
                Stress Mode
              </Label>
              <Switch
                id="stress-mode"
                checked={showStress}
                onCheckedChange={setShowStress}
              />
            </div>
            <Badge variant={showStress ? 'destructive' : 'secondary'} className="text-xs">
              {showStress ? 'Crisis' : 'Normal'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Matrix heatmap */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header row */}
            <div className="flex">
              <div className="w-12 h-8 flex-shrink-0" /> {/* Empty corner */}
              {TICKERS.map((ticker) => (
                <div
                  key={`header-${ticker}`}
                  className="w-10 h-8 flex items-center justify-center text-[10px] font-medium text-muted-foreground"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {ticker}
                </div>
              ))}
            </div>
            
            {/* Matrix rows */}
            {TICKERS.map((rowTicker, i) => (
              <div key={`row-${rowTicker}`} className="flex">
                <div className="w-12 h-10 flex items-center justify-start text-[11px] font-medium text-muted-foreground flex-shrink-0">
                  {rowTicker}
                </div>
                {TICKERS.map((colTicker, j) => {
                  const value = matrix[i][j];
                  const isDiagonal = i === j;
                  
                  return (
                    <Tooltip key={`cell-${i}-${j}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={`w-10 h-10 flex items-center justify-center text-[10px] font-mono cursor-pointer transition-transform hover:scale-110 hover:z-10 ${
                            isDiagonal ? 'bg-secondary' : getCorrelationColor(value)
                          } ${isDiagonal ? 'text-muted-foreground' : getCorrelationTextColor(value)}`}
                          style={{ opacity: isDiagonal ? 0.5 : 0.85 + Math.abs(value) * 0.15 }}
                        >
                          {value.toFixed(2)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{rowTicker} × {colTicker}</p>
                        <p className="text-xs text-muted-foreground">
                          Correlation: {value.toFixed(3)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Stats and insights */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Average Correlation</p>
            <p className={`text-lg font-semibold ${avgCorrelation > 0.6 ? 'text-red-500' : avgCorrelation > 0.4 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {avgCorrelation.toFixed(3)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Most Correlated Pairs</p>
            <div className="space-y-0.5">
              {highCorrelations.map(({ t1, t2, corr }) => (
                <p key={`${t1}-${t2}`} className="text-xs">
                  <span className="font-medium">{t1}/{t2}</span>
                  <span className="text-muted-foreground ml-1">({corr.toFixed(2)})</span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Stress warning */}
        {showStress && avgCorrelation > 0.6 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-red-500">Correlation Spike During Stress</p>
              <p className="text-xs text-red-200/80">
                During market stress, correlations increase significantly (avg: {avgCorrelation.toFixed(2)}), 
                reducing diversification benefits when you need them most.
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Correlation Scale</p>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-8">-0.3</span>
            <div className="flex-1 h-3 rounded flex overflow-hidden">
              <div className="flex-1 bg-blue-500" />
              <div className="flex-1 bg-cyan-500" />
              <div className="flex-1 bg-emerald-500" />
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-yellow-500" />
              <div className="flex-1 bg-orange-500" />
              <div className="flex-1 bg-red-500" />
            </div>
            <span className="text-[10px] text-muted-foreground w-6">1.0</span>
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground px-8">
            <span>Negative</span>
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
