export type MarketIndex = {
  name: string;
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
};

export const mockMarkets: MarketIndex[] = [
  { name: 'S&P Futures', ticker: 'S&P', price: 6892.5, change: -1.75, changePercent: -0.75, sparkline: [6895, 6894, 6890, 6891, 6888, 6890, 6892] },
  { name: 'Nasdaq Futures', ticker: 'NDX', price: 19235.4, change: 42.1, changePercent: 0.22, sparkline: [19210, 19220, 19235, 19218, 19225, 19230, 19235] },
  { name: 'Dow Futures', ticker: 'DJIA', price: 41420.7, change: -85.2, changePercent: -0.21, sparkline: [41490, 41460, 41430, 41410, 41405, 41418, 41420] },
  { name: 'Russell Futures', ticker: 'RUT', price: 2285.3, change: 18.4, changePercent: 0.81, sparkline: [2270, 2275, 2280, 2288, 2282, 2284, 2285] },
];

