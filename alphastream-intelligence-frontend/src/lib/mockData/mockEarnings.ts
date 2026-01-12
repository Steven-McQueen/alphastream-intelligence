export type EarningsEntry = {
  ticker: string;
  company: string;
  date: string;
  time: 'BMO' | 'AMC';
  expectedEPS: number;
};

export const mockEarningsWeek = [
  { day: 'Sun', date: 'Dec 28', calls: 0, items: [] as EarningsEntry[] },
  { day: 'Mon', date: 'Dec 29', calls: 6, items: [
    { ticker: 'AAPL', company: 'Apple Inc.', date: 'Dec 29', time: 'AMC', expectedEPS: 1.24 },
    { ticker: 'MSFT', company: 'Microsoft Corp.', date: 'Dec 29', time: 'AMC', expectedEPS: 2.91 },
  ] },
  { day: 'Tue', date: 'Dec 30', calls: 0, items: [] as EarningsEntry[] },
  { day: 'Wed', date: 'Dec 31', calls: 1, items: [
    { ticker: 'NVDA', company: 'NVIDIA Corp.', date: 'Dec 31', time: 'AMC', expectedEPS: 4.02 },
  ] },
  { day: 'Thu', date: 'Jan 1', calls: 0, items: [] as EarningsEntry[] },
  { day: 'Fri', date: 'Jan 2', calls: 0, items: [] as EarningsEntry[] },
  { day: 'Sat', date: 'Jan 3', calls: 0, items: [] as EarningsEntry[] },
];

