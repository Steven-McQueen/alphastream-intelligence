import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { MarketState, MarketIndex, MacroIndicator, SectorPerformance, MarketNewsItem, CryptoPrice } from '@/types';
import { getMockMarketState, getKeyIndicators, getMockMarketNews, generateNewNewsItem } from '@/data/mockMarket';

const API_BASE = 'http://localhost:8000';

interface MarketContextValue {
  // Core market data
  marketState: MarketState;
  indices: MarketIndex[];
  cryptoPrices: CryptoPrice[];
  macroIndicators: MacroIndicator[];
  sectorPerformance: SectorPerformance[];
  
  // Key status
  isMarketOpen: boolean;
  regime: string;
  regimeProbabilities: { riskOn: number; riskOff: number; neutral: number };
  
  // Quick access indicators for top bar
  keyIndicators: MarketIndex[];
  
  // News
  news: MarketNewsItem[];
  newsLoading: boolean;
  newNewsCount: number;
  markNewsAsRead: () => void;
  
  // Scroll sync
  scrollY: number;
  setScrollY: (y: number) => void;
  
  // Actions
  refreshMarketData: () => void;
  isLoading: boolean;
}

const MarketContext = createContext<MarketContextValue | undefined>(undefined);

const NEWS_POLL_INTERVAL = 15000; // 15 seconds
const MAX_NEWS_ITEMS = 20;

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [marketState, setMarketState] = useState<MarketState>(() => getMockMarketState());
  const [isLoading, setIsLoading] = useState(false);
  const [news, setNews] = useState<MarketNewsItem[]>(() => getMockMarketNews());
  const [newsLoading, setNewsLoading] = useState(false);
  const [newNewsCount, setNewNewsCount] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const lastReadTimestamp = useRef<string>(new Date().toISOString());

  const loadMarketData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [indicesData, indicatorsData, sectorsData] = await Promise.all([
        fetch(`${API_BASE}/api/macro/indices`).then((res) => res.json()),
        fetch(`${API_BASE}/api/macro/indicators`).then((res) => res.json()),
        fetch(`${API_BASE}/api/market/sectors`).then((res) => res.json()),
      ]);

      const mappedIndices = (indicesData || []).map((index: any) => ({
        symbol: index.symbol,
        name: index.name,
        value: index.value ?? 0,
        change: index.change ?? 0,
        changePercent: index.change_percent ?? index.change_pct ?? 0,
      }));

      const mappedIndicators = (indicatorsData || []).map((indicator: any) => {
        const change = indicator.change ?? 0;
        const value = indicator.value ?? 0;
        const previousValue =
          indicator.previous_value ??
          (change !== null && change !== undefined ? value - change : value);
        return {
          name: indicator.name || indicator.indicator_id,
          value,
          previousValue,
          change,
          unit: indicator.unit || '%',
          lastUpdated: indicator.last_updated || new Date().toISOString(),
        };
      });

      const mappedSectors = (sectorsData || []).map((sector: any) => ({
        sector: sector.sector,
        change1D: sector.change1D ?? 0,
        change1W: sector.change1W ?? 0,
        change1M: sector.change1M ?? 0,
        change1Y: sector.change1Y ?? 0,
      }));

      setMarketState((prev) => ({
        ...prev,
        indices: mappedIndices,
        macroIndicators: mappedIndicators,
        sectorPerformance: mappedSectors,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Failed to load market data', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshMarketData = useCallback(() => {
    loadMarketData();
  }, [loadMarketData]);

  useEffect(() => {
    loadMarketData();
    const interval = setInterval(loadMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadMarketData]);

  // Poll for new news
  useEffect(() => {
    const pollNews = () => {
      setNewsLoading(true);
      
      // Simulate fetching - 30% chance of new news each poll
      setTimeout(() => {
        if (Math.random() < 0.3) {
          const newItem = generateNewNewsItem();
          setNews(prev => {
            const updated = [newItem, ...prev].slice(0, MAX_NEWS_ITEMS);
            // Count unread news
            const unreadCount = updated.filter(
              item => new Date(item.publishedAt) > new Date(lastReadTimestamp.current)
            ).length;
            setNewNewsCount(unreadCount);
            return updated;
          });
        }
        setNewsLoading(false);
      }, 500);
    };

    const interval = setInterval(pollNews, NEWS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const markNewsAsRead = useCallback(() => {
    lastReadTimestamp.current = new Date().toISOString();
    setNewNewsCount(0);
  }, []);

  const isMarketOpen = useMemo(() => 
    marketState.status === 'Open', [marketState.status]);

  const keyIndicators = useMemo(() => getKeyIndicators(), [marketState]);

  const value: MarketContextValue = {
    marketState,
    indices: marketState.indices,
    cryptoPrices: marketState.cryptoPrices,
    macroIndicators: marketState.macroIndicators,
    sectorPerformance: marketState.sectorPerformance,
    isMarketOpen,
    regime: marketState.regime,
    regimeProbabilities: marketState.regimeProbabilities,
    keyIndicators,
    news,
    newsLoading,
    newNewsCount,
    markNewsAsRead,
    scrollY,
    setScrollY,
    refreshMarketData,
    isLoading,
  };

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}
