import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  Beaker,
  Plus,
  Minus,
  RefreshCw,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Zap,
} from 'lucide-react';
import {
  WhatIfScenario,
  generateWhatIfScenarios,
  calculateScenarioImpact,
  ScenarioImpact,
} from '@/data/mockSimulation';

const CHANGE_TYPE_ICONS = {
  add: Plus,
  remove: Minus,
  rebalance: RefreshCw,
  substitute: ArrowRightLeft,
};

const CHANGE_TYPE_COLORS = {
  add: 'text-green-500 bg-green-500/10',
  remove: 'text-red-500 bg-red-500/10',
  rebalance: 'text-blue-500 bg-blue-500/10',
  substitute: 'text-purple-500 bg-purple-500/10',
};

export function WhatIfAnalysis() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const scenarios = useMemo(() => generateWhatIfScenarios(), []);

  const selectedScenarioData = scenarios.find((s) => s.id === selectedScenario);
  const impactData = selectedScenarioData
    ? calculateScenarioImpact(selectedScenarioData)
    : null;

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (!selectedScenarioData) return [];
    
    return [
      { metric: 'Return', baseline: 70, scenario: (selectedScenarioData.projectedReturn / 20) * 100 },
      { metric: 'Risk-Adj', baseline: 65, scenario: ((selectedScenarioData.projectedReturn / selectedScenarioData.projectedRisk) / 1.5) * 100 },
      { metric: 'Volatility', baseline: 60, scenario: 100 - (selectedScenarioData.projectedRisk / 25) * 100 },
      { metric: 'Diversification', baseline: 75, scenario: 70 + Math.random() * 20 },
      { metric: 'Liquidity', baseline: 80, scenario: 75 + Math.random() * 15 },
    ];
  }, [selectedScenarioData]);

  // Prepare impact comparison chart data
  const impactChartData = useMemo(() => {
    return scenarios.map((s) => ({
      name: s.name.split(' ').slice(0, 2).join(' '),
      impact: s.impactVsBaseline,
      fullName: s.name,
    }));
  }, [scenarios]);

  return (
    <div className="space-y-6">
      {/* Scenario Cards */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Beaker className="w-4 h-4" />
              What-If Scenarios
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Create Scenario
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((scenario) => (
              <Card
                key={scenario.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  selectedScenario === scenario.id
                    ? 'border-primary bg-primary/5'
                    : 'bg-muted/30'
                }`}
                onClick={() => setSelectedScenario(scenario.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{scenario.name}</h4>
                    <Badge
                      variant={scenario.impactVsBaseline >= 0 ? 'default' : 'secondary'}
                      className={`text-xs ${
                        scenario.impactVsBaseline >= 0
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {scenario.impactVsBaseline >= 0 ? '+' : ''}
                      {scenario.impactVsBaseline.toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {scenario.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {scenario.changes.map((change, idx) => {
                      const Icon = CHANGE_TYPE_ICONS[change.type];
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                            CHANGE_TYPE_COLORS[change.type]
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {change.ticker}
                          {change.newTicker && ` → ${change.newTicker}`}
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Impact Comparison Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Scenario Impact Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impactChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(val) => `${val}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
                    props.payload.fullName,
                  ]}
                />
                <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                  {impactChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.impact >= 0 ? 'hsl(142.1 76.2% 36.3%)' : 'hsl(0 72.2% 50.6%)'}
                      opacity={selectedScenario === scenarios[index]?.id ? 1 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      {selectedScenarioData && impactData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Impact Metrics */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Impact Analysis: {selectedScenarioData.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Baseline</TableHead>
                    <TableHead className="text-right">Scenario</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {impactData.map((row) => (
                    <TableRow key={row.metric}>
                      <TableCell className="font-medium">{row.metric}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.metric === 'Sharpe Ratio'
                          ? row.baseline.toFixed(2)
                          : `${row.baseline.toFixed(1)}%`}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.metric === 'Sharpe Ratio'
                          ? row.scenario.toFixed(2)
                          : `${row.scenario.toFixed(1)}%`}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          row.change >= 0 &&
                          (row.metric === 'Expected Return' || row.metric === 'Sharpe Ratio')
                            ? 'text-green-500'
                            : row.change <= 0 &&
                              (row.metric === 'Volatility' || row.metric === 'Max Drawdown')
                            ? 'text-green-500'
                            : 'text-red-500'
                        }`}
                      >
                        {row.change >= 0 ? '+' : ''}
                        {row.metric === 'Sharpe Ratio'
                          ? row.change.toFixed(2)
                          : `${row.change.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Recommendation */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  {selectedScenarioData.impactVsBaseline >= 0 ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-green-500">
                        Recommended
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-500">
                        Caution Advised
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedScenarioData.impactVsBaseline >= 0
                    ? 'This scenario improves risk-adjusted returns. Consider implementing these changes.'
                    : 'This scenario may reduce overall performance. Review trade-offs carefully before proceeding.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Radar Comparison */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Portfolio Profile Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    />
                    <Radar
                      name="Baseline"
                      dataKey="baseline"
                      stroke="hsl(var(--muted-foreground))"
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.2}
                    />
                    <Radar
                      name="Scenario"
                      dataKey="scenario"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Changes Summary */}
      {selectedScenarioData && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Proposed Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedScenarioData.changes.map((change, idx) => {
                const Icon = CHANGE_TYPE_ICONS[change.type];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${CHANGE_TYPE_COLORS[change.type]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{change.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {change.type === 'substitute'
                            ? `Replace ${change.ticker} with ${change.newTicker}`
                            : change.type === 'add'
                            ? `Add ${change.targetWeight}% ${change.ticker}`
                            : change.type === 'remove'
                            ? `Remove ${change.ticker} position`
                            : `Adjust ${change.ticker} by ${change.targetWeight}%`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {change.ticker}
                      {change.newTicker && ` → ${change.newTicker}`}
                    </Badge>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-3">
              <Button className="flex-1">Apply Scenario</Button>
              <Button variant="outline" className="flex-1">
                Save as Shadow Portfolio
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
