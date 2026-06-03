import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Portfolio, PortfolioHolding, FactorExposure, PortfolioSummary } from '@/types';
import { getMockPortfolio, getMockFactorExposures, getSectorAllocation } from '@/data/mockPortfolio';

interface PortfolioContextValue {
  // Core portfolio data (single source of truth)
  portfolio: Portfolio;
  holdings: PortfolioHolding[];
  factorExposures: FactorExposure[];
  
  // Derived data
  summary: PortfolioSummary;
  sectorAllocation: Record<string, { value: number; weight: number }>;
  
  // Actions (for future API integration)
  refreshPortfolio: () => void;
  isLoading: boolean;
  lastUpdated: string;
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [portfolio, setPortfolio] = useState<Portfolio>(() => getMockPortfolio());
  const [factorExposures, setFactorExposures] = useState<FactorExposure[]>(() => getMockFactorExposures());
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());

  // Refresh portfolio data (will call API in future)
  const refreshPortfolio = useCallback(() => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setPortfolio(getMockPortfolio());
      setFactorExposures(getMockFactorExposures());
      setLastUpdated(new Date().toISOString());
      setIsLoading(false);
    }, 500);
  }, []);

  // Derived: portfolio summary
  const summary = useMemo<PortfolioSummary>(() => ({
    totalValue: portfolio.totalValue,
    cash: portfolio.cash,
    ytdReturn: portfolio.ytdReturn,
    dailyPnL: portfolio.dailyPnL,
    dailyPnLPercent: portfolio.dailyPnLPercent,
    volatility: portfolio.volatility,
    sharpeRatio: portfolio.sharpeRatio,
  }), [portfolio]);

  // Derived: sector allocation
  const sectorAllocation = useMemo(() => getSectorAllocation(), [portfolio]);

  const value: PortfolioContextValue = {
    portfolio,
    holdings: portfolio.holdings,
    factorExposures,
    summary,
    sectorAllocation,
    refreshPortfolio,
    isLoading,
    lastUpdated,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
