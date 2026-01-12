export type WatchlistStock = {
  ticker: string;
  name: string;
  logo?: string;
  price: number;
  change1D: number;
  change5D: number;
  change1M: number;
  change6M: number;
};

export const mockWatchlist: WatchlistStock[] = [
  { ticker: 'ASML', name: 'ASML Holding N.V.', price: 1070, change1D: -0.21, change5D: 0.34, change1M: -1.67, change6M: 35.34 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 912.3, change1D: 0.85, change5D: 3.12, change1M: 5.44, change6M: 54.8 },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 414.6, change1D: 0.35, change5D: 0.92, change1M: 2.18, change6M: 22.5 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 181.2, change1D: -0.42, change5D: 1.05, change1M: 3.88, change6M: 18.9 },
];

export const mockWatchlistSummary = `
The watchlist is mixed today as AI infrastructure names face continued pressure heading into the new year. CoreWeave led declines, dropping 3.10% to close at $71.61 despite a $176 million quarter backlog and strong forward guidance. Semiconductor names were range-bound, while mega-cap software held firm on resilient cloud demand.
`;

