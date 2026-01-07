import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

type Indicator = 'US 10Y Yield' | 'CPI YoY' | 'VIX';

const INDICATOR_COLORS: Record<Indicator, string> = {
  'US 10Y Yield': 'hsl(217, 91%, 60%)',
  'CPI YoY': 'hsl(38, 92%, 50%)',
  'VIX': 'hsl(280, 65%, 60%)',
};

export function MacroCharts() {
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator>('US 10Y Yield');
  const [treasuryData, setTreasuryData] = useState<any[]>([]);
  const [cpiData, setCpiData] = useState<any[]>([]);
  const [vixData, setVixData] = useState<any[]>([]);

  useEffect(() => {
    const fetchTreasury = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/macro/treasury-history?days=365');
        const data = await response.json();
        const chartData = (data || []).map((item: any) => ({
          date: item.date,
          value: item.yield_10y,
          displayDate: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }));
        setTreasuryData(chartData);
      } catch (error) {
        console.error('Failed to fetch treasury data:', error);
      }
    };

    const fetchCpi = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/macro/cpi-history?months=12');
        const data = await response.json();
        const chartData = (data || []).map((item: any) => ({
          date: item.date,
          value: item.yoy_change,
          displayDate: new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        }));
        setCpiData(chartData);
      } catch (error) {
        console.error('Failed to fetch CPI data:', error);
      }
    };

    const fetchVix = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/macro/vix-history?days=365');
        const data = await response.json();
        const chartData = (data || []).map((item: any) => ({
          date: item.date,
          value: item.vix_value,
          displayDate: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }));
        setVixData(chartData);
      } catch (error) {
        console.error('Failed to fetch VIX data:', error);
      }
    };

    fetchTreasury();
    fetchCpi();
    fetchVix();
  }, []);

  const chartData = useMemo(() => {
    switch (selectedIndicator) {
      case 'US 10Y Yield':
        return treasuryData;
      case 'CPI YoY':
        return cpiData;
      case 'VIX':
        return vixData;
      default:
        return [];
    }
  }, [selectedIndicator, treasuryData, cpiData, vixData]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const values = chartData.map((d) => d.value).filter((v) => typeof v === 'number');
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const padding = (maxValue - minValue) * 0.1;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm mb-1">{point.displayDate}</p>
          <p className="text-white font-semibold">
            {payload[0].value?.toFixed(2)}
            {selectedIndicator.includes('Yield') || selectedIndicator.includes('YoY') ? '%' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Macro Time Series</CardTitle>
          <Tabs
            value={selectedIndicator}
            onValueChange={(v) => setSelectedIndicator(v as Indicator)}
          >
            <TabsList className="h-7">
              <TabsTrigger value="US 10Y Yield" className="text-xs h-6 px-2">
                10Y Yield
              </TabsTrigger>
              <TabsTrigger value="CPI YoY" className="text-xs h-6 px-2">
                CPI
              </TabsTrigger>
              <TabsTrigger value="VIX" className="text-xs h-6 px-2">
                VIX
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                domain={[minValue - padding, maxValue + padding]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                tickFormatter={(value) => value.toFixed(1)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={INDICATOR_COLORS[selectedIndicator]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: INDICATOR_COLORS[selectedIndicator] }}
              />
              {/* Reference line at current value */}
              <ReferenceLine
                y={chartData[chartData.length - 1]?.value}
                stroke={INDICATOR_COLORS[selectedIndicator]}
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Current Value Display */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">Current</span>
          <span className="font-mono font-semibold">
            {chartData[chartData.length - 1]?.value.toFixed(2)}
            {selectedIndicator.includes('Yield') || selectedIndicator.includes('YoY') ? '%' : ''}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
