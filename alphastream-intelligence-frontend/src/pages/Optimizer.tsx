import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Play, TrendingUp, Dices } from 'lucide-react';
import { EfficientFrontierChart } from '@/components/optimizer/EfficientFrontierChart';
import { RiskToleranceSlider } from '@/components/optimizer/RiskToleranceSlider';
import { ConstraintControls } from '@/components/optimizer/ConstraintControls';
import { TradeSuggestions } from '@/components/optimizer/TradeSuggestions';
import { PortfolioComparison } from '@/components/optimizer/PortfolioComparison';
import { MonteCarloChart } from '@/components/optimizer/MonteCarloChart';
import { DistributionChart } from '@/components/optimizer/DistributionChart';
import { MonteCarloControls } from '@/components/optimizer/MonteCarloControls';
import { MonteCarloStats } from '@/components/optimizer/MonteCarloStats';
import { RiskContributionChart } from '@/components/optimizer/RiskContributionChart';
import { CorrelationMatrix } from '@/components/optimizer/CorrelationMatrix';
import { SectorCorrelation } from '@/components/optimizer/SectorCorrelation';
import { FactorExposureChart } from '@/components/optimizer/FactorExposureChart';
import { FactorAttribution } from '@/components/optimizer/FactorAttribution';
import { HistoricalBacktest } from '@/components/optimizer/HistoricalBacktest';
import { RollingReturns } from '@/components/optimizer/RollingReturns';
import { StressTestScenarios } from '@/components/optimizer/StressTestScenarios';
import { getMockOptimizationResult, DEFAULT_CONSTRAINTS, type OptimizationConstraints } from '@/data/mockOptimizer';
import { runMonteCarloSimulation, type MonteCarloParams, type MonteCarloResult } from '@/data/mockMonteCarlo';
import { usePortfolio } from '@/context/PortfolioContext';
import { toast } from '@/hooks/use-toast';

export default function Optimizer() {
  const { portfolio } = usePortfolio();
  const [activeTab, setActiveTab] = useState<'optimization' | 'montecarlo'>('optimization');
  const [optimizationResult, setOptimizationResult] = useState(() => getMockOptimizationResult());
  const [constraints, setConstraints] = useState<OptimizationConstraints>(DEFAULT_CONSTRAINTS);
  const [targetVolatility, setTargetVolatility] = useState(18);
  const [targetReturn, setTargetReturn] = useState(10);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Monte Carlo state
  const [monteCarloParams, setMonteCarloParams] = useState<MonteCarloParams>({
    initialValue: portfolio.totalValue,
    expectedReturn: 12,
    volatility: 18,
    timeHorizonYears: 5,
    numSimulations: 1000,
    targetReturn: 50,
  });
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isRunningMC, setIsRunningMC] = useState(false);

  const handleOptimize = useCallback(() => {
    setIsOptimizing(true);
    setTimeout(() => {
      setOptimizationResult(getMockOptimizationResult());
      setIsOptimizing(false);
      toast({
        title: 'Optimization Complete',
        description: 'Portfolio has been optimized based on your constraints.',
      });
    }, 1500);
  }, []);

  const handleRefreshTrades = useCallback(() => {
    setOptimizationResult(getMockOptimizationResult());
    toast({
      title: 'Trades Recalculated',
      description: 'Trade suggestions have been updated.',
    });
  }, []);

  const handleRunMonteCarlo = useCallback(() => {
    setIsRunningMC(true);
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const result = runMonteCarloSimulation({
        ...monteCarloParams,
        initialValue: portfolio.totalValue,
      });
      setMonteCarloResult(result);
      setIsRunningMC(false);
      toast({
        title: 'Simulation Complete',
        description: `Ran ${monteCarloParams.numSimulations.toLocaleString()} simulations over ${monteCarloParams.timeHorizonYears} years.`,
      });
    }, 100);
  }, [monteCarloParams, portfolio.totalValue]);

  // Sync volatility from optimization to MC
  const syncedMCParams = useMemo(() => ({
    ...monteCarloParams,
    volatility: targetVolatility,
    expectedReturn: optimizationResult.optimalPortfolio.expectedReturn,
  }), [monteCarloParams, targetVolatility, optimizationResult.optimalPortfolio.expectedReturn]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Portfolio Optimizer</h1>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'optimization' | 'montecarlo')}>
            <TabsList className="h-8">
              <TabsTrigger value="optimization" className="text-xs px-3 h-6">
                <TrendingUp className="w-3 h-3 mr-1" />
                Mean-Variance
              </TabsTrigger>
              <TabsTrigger value="montecarlo" className="text-xs px-3 h-6">
                <Dices className="w-3 h-3 mr-1" />
                Monte Carlo
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Portfolio: {portfolio.name}
          </Badge>
          {activeTab === 'optimization' && (
            <Button
              variant="default"
              size="sm"
              onClick={handleOptimize}
              disabled={isOptimizing}
            >
              {isOptimizing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Run Optimization
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'optimization' ? (
          <div className="grid grid-cols-12 gap-4">
            {/* Left column - Controls */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <RiskToleranceSlider
                targetVolatility={targetVolatility}
                onTargetVolatilityChange={setTargetVolatility}
                targetReturn={targetReturn}
                onTargetReturnChange={setTargetReturn}
              />
              <ConstraintControls
                constraints={constraints}
                onConstraintsChange={setConstraints}
              />
            </div>

            {/* Right column - Charts and Results */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              <EfficientFrontierChart
                frontierPoints={optimizationResult.frontierPoints}
                currentPortfolio={optimizationResult.currentPortfolio}
                optimalPortfolio={optimizationResult.optimalPortfolio}
                targetVolatility={targetVolatility}
              />
              
              <PortfolioComparison
                current={optimizationResult.currentPortfolio}
                optimal={optimizationResult.optimalPortfolio}
              />
            </div>

            {/* Full width - Trade suggestions */}
            <div className="col-span-12">
              <TradeSuggestions
                trades={optimizationResult.suggestedTrades}
                onRefresh={handleRefreshTrades}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Left column - Controls */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <MonteCarloControls
                params={syncedMCParams}
                onParamsChange={setMonteCarloParams}
                onRunSimulation={handleRunMonteCarlo}
                isRunning={isRunningMC}
              />
            </div>

            {/* Right column - Results */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              {monteCarloResult ? (
                <>
                  <MonteCarloStats
                    result={monteCarloResult}
                    initialValue={portfolio.totalValue}
                    targetReturn={syncedMCParams.targetReturn}
                  />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <MonteCarloChart
                      result={monteCarloResult}
                      initialValue={portfolio.totalValue}
                      timeHorizonYears={syncedMCParams.timeHorizonYears}
                    />
                    <RiskContributionChart portfolioVaR={monteCarloResult.var95} />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <DistributionChart
                      result={monteCarloResult}
                      initialValue={portfolio.totalValue}
                      targetReturn={syncedMCParams.targetReturn}
                    />
                    <CorrelationMatrix />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <SectorCorrelation />
                    <FactorExposureChart />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <FactorAttribution totalReturn={14.2} />
                    <HistoricalBacktest />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <RollingReturns />
                    <StressTestScenarios />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] bg-secondary/30 rounded-lg border border-border">
                  <Dices className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No Simulation Results</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure parameters and run a Monte Carlo simulation
                  </p>
                  <Button onClick={handleRunMonteCarlo} disabled={isRunningMC}>
                    <Play className="w-4 h-4 mr-2" />
                    Run Simulation
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
