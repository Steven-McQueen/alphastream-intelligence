import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Layers, TrendingUp, TrendingDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const SECTORS = [
  { id: 'tech', name: 'Technology', short: 'Tech' },
  { id: 'healthcare', name: 'Healthcare', short: 'Health' },
  { id: 'financials', name: 'Financials', short: 'Fin' },
  { id: 'consumer', name: 'Consumer Disc.', short: 'Cons' },
  { id: 'comm', name: 'Communication', short: 'Comm' },
  { id: 'industrials', name: 'Industrials', short: 'Ind' },
  { id: 'energy', name: 'Energy', short: 'Engy' },
  { id: 'utilities', name: 'Utilities', short: 'Util' },
];

interface SectorCorrelation {
  sector1: string;
  sector2: string;
  normalCorr: number;
  stressCorr: number;
}

// Generate sector correlation data
function generateSectorCorrelations(): SectorCorrelation[] {
  const correlations: SectorCorrelation[] = [];
  
  // Base correlations between sectors (realistic values)
  const baseCorrs: Record<string, Record<string, number>> = {
    tech: { healthcare: 0.45, financials: 0.52, consumer: 0.65, comm: 0.72, industrials: 0.55, energy: 0.25, utilities: 0.15 },
    healthcare: { financials: 0.38, consumer: 0.42, comm: 0.48, industrials: 0.40, energy: 0.20, utilities: 0.35 },
    financials: { consumer: 0.55, comm: 0.48, industrials: 0.58, energy: 0.45, utilities: 0.32 },
    consumer: { comm: 0.58, industrials: 0.52, energy: 0.35, utilities: 0.22 },
    comm: { industrials: 0.48, energy: 0.28, utilities: 0.18 },
    industrials: { energy: 0.52, utilities: 0.38 },
    energy: { utilities: 0.42 },
  };

  for (let i = 0; i < SECTORS.length; i++) {
    for (let j = i; j < SECTORS.length; j++) {
      const s1 = SECTORS[i].id;
      const s2 = SECTORS[j].id;
      
      let normalCorr: number;
      if (i === j) {
        // Intra-sector correlation (stocks within same sector)
        normalCorr = 0.65 + Math.random() * 0.2; // 0.65-0.85
      } else {
        normalCorr = baseCorrs[s1]?.[s2] || baseCorrs[s2]?.[s1] || 0.4;
        normalCorr += (Math.random() - 0.5) * 0.1;
      }
      
      // Stress correlations are higher
      const stressCorr = Math.min(0.98, normalCorr + 0.2 + Math.random() * 0.15);
      
      correlations.push({
        sector1: s1,
        sector2: s2,
        normalCorr: Math.max(0, Math.min(1, normalCorr)),
        stressCorr: Math.max(0, Math.min(1, stressCorr)),
      });
    }
  }
  
  return correlations;
}

function getCorrelationColor(value: number): string {
  if (value >= 0.8) return 'bg-red-500';
  if (value >= 0.65) return 'bg-orange-500';
  if (value >= 0.5) return 'bg-yellow-500';
  if (value >= 0.35) return 'bg-green-500';
  return 'bg-emerald-500';
}

function getCorrelationBgClass(value: number): string {
  if (value >= 0.8) return 'bg-red-500/80';
  if (value >= 0.65) return 'bg-orange-500/80';
  if (value >= 0.5) return 'bg-yellow-500/80';
  if (value >= 0.35) return 'bg-green-500/80';
  return 'bg-emerald-500/80';
}

export function SectorCorrelation() {
  const [showStress, setShowStress] = useState(false);
  const correlations = useMemo(() => generateSectorCorrelations(), []);
  
  // Build matrix lookup
  const getCorr = (s1: string, s2: string) => {
    const found = correlations.find(
      c => (c.sector1 === s1 && c.sector2 === s2) || (c.sector1 === s2 && c.sector2 === s1)
    );
    return found ? (showStress ? found.stressCorr : found.normalCorr) : 0;
  };

  // Calculate stats
  const intraSectorCorrs = correlations.filter(c => c.sector1 === c.sector2);
  const interSectorCorrs = correlations.filter(c => c.sector1 !== c.sector2);
  
  const avgIntra = intraSectorCorrs.reduce((sum, c) => sum + (showStress ? c.stressCorr : c.normalCorr), 0) / intraSectorCorrs.length;
  const avgInter = interSectorCorrs.reduce((sum, c) => sum + (showStress ? c.stressCorr : c.normalCorr), 0) / interSectorCorrs.length;
  
  // Find highest and lowest inter-sector correlations
  const sortedInter = [...interSectorCorrs].sort((a, b) => 
    (showStress ? b.stressCorr : b.normalCorr) - (showStress ? a.stressCorr : a.normalCorr)
  );
  const highestInter = sortedInter.slice(0, 3);
  const lowestInter = sortedInter.slice(-3).reverse();

  const getSectorName = (id: string) => SECTORS.find(s => s.id === id)?.short || id;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Sector Correlations
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="sector-stress" className="text-xs text-muted-foreground">
                Stress
              </Label>
              <Switch
                id="sector-stress"
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
        {/* Sector matrix */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header */}
            <div className="flex">
              <div className="w-14 h-7 flex-shrink-0" />
              {SECTORS.map((sector) => (
                <div
                  key={`header-${sector.id}`}
                  className="w-11 h-7 flex items-center justify-center text-[9px] font-medium text-muted-foreground"
                >
                  {sector.short}
                </div>
              ))}
            </div>
            
            {/* Rows */}
            {SECTORS.map((rowSector, i) => (
              <div key={`row-${rowSector.id}`} className="flex">
                <div className="w-14 h-11 flex items-center text-[10px] font-medium text-muted-foreground flex-shrink-0">
                  {rowSector.short}
                </div>
                {SECTORS.map((colSector, j) => {
                  const value = getCorr(rowSector.id, colSector.id);
                  const isIntra = i === j;
                  
                  return (
                    <Tooltip key={`cell-${i}-${j}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={`w-11 h-11 flex items-center justify-center text-[10px] font-mono cursor-pointer transition-all hover:scale-105 hover:z-10 rounded-sm m-0.5 ${
                            isIntra ? 'ring-1 ring-primary/50' : ''
                          } ${getCorrelationBgClass(value)} ${value >= 0.5 ? 'text-white' : 'text-black'}`}
                        >
                          {value.toFixed(2)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{rowSector.name} × {colSector.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isIntra ? 'Intra-sector' : 'Inter-sector'}: {value.toFixed(3)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Intra vs Inter comparison */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Avg Intra-Sector</span>
              <Badge variant="outline" className="text-[10px]">Within sector</Badge>
            </div>
            <p className={`text-xl font-semibold ${avgIntra > 0.75 ? 'text-amber-500' : 'text-foreground'}`}>
              {avgIntra.toFixed(3)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Stocks in the same sector move together
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Avg Inter-Sector</span>
              <Badge variant="outline" className="text-[10px]">Across sectors</Badge>
            </div>
            <p className={`text-xl font-semibold ${avgInter > 0.6 ? 'text-red-500' : avgInter < 0.4 ? 'text-emerald-500' : 'text-foreground'}`}>
              {avgInter.toFixed(3)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {avgInter < 0.4 ? 'Good diversification potential' : avgInter > 0.6 ? 'Limited diversification' : 'Moderate diversification'}
            </p>
          </div>
        </div>

        {/* Highest and lowest correlations */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3 h-3 text-red-500" />
              <span className="text-xs font-medium">Highest Correlations</span>
            </div>
            <div className="space-y-1">
              {highestInter.map((c) => (
                <div key={`${c.sector1}-${c.sector2}`} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {getSectorName(c.sector1)}/{getSectorName(c.sector2)}
                  </span>
                  <span className="font-mono text-red-500">
                    {(showStress ? c.stressCorr : c.normalCorr).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="w-3 h-3 text-emerald-500" />
              <span className="text-xs font-medium">Lowest Correlations</span>
            </div>
            <div className="space-y-1">
              {lowestInter.map((c) => (
                <div key={`${c.sector1}-${c.sector2}`} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {getSectorName(c.sector1)}/{getSectorName(c.sector2)}
                  </span>
                  <span className="font-mono text-emerald-500">
                    {(showStress ? c.stressCorr : c.normalCorr).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Diversification benefit */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Diversification Benefit</span>
            <Badge 
              variant={avgIntra - avgInter > 0.3 ? 'default' : 'secondary'} 
              className="text-[10px]"
            >
              {avgIntra - avgInter > 0.3 ? 'Strong' : avgIntra - avgInter > 0.15 ? 'Moderate' : 'Weak'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all"
                style={{ width: `${Math.min(100, (avgIntra - avgInter) * 200)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground w-12 text-right">
              {((avgIntra - avgInter) * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Gap between intra-sector and inter-sector correlations indicates diversification potential
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
