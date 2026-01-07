import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingDown, Zap, Building2, Landmark, Globe, BarChart3 } from 'lucide-react';

interface StressScenario {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  historicalAnalog: string;
  marketImpact: number; // S&P 500 impact %
  factors: {
    equity: number;
    rates: number;
    credit: number;
    volatility: number;
  };
}

interface HoldingStressImpact {
  ticker: string;
  name: string;
  weight: number;
  beta: number;
  impact: number;
  contribution: number;
}

const STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 'crash',
    name: 'Market Crash',
    description: 'Sudden 30% equity decline, flight to quality',
    icon: TrendingDown,
    historicalAnalog: 'Mar 2020, Oct 2008',
    marketImpact: -30,
    factors: { equity: -30, rates: -1.5, credit: 3, volatility: 40 },
  },
  {
    id: 'rate_hike',
    name: 'Rate Shock',
    description: '200bp rapid rate increase, growth selloff',
    icon: Landmark,
    historicalAnalog: '2022 Fed Tightening',
    marketImpact: -20,
    factors: { equity: -20, rates: 2, credit: 1.5, volatility: 25 },
  },
  {
    id: 'recession',
    name: 'Recession',
    description: 'Economic contraction, earnings decline',
    icon: Building2,
    historicalAnalog: '2008-2009 GFC',
    marketImpact: -35,
    factors: { equity: -35, rates: -2, credit: 4, volatility: 35 },
  },
  {
    id: 'stagflation',
    name: 'Stagflation',
    description: 'High inflation + slow growth',
    icon: Zap,
    historicalAnalog: '1970s Oil Crisis',
    marketImpact: -25,
    factors: { equity: -25, rates: 1.5, credit: 2, volatility: 30 },
  },
  {
    id: 'geopolitical',
    name: 'Geopolitical Crisis',
    description: 'Major conflict, supply chain disruption',
    icon: Globe,
    historicalAnalog: 'Feb 2022 Ukraine',
    marketImpact: -15,
    factors: { equity: -15, rates: 0.5, credit: 1, volatility: 28 },
  },
  {
    id: 'correction',
    name: '10% Correction',
    description: 'Normal market pullback',
    icon: BarChart3,
    historicalAnalog: 'Avg 1.1x per year',
    marketImpact: -10,
    factors: { equity: -10, rates: -0.25, credit: 0.5, volatility: 18 },
  },
];

// Portfolio holdings for stress calculation
const HOLDINGS = [
  { ticker: 'NVDA', name: 'NVIDIA', weight: 20, beta: 1.8, sector: 'Tech' },
  { ticker: 'MSFT', name: 'Microsoft', weight: 18.5, beta: 1.1, sector: 'Tech' },
  { ticker: 'AAPL', name: 'Apple', weight: 15, beta: 1.2, sector: 'Tech' },
  { ticker: 'GOOGL', name: 'Alphabet', weight: 12, beta: 1.15, sector: 'Tech' },
  { ticker: 'META', name: 'Meta', weight: 8, beta: 1.4, sector: 'Tech' },
  { ticker: 'V', name: 'Visa', weight: 7, beta: 0.95, sector: 'Financials' },
  { ticker: 'JPM', name: 'JPMorgan', weight: 6.5, beta: 1.1, sector: 'Financials' },
  { ticker: 'UNH', name: 'UnitedHealth', weight: 5, beta: 0.85, sector: 'Healthcare' },
  { ticker: 'AMZN', name: 'Amazon', weight: 5, beta: 1.25, sector: 'Consumer' },
  { ticker: 'JNJ', name: 'J&J', weight: 3, beta: 0.65, sector: 'Healthcare' },
];

function calculateStressImpact(scenario: StressScenario): {
  portfolioImpact: number;
  holdingImpacts: HoldingStressImpact[];
  dollarLoss: number;
} {
  const portfolioValue = 712450; // From mock portfolio
  
  const holdingImpacts = HOLDINGS.map(h => {
    // Impact based on beta and scenario factors
    const baseImpact = scenario.factors.equity * h.beta;
    // Add some idiosyncratic noise
    const noise = (Math.random() - 0.5) * 5;
    const impact = baseImpact + noise;
    const contribution = (h.weight / 100) * impact;
    
    return {
      ticker: h.ticker,
      name: h.name,
      weight: h.weight,
      beta: h.beta,
      impact,
      contribution,
    };
  }).sort((a, b) => a.impact - b.impact);
  
  const portfolioImpact = holdingImpacts.reduce((sum, h) => sum + h.contribution, 0);
  const dollarLoss = portfolioValue * (portfolioImpact / 100);
  
  return { portfolioImpact, holdingImpacts, dollarLoss };
}

export function StressTestScenarios() {
  const [selectedScenario, setSelectedScenario] = useState<string>('crash');
  
  const scenario = STRESS_SCENARIOS.find(s => s.id === selectedScenario) || STRESS_SCENARIOS[0];
  const { portfolioImpact, holdingImpacts, dollarLoss } = useMemo(
    () => calculateStressImpact(scenario),
    [scenario]
  );

  const chartData = holdingImpacts.map(h => ({
    ticker: h.ticker,
    impact: h.impact,
    contribution: h.contribution,
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Stress Test Scenarios
          </CardTitle>
          <Badge variant="destructive" className="text-xs">
            Hypothetical
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scenario selector */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {STRESS_SCENARIOS.map((s) => {
            const isSelected = s.id === selectedScenario;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedScenario(s.id)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  isSelected 
                    ? 'border-destructive bg-destructive/10' 
                    : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                <Icon className={`w-4 h-4 mx-auto mb-1 ${isSelected ? 'text-destructive' : 'text-muted-foreground'}`} />
                <p className={`text-[10px] font-medium ${isSelected ? 'text-destructive' : 'text-foreground'}`}>
                  {s.name}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {s.marketImpact}%
                </p>
              </button>
            );
          })}
        </div>

        {/* Scenario details */}
        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2">
                <scenario.icon className="w-4 h-4 text-destructive" />
                {scenario.name}
              </h4>
              <p className="text-xs text-muted-foreground">{scenario.description}</p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {scenario.historicalAnalog}
            </Badge>
          </div>
          
          {/* Factor shocks */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Equity</p>
              <p className="text-sm font-mono text-red-500">{scenario.factors.equity}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Rates</p>
              <p className={`text-sm font-mono ${scenario.factors.rates > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {scenario.factors.rates > 0 ? '+' : ''}{scenario.factors.rates}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Credit Spread</p>
              <p className="text-sm font-mono text-amber-500">+{scenario.factors.credit}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">VIX</p>
              <p className="text-sm font-mono text-red-500">{scenario.factors.volatility}</p>
            </div>
          </div>
        </div>

        {/* Portfolio impact summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-muted-foreground mb-1">Portfolio Impact</p>
            <p className="text-2xl font-bold text-red-500">
              {portfolioImpact.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-muted-foreground mb-1">Estimated Loss</p>
            <p className="text-2xl font-bold text-red-500">
              -${Math.abs(dollarLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/30 border border-border">
            <p className="text-xs text-muted-foreground mb-1">vs Market</p>
            <p className={`text-2xl font-bold ${portfolioImpact < scenario.marketImpact ? 'text-red-500' : 'text-emerald-500'}`}>
              {(portfolioImpact - scenario.marketImpact) > 0 ? '+' : ''}{(portfolioImpact - scenario.marketImpact).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Impact by holding chart */}
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => `${v}%`}
                domain={['dataMin - 5', 0]}
              />
              <YAxis
                type="category"
                dataKey="ticker"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    impact: 'Position Impact',
                    contribution: 'Portfolio Contribution',
                  };
                  return [`${value.toFixed(1)}%`, labels[name] || name];
                }}
              />
              <ReferenceLine x={scenario.marketImpact} stroke="#3b82f6" strokeDasharray="3 3" />
              <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.impact < scenario.marketImpact ? '#ef4444' : '#f97316'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Holding detail table */}
        <div className="space-y-1 max-h-[150px] overflow-y-auto">
          <div className="grid grid-cols-12 gap-2 text-[10px] text-muted-foreground uppercase tracking-wide px-2 sticky top-0 bg-card pb-1">
            <div className="col-span-2">Ticker</div>
            <div className="col-span-2 text-right">Weight</div>
            <div className="col-span-2 text-right">Beta</div>
            <div className="col-span-3 text-right">Impact</div>
            <div className="col-span-3 text-right">Contribution</div>
          </div>
          {holdingImpacts.map((h) => (
            <div key={h.ticker} className="grid grid-cols-12 gap-2 items-center px-2 py-1 rounded hover:bg-secondary/30">
              <div className="col-span-2 font-medium text-sm">{h.ticker}</div>
              <div className="col-span-2 text-right text-sm text-muted-foreground">{h.weight}%</div>
              <div className="col-span-2 text-right text-sm">
                <span className={h.beta > 1.2 ? 'text-amber-500' : 'text-muted-foreground'}>
                  {h.beta.toFixed(2)}
                </span>
              </div>
              <div className="col-span-3 text-right">
                <span className="text-sm font-mono text-red-500">{h.impact.toFixed(1)}%</span>
              </div>
              <div className="col-span-3 text-right">
                <span className="text-sm font-mono text-red-500">{h.contribution.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Risk warning */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-500">High Beta Concentration</p>
            <p className="text-xs text-amber-200/80">
              Portfolio beta of ~1.2 means {Math.abs(portfolioImpact / scenario.marketImpact * 100 - 100).toFixed(0)}% 
              {portfolioImpact < scenario.marketImpact ? ' more' : ' less'} volatile than market. 
              Consider hedging or diversifying into lower-beta assets.
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground italic">
          Stress test results are hypothetical and based on historical factor sensitivities. 
          Actual losses may differ due to correlation changes, liquidity constraints, and other factors.
        </p>
      </CardContent>
    </Card>
  );
}
