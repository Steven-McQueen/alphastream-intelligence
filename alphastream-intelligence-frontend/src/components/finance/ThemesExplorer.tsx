import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Compass, Filter, ArrowRight } from 'lucide-react';

// Theme tiles with screener filter mapping
const THEMES = [
  {
    id: 'us-tech',
    title: 'US Tech – Quality Compounders',
    description: 'High-ROIC technology leaders with durable competitive advantages.',
    type: 'Sector',
    screenCriteria: 'ROIC > 20%, FCF Yield > 3%',
    sector: 'Technology',
    filters: [{ field: 'roe', operator: 'gt', value: 15 }],
  },
  {
    id: 'healthcare',
    title: 'Healthcare – Defensive Growth',
    description: 'Recession-resistant healthcare names with steady earnings growth.',
    type: 'Sector',
    screenCriteria: 'EPS Growth > 10%, Beta < 1',
    sector: 'Healthcare',
    filters: [{ field: 'beta', operator: 'lt', value: 1 }],
  },
  {
    id: 'energy',
    title: 'Energy – High Yield',
    description: 'Integrated majors and E&P companies with strong cash generation.',
    type: 'Sector',
    screenCriteria: 'Dividend Yield > 3%',
    sector: 'Energy',
    filters: [{ field: 'dividendYield', operator: 'gt', value: 0.03 }],
  },
  {
    id: 'financials',
    title: 'Financials – Value Play',
    description: 'Banks and financial services trading at attractive valuations.',
    type: 'Sector',
    screenCriteria: 'P/E < 15, ROE > 10%',
    sector: 'Financials',
    filters: [{ field: 'peRatio', operator: 'lt', value: 15 }],
  },
  {
    id: 'consumer-discretionary',
    title: 'Consumer Discretionary',
    description: 'Retail and consumer goods with strong market positions.',
    type: 'Sector',
    screenCriteria: 'Gross Margin > 30%',
    sector: 'Consumer Discretionary',
    filters: [{ field: 'grossMargin', operator: 'gt', value: 0.3 }],
  },
  {
    id: 'quality-dividend',
    title: 'Quality Dividend Growers',
    description: 'Companies with consistent dividend growth and strong balance sheets.',
    type: 'Theme',
    screenCriteria: 'Dividend > 2%, ROE > 15%',
    sector: null,
    filters: [
      { field: 'dividendYield', operator: 'gt', value: 0.02 },
      { field: 'roe', operator: 'gt', value: 0.15 },
    ],
  },
  {
    id: 'low-beta',
    title: 'Low Beta Defensives',
    description: 'Stable stocks with lower market sensitivity for risk-averse portfolios.',
    type: 'Theme',
    screenCriteria: 'Beta < 0.8',
    sector: null,
    filters: [{ field: 'beta', operator: 'lt', value: 0.8 }],
  },
  {
    id: 'value-stocks',
    title: 'Deep Value Opportunities',
    description: 'Undervalued stocks with strong earnings potential.',
    type: 'Theme',
    screenCriteria: 'P/E < 12, EPS > 0',
    sector: null,
    filters: [
      { field: 'peRatio', operator: 'lt', value: 12 },
      { field: 'eps', operator: 'gt', value: 0 },
    ],
  },
];

export function ThemesExplorer() {
  const navigate = useNavigate();

  const handleExplore = (theme: typeof THEMES[0]) => {
    // Build URL params for screener
    const params = new URLSearchParams();
    
    // Add sector filter if present
    if (theme.sector) {
      params.set('sector', theme.sector);
    }
    
    // Add ratio filters as JSON
    if (theme.filters && theme.filters.length > 0) {
      params.set('filters', JSON.stringify(theme.filters));
    }
    
    navigate(`/screener?${params.toString()}`);
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Compass className="h-5 w-5" />
          Themes & Sectors to Explore
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className="group bg-muted/30 rounded-lg p-4 border border-border/50 hover:border-primary/50 transition-all hover:bg-muted/50"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-sm leading-tight">{theme.title}</h3>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 ml-2 flex-shrink-0"
                >
                  {theme.type}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                {theme.description}
              </p>
              <p className="text-[10px] text-primary/70 mb-3 flex items-center gap-1">
                <Filter className="h-3 w-3" />
                {theme.screenCriteria}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                onClick={() => handleExplore(theme)}
              >
                Open Screener
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
