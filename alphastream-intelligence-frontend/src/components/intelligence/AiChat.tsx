import { usePortfolio } from '@/context/PortfolioContext';
import { useMarket } from '@/context/MarketContext';
import { Badge } from '@/components/ui/badge';
import { Briefcase, TrendingUp, Database } from 'lucide-react';
import { ChatInterface, ModelId } from '@/components/chat/ChatInterface';

const SUGGESTED_PROMPTS = [
  "What's my current portfolio risk exposure?",
  "Which sectors are overweight in my portfolio?",
  "Summarize the current market regime",
  "What quality stocks should I watch today?",
  "How can I reduce volatility in my portfolio?",
];

export function AiChat() {
  const { summary, holdings } = usePortfolio();
  const { regime } = useMarket();

  // Build portfolio context for AI
  const getPortfolioContext = () => ({
    totalValue: summary.totalValue,
    ytdReturn: summary.ytdReturn,
    volatility: summary.volatility,
    holdingsCount: holdings.length,
    topHoldings: holdings
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((h) => h.ticker),
    regime,
  });

  const handleSubmit = async (message: string, model: ModelId): Promise<string> => {
    // This is where you would integrate with your actual AI backend
    // For now, return a mock response
    const context = getPortfolioContext();
    
    try {
      // Mock response - in production, this would call your AI service
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      return `Based on your portfolio with ${context.holdingsCount} holdings and $${context.totalValue.toLocaleString()} total value:\n\n"${message}"\n\nYour current YTD return is ${context.ytdReturn}% with ${context.volatility}% volatility. The market regime is ${context.regime}. Your top holdings are ${context.topHoldings.join(', ')}.\n\nThis is a mock response - integrate with your AI backend for real analysis.`;
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Context Badges */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Context
        </span>
        <Badge variant="outline" className="text-[10px] gap-1">
          <Briefcase className="h-3 w-3" />
          Portfolio Connected
        </Badge>
        <Badge variant="outline" className="text-[10px] gap-1">
          <TrendingUp className="h-3 w-3" />
          Regime: {regime}
        </Badge>
        <Badge variant="outline" className="text-[10px] gap-1">
          <Database className="h-3 w-3" />
          ~500 US Equities
        </Badge>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 min-h-0">
        <ChatInterface
          contextType="portfolio"
          contextLabel="Portfolio"
          placeholder="Ask about your portfolio, market conditions, or stock analysis..."
          suggestedPrompts={SUGGESTED_PROMPTS}
          onSubmit={handleSubmit}
          className="h-full rounded-none border-0"
        />
      </div>
    </div>
  );
}
