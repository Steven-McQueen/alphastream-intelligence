import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { GitCompare, Plus, Eye, Trash2, Pencil } from 'lucide-react';
import {
  ShadowPortfolio,
  generateShadowPortfolios,
  generatePerformanceComparison,
} from '@/data/mockSimulation';
import { ShadowPortfolioBuilder } from './ShadowPortfolioBuilder';
import { toast } from 'sonner';

export function ShadowPortfolioComparison() {
  const [selectedShadow, setSelectedShadow] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<ShadowPortfolio | null>(null);
  const [shadowPortfolios, setShadowPortfolios] = useState<ShadowPortfolio[]>(() =>
    generateShadowPortfolios()
  );
  const performanceData = useMemo(() => generatePerformanceComparison(12), []);

  const selectedPortfolio = shadowPortfolios.find((p) => p.id === selectedShadow);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (performanceData.length < 2) return null;
    const first = performanceData[0];
    const last = performanceData[performanceData.length - 1];

    return {
      portfolioReturn:
        ((last.portfolioValue - first.portfolioValue) / first.portfolioValue) * 100,
      shadowReturn:
        ((last.shadowValue - first.shadowValue) / first.shadowValue) * 100,
      benchmarkReturn:
        ((last.benchmarkValue - first.benchmarkValue) / first.benchmarkValue) * 100,
    };
  }, [performanceData]);

  // Add or update shadow portfolio
  const handleSavePortfolio = (portfolio: ShadowPortfolio) => {
    setShadowPortfolios((prev) => {
      const existingIndex = prev.findIndex((p) => p.id === portfolio.id);
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev];
        updated[existingIndex] = portfolio;
        return updated;
      }
      // Add new
      return [...prev, portfolio];
    });
    setSelectedShadow(portfolio.id);
    setEditingPortfolio(null);
  };

  // Delete shadow portfolio
  const handleDeletePortfolio = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShadowPortfolios((prev) => prev.filter((p) => p.id !== id));
    if (selectedShadow === id) {
      setSelectedShadow(null);
    }
    toast.success('Shadow portfolio deleted');
  };

  // Edit shadow portfolio
  const handleEditPortfolio = (portfolio: ShadowPortfolio, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPortfolio(portfolio);
    setIsBuilderOpen(true);
  };

  // Handle builder close
  const handleBuilderClose = (open: boolean) => {
    setIsBuilderOpen(open);
    if (!open) {
      setEditingPortfolio(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Shadow Portfolio Builder */}
      <ShadowPortfolioBuilder
        open={isBuilderOpen}
        onOpenChange={handleBuilderClose}
        onSave={handleSavePortfolio}
        editingPortfolio={editingPortfolio}
      />

      {/* Shadow Portfolio List */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Shadow Portfolios
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsBuilderOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Shadow
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shadowPortfolios.map((portfolio) => (
              <Card
                key={portfolio.id}
                className={`cursor-pointer transition-all hover:border-primary/50 relative group ${
                  selectedShadow === portfolio.id
                    ? 'border-primary bg-primary/5'
                    : 'bg-muted/30'
                }`}
                onClick={() => setSelectedShadow(portfolio.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{portfolio.name}</h4>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {portfolio.holdings.length} holdings
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                        onClick={(e) => handleEditPortfolio(portfolio, e)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeletePortfolio(portfolio.id, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {portfolio.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Created {portfolio.createdAt.toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Comparison Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={performanceData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(val) =>
                    new Date(val).toLocaleDateString('en-US', { month: 'short' })
                  }
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="portfolioValue"
                  name="Your Portfolio"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="shadowValue"
                  name="Shadow Portfolio"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="benchmarkValue"
                  name="S&P 500"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  dot={false}
                  opacity={0.6}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Stats */}
          {summaryStats && (
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Your Portfolio</p>
                <p
                  className={`text-lg font-mono font-semibold ${
                    summaryStats.portfolioReturn >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {summaryStats.portfolioReturn >= 0 ? '+' : ''}
                  {summaryStats.portfolioReturn.toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Shadow Portfolio</p>
                <p
                  className={`text-lg font-mono font-semibold ${
                    summaryStats.shadowReturn >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {summaryStats.shadowReturn >= 0 ? '+' : ''}
                  {summaryStats.shadowReturn.toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">S&P 500</p>
                <p
                  className={`text-lg font-mono font-semibold ${
                    summaryStats.benchmarkReturn >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {summaryStats.benchmarkReturn >= 0 ? '+' : ''}
                  {summaryStats.benchmarkReturn.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Shadow Details */}
      {selectedPortfolio && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {selectedPortfolio.name} Holdings
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={(e) => handleEditPortfolio(selectedPortfolio, e)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Badge variant="outline">
                  {selectedPortfolio.holdings.reduce((sum, h) => sum + h.weight, 0)}%
                  allocated
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPortfolio.holdings.map((holding) => {
                  const returnPct =
                    ((holding.currentPrice - holding.avgCost) / holding.avgCost) * 100;
                  return (
                    <TableRow key={holding.ticker}>
                      <TableCell className="font-mono font-medium">
                        {holding.ticker}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {holding.name}
                      </TableCell>
                      <TableCell className="text-right">{holding.weight}%</TableCell>
                      <TableCell className="text-right font-mono">
                        {holding.shares}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${holding.avgCost}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${holding.currentPrice}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          returnPct >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {returnPct >= 0 ? '+' : ''}
                        {returnPct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
