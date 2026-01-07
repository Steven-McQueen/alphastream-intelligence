import { createContext, useContext, useState, ReactNode } from "react";
import type { Stock } from "@/types";

type StockDetailContextType = {
  selectedStock: Stock | null;
  openStockDetail: (stock: Stock) => void;
  closeStockDetail: () => void;
};

const StockDetailContext = createContext<StockDetailContextType | undefined>(undefined);

export function StockDetailProvider({ children }: { children: ReactNode }) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  const openStockDetail = (stock: Stock) => {
    setSelectedStock(stock);
  };

  const closeStockDetail = () => {
    setSelectedStock(null);
  };

  return (
    <StockDetailContext.Provider value={{ selectedStock, openStockDetail, closeStockDetail }}>
      {children}
    </StockDetailContext.Provider>
  );
}

export function useStockDetail() {
  const ctx = useContext(StockDetailContext);
  if (!ctx) throw new Error("useStockDetail must be used within StockDetailProvider");
  return ctx;
}

