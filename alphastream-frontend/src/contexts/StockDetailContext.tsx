import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import type { Stock } from "@/types";
import type { IndexInstrument } from "@/lib/indexMeta";

type StockUpdateListener = (stock: Stock) => void;

type StockDetailContextType = {
  selectedStock: Stock | null;
  selectedIndex: IndexInstrument | null;
  openStockDetail: (stock: Stock) => void;
  openIndexDetail: (index: IndexInstrument) => void;
  closeStockDetail: (updatedStock?: Stock) => void;
  subscribeToStockUpdates: (listener: StockUpdateListener) => () => void;
};

const StockDetailContext = createContext<StockDetailContextType | undefined>(undefined);

export function StockDetailProvider({ children }: { children: ReactNode }) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<IndexInstrument | null>(null);
  const listenersRef = useRef<Set<StockUpdateListener>>(new Set());

  const openStockDetail = useCallback((stock: Stock) => {
    setSelectedIndex(null);
    setSelectedStock(stock);
  }, []);

  const openIndexDetail = useCallback((index: IndexInstrument) => {
    setSelectedStock(null);
    setSelectedIndex(index);
  }, []);

  // When closing, optionally pass fresh stock data to broadcast to subscribers
  const closeStockDetail = useCallback((updatedStock?: Stock) => {
    if (updatedStock) {
      // Notify all listeners (Screener, Watchlist, etc.) about the updated stock
      listenersRef.current.forEach(listener => listener(updatedStock));
    }
    setSelectedStock(null);
    setSelectedIndex(null);
  }, []);

  // Subscribe to stock updates - returns unsubscribe function
  const subscribeToStockUpdates = useCallback((listener: StockUpdateListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <StockDetailContext.Provider value={{ selectedStock, selectedIndex, openStockDetail, openIndexDetail, closeStockDetail, subscribeToStockUpdates }}>
      {children}
    </StockDetailContext.Provider>
  );
}

export function useStockDetail() {
  const ctx = useContext(StockDetailContext);
  if (!ctx) throw new Error("useStockDetail must be used within StockDetailProvider");
  return ctx;
}

