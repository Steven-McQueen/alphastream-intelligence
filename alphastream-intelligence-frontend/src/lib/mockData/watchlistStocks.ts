export type WatchlistStock = {
  ticker: string;
  name: string;
  logo?: string;
  price: number;
  change1d: number;
  change5d: number;
  change1m: number;
  change6m: number;
};

export const MOCK_WATCHLIST_STOCKS: WatchlistStock[] = [
  { ticker: 'ASML', name: 'ASML Holding N.V.', logo: '/logos/asml.png', price: 1164, change1d: 8.78, change5d: 9.32, change1m: 4.84, change6m: 48.24 },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', logo: '/logos/nvda.png', price: 912.3, change1d: 0.85, change5d: 3.12, change1m: 5.44, change6m: 54.8 },
  { ticker: 'MSFT', name: 'Microsoft Corporation', logo: '/logos/msft.png', price: 414.6, change1d: 0.35, change5d: 0.92, change1m: 2.18, change6m: 22.5 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', logo: '/logos/amzn.png', price: 181.2, change1d: -0.42, change5d: 1.05, change1m: 3.88, change6m: 18.9 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', logo: '/logos/googl.png', price: 152.4, change1d: 0.28, change5d: 1.65, change1m: 4.12, change6m: 20.3 },
  { ticker: 'TSLA', name: 'Tesla Inc.', logo: '/logos/tsla.png', price: 241.8, change1d: -1.34, change5d: -0.88, change1m: 2.45, change6m: 10.2 },
  { ticker: 'TTWO', name: 'Take-Two Interactive', logo: '/logos/ttwo.png', price: 252, change1d: -1.73, change5d: -1.33, change1m: 1.66, change6m: 3.74 },
  { ticker: 'AMD', name: 'Advanced Micro Devices', logo: '/logos/amd.png', price: 162.9, change1d: 1.12, change5d: 3.5, change1m: 6.02, change6m: 28.4 },
  { ticker: 'META', name: 'Meta Platforms', logo: '/logos/meta.png', price: 356.2, change1d: 0.92, change5d: 2.11, change1m: 5.4, change6m: 30.5 },
  { ticker: 'NFLX', name: 'Netflix Inc.', logo: '/logos/nflx.png', price: 488.6, change1d: 0.65, change5d: 1.32, change1m: 3.77, change6m: 16.9 },
];

