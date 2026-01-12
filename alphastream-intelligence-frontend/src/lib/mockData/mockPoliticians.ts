export type PoliticianTrade = {
  name: string;
  party: string;
  district: string;
  avatar?: string;
  transaction: string;
  type: string;
  filedAfter: string;
  amount: string;
  coins: number;
};

export const mockPoliticians: PoliticianTrade[] = [
  {
    name: 'Jefferson Shreve',
    party: 'HOUSE · IN-6',
    district: 'IN-6',
    transaction: 'Other',
    type: 'Buy',
    filedAfter: '2 days',
    amount: '$5M-$25M',
    coins: 4,
  },
  {
    name: 'Rudy Yakym III',
    party: 'HOUSE · IN-2',
    district: 'IN-2',
    transaction: 'Other',
    type: 'Buy',
    filedAfter: '1 day',
    amount: '$15K-$50K',
    coins: 2,
  },
  {
    name: 'Katie Porter',
    party: 'HOUSE · CA-47',
    district: 'CA-47',
    transaction: 'Stock',
    type: 'Sell',
    filedAfter: '5 days',
    amount: '$500K-$1M',
    coins: 3,
  },
];

