import type { Stock, Sector, CatalystTag } from '@/types';

// US equity universe - ~500 S&P-like quality stocks
// Avoiding exact S&P 500 naming for licensing

const SECTORS: Sector[] = [
  'Technology',
  'Healthcare', 
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Industrials',
  'Energy',
  'Materials',
  'Utilities',
  'Real Estate',
  'Communication Services',
];

const CATALYST_POOL: CatalystTag[] = [
  'Earnings Soon',
  'Analyst Upgrade',
  'Analyst Downgrade',
  'Insider Buying',
  'Insider Selling',
  'New Product',
  'M&A Target',
  'Dividend Increase',
  'Buyback',
  'Guidance Raised',
  'Guidance Lowered',
  'Sector Rotation',
  'Momentum Breakout',
  'Value Opportunity',
];

// Realistic ticker/name pairs
const STOCK_DATA: Array<{ ticker: string; name: string; sector: Sector; industry: string }> = [
  // Technology (80 stocks)
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services' },
  { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Social Media' },
  { ticker: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'ADBE', name: 'Adobe Inc.', sector: 'Technology', industry: 'Software' },
  { ticker: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', industry: 'Software' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'INTC', name: 'Intel Corporation', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'CSCO', name: 'Cisco Systems Inc.', sector: 'Technology', industry: 'Networking' },
  { ticker: 'ORCL', name: 'Oracle Corporation', sector: 'Technology', industry: 'Software' },
  { ticker: 'ACN', name: 'Accenture plc', sector: 'Technology', industry: 'IT Services' },
  { ticker: 'IBM', name: 'IBM Corporation', sector: 'Technology', industry: 'IT Services' },
  { ticker: 'QCOM', name: 'Qualcomm Inc.', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'TXN', name: 'Texas Instruments', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'NOW', name: 'ServiceNow Inc.', sector: 'Technology', industry: 'Software' },
  { ticker: 'INTU', name: 'Intuit Inc.', sector: 'Technology', industry: 'Software' },
  { ticker: 'AMAT', name: 'Applied Materials', sector: 'Technology', industry: 'Semiconductor Equipment' },
  { ticker: 'MU', name: 'Micron Technology', sector: 'Technology', industry: 'Memory' },
  { ticker: 'LRCX', name: 'Lam Research', sector: 'Technology', industry: 'Semiconductor Equipment' },
  { ticker: 'SNPS', name: 'Synopsys Inc.', sector: 'Technology', industry: 'EDA Software' },
  { ticker: 'CDNS', name: 'Cadence Design', sector: 'Technology', industry: 'EDA Software' },
  { ticker: 'KLAC', name: 'KLA Corporation', sector: 'Technology', industry: 'Semiconductor Equipment' },
  { ticker: 'PANW', name: 'Palo Alto Networks', sector: 'Technology', industry: 'Cybersecurity' },
  { ticker: 'CRWD', name: 'CrowdStrike Holdings', sector: 'Technology', industry: 'Cybersecurity' },
  { ticker: 'FTNT', name: 'Fortinet Inc.', sector: 'Technology', industry: 'Cybersecurity' },
  { ticker: 'WDAY', name: 'Workday Inc.', sector: 'Technology', industry: 'Software' },
  { ticker: 'TEAM', name: 'Atlassian Corporation', sector: 'Technology', industry: 'Software' },
  { ticker: 'SNOW', name: 'Snowflake Inc.', sector: 'Technology', industry: 'Cloud Data' },
  { ticker: 'DDOG', name: 'Datadog Inc.', sector: 'Technology', industry: 'Observability' },
  { ticker: 'ZS', name: 'Zscaler Inc.', sector: 'Technology', industry: 'Cybersecurity' },
  { ticker: 'NET', name: 'Cloudflare Inc.', sector: 'Technology', industry: 'CDN/Security' },
  { ticker: 'MRVL', name: 'Marvell Technology', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'ON', name: 'ON Semiconductor', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'NXPI', name: 'NXP Semiconductors', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'ADI', name: 'Analog Devices', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'MCHP', name: 'Microchip Technology', sector: 'Technology', industry: 'Semiconductors' },
  { ticker: 'HPE', name: 'Hewlett Packard Enterprise', sector: 'Technology', industry: 'IT Hardware' },
  { ticker: 'HPQ', name: 'HP Inc.', sector: 'Technology', industry: 'Consumer Electronics' },
  { ticker: 'DELL', name: 'Dell Technologies', sector: 'Technology', industry: 'IT Hardware' },
  { ticker: 'KEYS', name: 'Keysight Technologies', sector: 'Technology', industry: 'Test & Measurement' },
  { ticker: 'ANSS', name: 'ANSYS Inc.', sector: 'Technology', industry: 'Simulation Software' },
  { ticker: 'PTC', name: 'PTC Inc.', sector: 'Technology', industry: 'Software' },
  { ticker: 'AKAM', name: 'Akamai Technologies', sector: 'Technology', industry: 'CDN' },
  
  // Healthcare (65 stocks)
  { ticker: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', industry: 'Health Insurance' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'MRK', name: 'Merck & Co.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'TMO', name: 'Thermo Fisher Scientific', sector: 'Healthcare', industry: 'Life Sciences' },
  { ticker: 'ABT', name: 'Abbott Laboratories', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'DHR', name: 'Danaher Corporation', sector: 'Healthcare', industry: 'Life Sciences' },
  { ticker: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare', industry: 'Biotechnology' },
  { ticker: 'MDT', name: 'Medtronic plc', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'BMY', name: 'Bristol-Myers Squibb', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { ticker: 'GILD', name: 'Gilead Sciences', sector: 'Healthcare', industry: 'Biotechnology' },
  { ticker: 'VRTX', name: 'Vertex Pharmaceuticals', sector: 'Healthcare', industry: 'Biotechnology' },
  { ticker: 'ISRG', name: 'Intuitive Surgical', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'SYK', name: 'Stryker Corporation', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'REGN', name: 'Regeneron Pharmaceuticals', sector: 'Healthcare', industry: 'Biotechnology' },
  { ticker: 'BSX', name: 'Boston Scientific', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'EW', name: 'Edwards Lifesciences', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'ZTS', name: 'Zoetis Inc.', sector: 'Healthcare', industry: 'Animal Health' },
  { ticker: 'CI', name: 'The Cigna Group', sector: 'Healthcare', industry: 'Health Insurance' },
  { ticker: 'CVS', name: 'CVS Health Corporation', sector: 'Healthcare', industry: 'Healthcare Services' },
  { ticker: 'ELV', name: 'Elevance Health', sector: 'Healthcare', industry: 'Health Insurance' },
  { ticker: 'HUM', name: 'Humana Inc.', sector: 'Healthcare', industry: 'Health Insurance' },
  { ticker: 'MCK', name: 'McKesson Corporation', sector: 'Healthcare', industry: 'Healthcare Distribution' },
  { ticker: 'CAH', name: 'Cardinal Health', sector: 'Healthcare', industry: 'Healthcare Distribution' },
  { ticker: 'BIIB', name: 'Biogen Inc.', sector: 'Healthcare', industry: 'Biotechnology' },
  { ticker: 'IDXX', name: 'IDEXX Laboratories', sector: 'Healthcare', industry: 'Diagnostics' },
  { ticker: 'IQV', name: 'IQVIA Holdings', sector: 'Healthcare', industry: 'CRO' },
  { ticker: 'A', name: 'Agilent Technologies', sector: 'Healthcare', industry: 'Life Sciences' },
  { ticker: 'MTD', name: 'Mettler-Toledo', sector: 'Healthcare', industry: 'Lab Equipment' },
  { ticker: 'DXCM', name: 'DexCom Inc.', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'ALGN', name: 'Align Technology', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'HOLX', name: 'Hologic Inc.', sector: 'Healthcare', industry: 'Medical Devices' },
  { ticker: 'RMD', name: 'ResMed Inc.', sector: 'Healthcare', industry: 'Medical Devices' },
  
  // Financials (55 stocks)
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials', industry: 'Diversified Financial' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials', industry: 'Banks' },
  { ticker: 'V', name: 'Visa Inc.', sector: 'Financials', industry: 'Payments' },
  { ticker: 'MA', name: 'Mastercard Inc.', sector: 'Financials', industry: 'Payments' },
  { ticker: 'BAC', name: 'Bank of America', sector: 'Financials', industry: 'Banks' },
  { ticker: 'WFC', name: 'Wells Fargo & Company', sector: 'Financials', industry: 'Banks' },
  { ticker: 'GS', name: 'Goldman Sachs Group', sector: 'Financials', industry: 'Investment Banking' },
  { ticker: 'MS', name: 'Morgan Stanley', sector: 'Financials', industry: 'Investment Banking' },
  { ticker: 'SPGI', name: 'S&P Global Inc.', sector: 'Financials', industry: 'Financial Data' },
  { ticker: 'BLK', name: 'BlackRock Inc.', sector: 'Financials', industry: 'Asset Management' },
  { ticker: 'C', name: 'Citigroup Inc.', sector: 'Financials', industry: 'Banks' },
  { ticker: 'AXP', name: 'American Express', sector: 'Financials', industry: 'Consumer Finance' },
  { ticker: 'SCHW', name: 'Charles Schwab', sector: 'Financials', industry: 'Brokerage' },
  { ticker: 'CB', name: 'Chubb Limited', sector: 'Financials', industry: 'Insurance' },
  { ticker: 'MMC', name: 'Marsh & McLennan', sector: 'Financials', industry: 'Insurance Brokerage' },
  { ticker: 'PGR', name: 'Progressive Corporation', sector: 'Financials', industry: 'Insurance' },
  { ticker: 'ICE', name: 'Intercontinental Exchange', sector: 'Financials', industry: 'Exchanges' },
  { ticker: 'CME', name: 'CME Group Inc.', sector: 'Financials', industry: 'Exchanges' },
  { ticker: 'AON', name: 'Aon plc', sector: 'Financials', industry: 'Insurance Brokerage' },
  { ticker: 'USB', name: 'U.S. Bancorp', sector: 'Financials', industry: 'Banks' },
  { ticker: 'PNC', name: 'PNC Financial Services', sector: 'Financials', industry: 'Banks' },
  { ticker: 'TFC', name: 'Truist Financial', sector: 'Financials', industry: 'Banks' },
  { ticker: 'MCO', name: 'Moody\'s Corporation', sector: 'Financials', industry: 'Financial Data' },
  { ticker: 'MET', name: 'MetLife Inc.', sector: 'Financials', industry: 'Insurance' },
  { ticker: 'AIG', name: 'American International Group', sector: 'Financials', industry: 'Insurance' },
  { ticker: 'COF', name: 'Capital One Financial', sector: 'Financials', industry: 'Consumer Finance' },
  { ticker: 'TRV', name: 'The Travelers Companies', sector: 'Financials', industry: 'Insurance' },
  { ticker: 'ALL', name: 'The Allstate Corporation', sector: 'Financials', industry: 'Insurance' },
  { ticker: 'AFL', name: 'Aflac Inc.', sector: 'Financials', industry: 'Insurance' },
  { ticker: 'MSCI', name: 'MSCI Inc.', sector: 'Financials', industry: 'Financial Data' },
  
  // Consumer Discretionary (55 stocks)
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', industry: 'E-commerce' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary', industry: 'Electric Vehicles' },
  { ticker: 'HD', name: 'The Home Depot', sector: 'Consumer Discretionary', industry: 'Home Improvement' },
  { ticker: 'MCD', name: 'McDonald\'s Corporation', sector: 'Consumer Discretionary', industry: 'Restaurants' },
  { ticker: 'NKE', name: 'Nike Inc.', sector: 'Consumer Discretionary', industry: 'Apparel' },
  { ticker: 'LOW', name: 'Lowe\'s Companies', sector: 'Consumer Discretionary', industry: 'Home Improvement' },
  { ticker: 'SBUX', name: 'Starbucks Corporation', sector: 'Consumer Discretionary', industry: 'Restaurants' },
  { ticker: 'TJX', name: 'TJX Companies', sector: 'Consumer Discretionary', industry: 'Retail' },
  { ticker: 'BKNG', name: 'Booking Holdings', sector: 'Consumer Discretionary', industry: 'Travel' },
  { ticker: 'MAR', name: 'Marriott International', sector: 'Consumer Discretionary', industry: 'Hotels' },
  { ticker: 'ABNB', name: 'Airbnb Inc.', sector: 'Consumer Discretionary', industry: 'Travel' },
  { ticker: 'CMG', name: 'Chipotle Mexican Grill', sector: 'Consumer Discretionary', industry: 'Restaurants' },
  { ticker: 'ORLY', name: 'O\'Reilly Automotive', sector: 'Consumer Discretionary', industry: 'Auto Parts' },
  { ticker: 'AZO', name: 'AutoZone Inc.', sector: 'Consumer Discretionary', industry: 'Auto Parts' },
  { ticker: 'ROST', name: 'Ross Stores Inc.', sector: 'Consumer Discretionary', industry: 'Retail' },
  { ticker: 'DHI', name: 'D.R. Horton', sector: 'Consumer Discretionary', industry: 'Homebuilders' },
  { ticker: 'LEN', name: 'Lennar Corporation', sector: 'Consumer Discretionary', industry: 'Homebuilders' },
  { ticker: 'GM', name: 'General Motors', sector: 'Consumer Discretionary', industry: 'Automobiles' },
  { ticker: 'F', name: 'Ford Motor Company', sector: 'Consumer Discretionary', industry: 'Automobiles' },
  { ticker: 'YUM', name: 'Yum! Brands Inc.', sector: 'Consumer Discretionary', industry: 'Restaurants' },
  { ticker: 'DPZ', name: 'Domino\'s Pizza', sector: 'Consumer Discretionary', industry: 'Restaurants' },
  { ticker: 'DECK', name: 'Deckers Outdoor', sector: 'Consumer Discretionary', industry: 'Footwear' },
  { ticker: 'LULU', name: 'Lululemon Athletica', sector: 'Consumer Discretionary', industry: 'Apparel' },
  { ticker: 'RCL', name: 'Royal Caribbean Cruises', sector: 'Consumer Discretionary', industry: 'Cruises' },
  { ticker: 'CCL', name: 'Carnival Corporation', sector: 'Consumer Discretionary', industry: 'Cruises' },
  { ticker: 'HLT', name: 'Hilton Worldwide', sector: 'Consumer Discretionary', industry: 'Hotels' },
  { ticker: 'LVS', name: 'Las Vegas Sands', sector: 'Consumer Discretionary', industry: 'Casinos' },
  { ticker: 'WYNN', name: 'Wynn Resorts', sector: 'Consumer Discretionary', industry: 'Casinos' },
  { ticker: 'MGM', name: 'MGM Resorts International', sector: 'Consumer Discretionary', industry: 'Casinos' },
  { ticker: 'POOL', name: 'Pool Corporation', sector: 'Consumer Discretionary', industry: 'Pool Supplies' },
  
  // Consumer Staples (35 stocks)
  { ticker: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', industry: 'Household Products' },
  { ticker: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Staples', industry: 'Beverages' },
  { ticker: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples', industry: 'Beverages' },
  { ticker: 'COST', name: 'Costco Wholesale', sector: 'Consumer Staples', industry: 'Retail' },
  { ticker: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples', industry: 'Retail' },
  { ticker: 'PM', name: 'Philip Morris International', sector: 'Consumer Staples', industry: 'Tobacco' },
  { ticker: 'MO', name: 'Altria Group', sector: 'Consumer Staples', industry: 'Tobacco' },
  { ticker: 'MDLZ', name: 'Mondelez International', sector: 'Consumer Staples', industry: 'Packaged Foods' },
  { ticker: 'CL', name: 'Colgate-Palmolive', sector: 'Consumer Staples', industry: 'Household Products' },
  { ticker: 'KMB', name: 'Kimberly-Clark', sector: 'Consumer Staples', industry: 'Household Products' },
  { ticker: 'GIS', name: 'General Mills', sector: 'Consumer Staples', industry: 'Packaged Foods' },
  { ticker: 'K', name: 'Kellanova', sector: 'Consumer Staples', industry: 'Packaged Foods' },
  { ticker: 'HSY', name: 'The Hershey Company', sector: 'Consumer Staples', industry: 'Confectionery' },
  { ticker: 'SYY', name: 'Sysco Corporation', sector: 'Consumer Staples', industry: 'Food Distribution' },
  { ticker: 'STZ', name: 'Constellation Brands', sector: 'Consumer Staples', industry: 'Beverages' },
  { ticker: 'MKC', name: 'McCormick & Company', sector: 'Consumer Staples', industry: 'Spices' },
  { ticker: 'CHD', name: 'Church & Dwight', sector: 'Consumer Staples', industry: 'Household Products' },
  { ticker: 'KR', name: 'The Kroger Co.', sector: 'Consumer Staples', industry: 'Grocery Retail' },
  { ticker: 'WBA', name: 'Walgreens Boots Alliance', sector: 'Consumer Staples', industry: 'Pharmacy Retail' },
  { ticker: 'TGT', name: 'Target Corporation', sector: 'Consumer Staples', industry: 'Retail' },
  { ticker: 'DG', name: 'Dollar General', sector: 'Consumer Staples', industry: 'Discount Retail' },
  { ticker: 'DLTR', name: 'Dollar Tree Inc.', sector: 'Consumer Staples', industry: 'Discount Retail' },
  { ticker: 'EL', name: 'The Estée Lauder Companies', sector: 'Consumer Staples', industry: 'Personal Care' },
  { ticker: 'CLX', name: 'The Clorox Company', sector: 'Consumer Staples', industry: 'Household Products' },
  { ticker: 'SJM', name: 'The J.M. Smucker Company', sector: 'Consumer Staples', industry: 'Packaged Foods' },
  
  // Industrials (60 stocks)
  { ticker: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', industry: 'Heavy Equipment' },
  { ticker: 'UNP', name: 'Union Pacific Corporation', sector: 'Industrials', industry: 'Railroads' },
  { ticker: 'HON', name: 'Honeywell International', sector: 'Industrials', industry: 'Conglomerate' },
  { ticker: 'UPS', name: 'United Parcel Service', sector: 'Industrials', industry: 'Logistics' },
  { ticker: 'RTX', name: 'RTX Corporation', sector: 'Industrials', industry: 'Aerospace & Defense' },
  { ticker: 'BA', name: 'The Boeing Company', sector: 'Industrials', industry: 'Aerospace' },
  { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', industry: 'Defense' },
  { ticker: 'GE', name: 'General Electric', sector: 'Industrials', industry: 'Conglomerate' },
  { ticker: 'DE', name: 'Deere & Company', sector: 'Industrials', industry: 'Agricultural Equipment' },
  { ticker: 'MMM', name: '3M Company', sector: 'Industrials', industry: 'Conglomerate' },
  { ticker: 'ADP', name: 'Automatic Data Processing', sector: 'Industrials', industry: 'Business Services' },
  { ticker: 'ITW', name: 'Illinois Tool Works', sector: 'Industrials', industry: 'Machinery' },
  { ticker: 'EMR', name: 'Emerson Electric', sector: 'Industrials', industry: 'Industrial Automation' },
  { ticker: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', industry: 'Defense' },
  { ticker: 'GD', name: 'General Dynamics', sector: 'Industrials', industry: 'Defense' },
  { ticker: 'CSX', name: 'CSX Corporation', sector: 'Industrials', industry: 'Railroads' },
  { ticker: 'NSC', name: 'Norfolk Southern', sector: 'Industrials', industry: 'Railroads' },
  { ticker: 'FDX', name: 'FedEx Corporation', sector: 'Industrials', industry: 'Logistics' },
  { ticker: 'WM', name: 'Waste Management', sector: 'Industrials', industry: 'Waste Services' },
  { ticker: 'RSG', name: 'Republic Services', sector: 'Industrials', industry: 'Waste Services' },
  { ticker: 'ETN', name: 'Eaton Corporation', sector: 'Industrials', industry: 'Electrical Equipment' },
  { ticker: 'PH', name: 'Parker-Hannifin', sector: 'Industrials', industry: 'Industrial Machinery' },
  { ticker: 'PCAR', name: 'PACCAR Inc.', sector: 'Industrials', industry: 'Trucks' },
  { ticker: 'CMI', name: 'Cummins Inc.', sector: 'Industrials', industry: 'Engines' },
  { ticker: 'ROK', name: 'Rockwell Automation', sector: 'Industrials', industry: 'Industrial Automation' },
  { ticker: 'FAST', name: 'Fastenal Company', sector: 'Industrials', industry: 'Industrial Distribution' },
  { ticker: 'JCI', name: 'Johnson Controls', sector: 'Industrials', industry: 'Building Technology' },
  { ticker: 'VRSK', name: 'Verisk Analytics', sector: 'Industrials', industry: 'Data Analytics' },
  { ticker: 'CPRT', name: 'Copart Inc.', sector: 'Industrials', industry: 'Auto Auctions' },
  { ticker: 'ODFL', name: 'Old Dominion Freight', sector: 'Industrials', industry: 'Trucking' },
  
  // Energy (30 stocks)
  { ticker: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Integrated Oil & Gas' },
  { ticker: 'CVX', name: 'Chevron Corporation', sector: 'Energy', industry: 'Integrated Oil & Gas' },
  { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy', industry: 'Exploration & Production' },
  { ticker: 'EOG', name: 'EOG Resources', sector: 'Energy', industry: 'Exploration & Production' },
  { ticker: 'SLB', name: 'Schlumberger Limited', sector: 'Energy', industry: 'Oilfield Services' },
  { ticker: 'MPC', name: 'Marathon Petroleum', sector: 'Energy', industry: 'Refining' },
  { ticker: 'PSX', name: 'Phillips 66', sector: 'Energy', industry: 'Refining' },
  { ticker: 'VLO', name: 'Valero Energy', sector: 'Energy', industry: 'Refining' },
  { ticker: 'OXY', name: 'Occidental Petroleum', sector: 'Energy', industry: 'Exploration & Production' },
  { ticker: 'HAL', name: 'Halliburton Company', sector: 'Energy', industry: 'Oilfield Services' },
  { ticker: 'BKR', name: 'Baker Hughes Company', sector: 'Energy', industry: 'Oilfield Services' },
  { ticker: 'KMI', name: 'Kinder Morgan', sector: 'Energy', industry: 'Midstream' },
  { ticker: 'WMB', name: 'Williams Companies', sector: 'Energy', industry: 'Midstream' },
  { ticker: 'OKE', name: 'ONEOK Inc.', sector: 'Energy', industry: 'Midstream' },
  { ticker: 'DVN', name: 'Devon Energy', sector: 'Energy', industry: 'Exploration & Production' },
  { ticker: 'HES', name: 'Hess Corporation', sector: 'Energy', industry: 'Exploration & Production' },
  { ticker: 'FANG', name: 'Diamondback Energy', sector: 'Energy', industry: 'Exploration & Production' },
  { ticker: 'PXD', name: 'Pioneer Natural Resources', sector: 'Energy', industry: 'Exploration & Production' },
  { ticker: 'TRGP', name: 'Targa Resources', sector: 'Energy', industry: 'Midstream' },
  { ticker: 'LNG', name: 'Cheniere Energy', sector: 'Energy', industry: 'LNG' },
  
  // Materials (25 stocks)
  { ticker: 'LIN', name: 'Linde plc', sector: 'Materials', industry: 'Industrial Gases' },
  { ticker: 'APD', name: 'Air Products and Chemicals', sector: 'Materials', industry: 'Industrial Gases' },
  { ticker: 'SHW', name: 'Sherwin-Williams', sector: 'Materials', industry: 'Paints & Coatings' },
  { ticker: 'FCX', name: 'Freeport-McMoRan', sector: 'Materials', industry: 'Copper Mining' },
  { ticker: 'NEM', name: 'Newmont Corporation', sector: 'Materials', industry: 'Gold Mining' },
  { ticker: 'ECL', name: 'Ecolab Inc.', sector: 'Materials', industry: 'Specialty Chemicals' },
  { ticker: 'DD', name: 'DuPont de Nemours', sector: 'Materials', industry: 'Diversified Chemicals' },
  { ticker: 'DOW', name: 'Dow Inc.', sector: 'Materials', industry: 'Chemicals' },
  { ticker: 'PPG', name: 'PPG Industries', sector: 'Materials', industry: 'Paints & Coatings' },
  { ticker: 'NUE', name: 'Nucor Corporation', sector: 'Materials', industry: 'Steel' },
  { ticker: 'VMC', name: 'Vulcan Materials', sector: 'Materials', industry: 'Aggregates' },
  { ticker: 'MLM', name: 'Martin Marietta Materials', sector: 'Materials', industry: 'Aggregates' },
  { ticker: 'CTVA', name: 'Corteva Inc.', sector: 'Materials', industry: 'Agricultural Chemicals' },
  { ticker: 'ALB', name: 'Albemarle Corporation', sector: 'Materials', industry: 'Lithium' },
  { ticker: 'IFF', name: 'International Flavors & Fragrances', sector: 'Materials', industry: 'Specialty Chemicals' },
  { ticker: 'BALL', name: 'Ball Corporation', sector: 'Materials', industry: 'Packaging' },
  { ticker: 'AVY', name: 'Avery Dennison', sector: 'Materials', industry: 'Packaging' },
  { ticker: 'PKG', name: 'Packaging Corporation of America', sector: 'Materials', industry: 'Packaging' },
  { ticker: 'IP', name: 'International Paper', sector: 'Materials', industry: 'Paper & Packaging' },
  { ticker: 'STLD', name: 'Steel Dynamics', sector: 'Materials', industry: 'Steel' },
  
  // Utilities (25 stocks)
  { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'SO', name: 'The Southern Company', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'DUK', name: 'Duke Energy Corporation', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'D', name: 'Dominion Energy', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'SRE', name: 'Sempra', sector: 'Utilities', industry: 'Multi-Utilities' },
  { ticker: 'AEP', name: 'American Electric Power', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'XEL', name: 'Xcel Energy', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'EXC', name: 'Exelon Corporation', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'PCG', name: 'PG&E Corporation', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'WEC', name: 'WEC Energy Group', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'ED', name: 'Consolidated Edison', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'EIX', name: 'Edison International', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'AWK', name: 'American Water Works', sector: 'Utilities', industry: 'Water Utilities' },
  { ticker: 'AES', name: 'The AES Corporation', sector: 'Utilities', industry: 'Independent Power' },
  { ticker: 'ETR', name: 'Entergy Corporation', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'PPL', name: 'PPL Corporation', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'FE', name: 'FirstEnergy Corp.', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'DTE', name: 'DTE Energy Company', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'ES', name: 'Eversource Energy', sector: 'Utilities', industry: 'Electric Utilities' },
  { ticker: 'CMS', name: 'CMS Energy Corporation', sector: 'Utilities', industry: 'Electric Utilities' },
  
  // Real Estate (30 stocks)
  { ticker: 'PLD', name: 'Prologis Inc.', sector: 'Real Estate', industry: 'Industrial REITs' },
  { ticker: 'AMT', name: 'American Tower Corporation', sector: 'Real Estate', industry: 'Tower REITs' },
  { ticker: 'EQIX', name: 'Equinix Inc.', sector: 'Real Estate', industry: 'Data Center REITs' },
  { ticker: 'CCI', name: 'Crown Castle Inc.', sector: 'Real Estate', industry: 'Tower REITs' },
  { ticker: 'PSA', name: 'Public Storage', sector: 'Real Estate', industry: 'Storage REITs' },
  { ticker: 'SPG', name: 'Simon Property Group', sector: 'Real Estate', industry: 'Retail REITs' },
  { ticker: 'WELL', name: 'Welltower Inc.', sector: 'Real Estate', industry: 'Healthcare REITs' },
  { ticker: 'O', name: 'Realty Income Corporation', sector: 'Real Estate', industry: 'Net Lease REITs' },
  { ticker: 'DLR', name: 'Digital Realty Trust', sector: 'Real Estate', industry: 'Data Center REITs' },
  { ticker: 'AVB', name: 'AvalonBay Communities', sector: 'Real Estate', industry: 'Residential REITs' },
  { ticker: 'EQR', name: 'Equity Residential', sector: 'Real Estate', industry: 'Residential REITs' },
  { ticker: 'VICI', name: 'VICI Properties', sector: 'Real Estate', industry: 'Gaming REITs' },
  { ticker: 'SBAC', name: 'SBA Communications', sector: 'Real Estate', industry: 'Tower REITs' },
  { ticker: 'WY', name: 'Weyerhaeuser Company', sector: 'Real Estate', industry: 'Timber REITs' },
  { ticker: 'ARE', name: 'Alexandria Real Estate', sector: 'Real Estate', industry: 'Office REITs' },
  { ticker: 'EXR', name: 'Extra Space Storage', sector: 'Real Estate', industry: 'Storage REITs' },
  { ticker: 'MAA', name: 'Mid-America Apartment', sector: 'Real Estate', industry: 'Residential REITs' },
  { ticker: 'IRM', name: 'Iron Mountain', sector: 'Real Estate', industry: 'Specialty REITs' },
  { ticker: 'VTR', name: 'Ventas Inc.', sector: 'Real Estate', industry: 'Healthcare REITs' },
  { ticker: 'KIM', name: 'Kimco Realty', sector: 'Real Estate', industry: 'Retail REITs' },
  
  // Communication Services (30 stocks)
  { ticker: 'GOOG', name: 'Alphabet Inc. Class C', sector: 'Communication Services', industry: 'Internet Services' },
  { ticker: 'T', name: 'AT&T Inc.', sector: 'Communication Services', industry: 'Telecom' },
  { ticker: 'VZ', name: 'Verizon Communications', sector: 'Communication Services', industry: 'Telecom' },
  { ticker: 'TMUS', name: 'T-Mobile US Inc.', sector: 'Communication Services', industry: 'Wireless' },
  { ticker: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services', industry: 'Streaming' },
  { ticker: 'DIS', name: 'The Walt Disney Company', sector: 'Communication Services', industry: 'Entertainment' },
  { ticker: 'CMCSA', name: 'Comcast Corporation', sector: 'Communication Services', industry: 'Cable' },
  { ticker: 'WBD', name: 'Warner Bros. Discovery', sector: 'Communication Services', industry: 'Entertainment' },
  { ticker: 'CHTR', name: 'Charter Communications', sector: 'Communication Services', industry: 'Cable' },
  { ticker: 'EA', name: 'Electronic Arts', sector: 'Communication Services', industry: 'Gaming' },
  { ticker: 'TTWO', name: 'Take-Two Interactive', sector: 'Communication Services', industry: 'Gaming' },
  { ticker: 'MTCH', name: 'Match Group Inc.', sector: 'Communication Services', industry: 'Internet Services' },
  { ticker: 'PARA', name: 'Paramount Global', sector: 'Communication Services', industry: 'Entertainment' },
  { ticker: 'FOX', name: 'Fox Corporation', sector: 'Communication Services', industry: 'Broadcasting' },
  { ticker: 'LYV', name: 'Live Nation Entertainment', sector: 'Communication Services', industry: 'Live Entertainment' },
  { ticker: 'OMC', name: 'Omnicom Group', sector: 'Communication Services', industry: 'Advertising' },
  { ticker: 'IPG', name: 'Interpublic Group', sector: 'Communication Services', industry: 'Advertising' },
  { ticker: 'RBLX', name: 'Roblox Corporation', sector: 'Communication Services', industry: 'Gaming' },
  { ticker: 'SPOT', name: 'Spotify Technology', sector: 'Communication Services', industry: 'Music Streaming' },
  { ticker: 'PINS', name: 'Pinterest Inc.', sector: 'Communication Services', industry: 'Social Media' },
];

// Helper to generate random number in range
function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Helper to generate random integer
function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max));
}

// Pick random catalysts
function pickCatalysts(): CatalystTag[] {
  const count = Math.random() > 0.7 ? randomInt(1, 3) : 0;
  const shuffled = [...CATALYST_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Generate realistic mock stock data
export function generateMockStocks(): Stock[] {
  return STOCK_DATA.map((stockInfo) => {
    const marketCap = randomInRange(5, 3000); // $5B to $3T
    const price = randomInRange(20, 800);
    const isHighQuality = marketCap > 100;
    
    // Generate correlated metrics
    const qualityScore = isHighQuality 
      ? randomInt(60, 95) 
      : randomInt(30, 70);
    
    const momentumScore = randomInt(20, 90);
    const valueScore = randomInt(25, 85);
    const sentimentScore = randomInt(30, 85);
    
    return {
      ticker: stockInfo.ticker,
      name: stockInfo.name,
      sector: stockInfo.sector,
      industry: stockInfo.industry,
      marketCap: Math.round(marketCap * 100) / 100,
      price: Math.round(price * 100) / 100,
      change1D: Math.round(randomInRange(-5, 5) * 100) / 100,
      change1W: Math.round(randomInRange(-10, 10) * 100) / 100,
      change1M: Math.round(randomInRange(-15, 15) * 100) / 100,
      change1Y: Math.round(randomInRange(-30, 60) * 100) / 100,
      volume: randomInt(500000, 50000000),
      avgVolume: randomInt(1000000, 30000000),
      
      // Valuation
      peRatio: Math.random() > 0.1 ? Math.round(randomInRange(10, 60) * 10) / 10 : null,
      forwardPE: Math.random() > 0.1 ? Math.round(randomInRange(8, 45) * 10) / 10 : null,
      pegRatio: Math.random() > 0.2 ? Math.round(randomInRange(0.5, 3) * 100) / 100 : null,
      priceToBook: Math.random() > 0.1 ? Math.round(randomInRange(1, 15) * 10) / 10 : null,
      evToEbitda: Math.random() > 0.1 ? Math.round(randomInRange(6, 25) * 10) / 10 : null,
      evToSales: Math.random() > 0.1 ? Math.round(randomInRange(1, 15) * 10) / 10 : null,
      
      // Profitability
      grossMargin: Math.round(randomInRange(20, 80) * 10) / 10,
      operatingMargin: Math.round(randomInRange(5, 40) * 10) / 10,
      netMargin: Math.round(randomInRange(2, 30) * 10) / 10,
      roe: Math.round(randomInRange(5, 40) * 10) / 10,
      roic: Math.round(randomInRange(5, 35) * 10) / 10,
      
      // Growth
      revenueGrowth: Math.round(randomInRange(-10, 40) * 10) / 10,
      earningsGrowth: Math.round(randomInRange(-20, 60) * 10) / 10,
      fcfYield: Math.round(randomInRange(1, 8) * 100) / 100,
      
      // Scores
      qualityScore,
      momentumScore,
      valueScore,
      sentimentScore,
      
      // Catalysts
      catalysts: pickCatalysts(),
      
      updatedAt: new Date().toISOString(),
    };
  });
}

// Singleton instance
let stocksCache: Stock[] | null = null;

export function getMockStocks(): Stock[] {
  if (!stocksCache) {
    stocksCache = generateMockStocks();
  }
  return stocksCache;
}

// Get stock by ticker
export function getStockByTicker(ticker: string): Stock | undefined {
  return getMockStocks().find(s => s.ticker === ticker);
}

// Get stocks by sector
export function getStocksBySector(sector: Sector): Stock[] {
  return getMockStocks().filter(s => s.sector === sector);
}

// Get top stocks by score
export function getTopStocksByScore(
  scoreType: 'qualityScore' | 'momentumScore' | 'valueScore' | 'sentimentScore',
  limit: number = 20
): Stock[] {
  return [...getMockStocks()]
    .sort((a, b) => b[scoreType] - a[scoreType])
    .slice(0, limit);
}

export { SECTORS, CATALYST_POOL };
