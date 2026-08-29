import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are AlphaStream, an institutional-grade AI investment assistant. You help advanced investors analyze portfolios, screen stocks, understand market regimes, and make informed investment decisions.

Your capabilities:
- Portfolio analysis and optimization suggestions
- Stock screening and fundamental analysis
- Macro regime interpretation
- Factor exposure analysis
- Risk assessment

Guidelines:
- Be precise, data-driven, and concise
- Use financial terminology appropriately
- When discussing stocks, mention tickers in uppercase (e.g., AAPL, MSFT)
- Provide actionable insights, not just information
- Acknowledge uncertainty and limitations
- Never provide specific buy/sell recommendations or guarantee returns

When the user provides portfolio context, use it to personalize your responses.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, portfolioContext } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with portfolio context
    let enhancedSystemPrompt = SYSTEM_PROMPT;
    if (portfolioContext) {
      enhancedSystemPrompt += `\n\nCurrent Portfolio Context:
- Total Value: $${portfolioContext.totalValue?.toLocaleString() || 'N/A'}
- YTD Return: ${portfolioContext.ytdReturn?.toFixed(2) || 'N/A'}%
- Volatility: ${portfolioContext.volatility?.toFixed(1) || 'N/A'}%
- Holdings: ${portfolioContext.holdingsCount || 0} positions
- Top Holdings: ${portfolioContext.topHoldings?.join(', ') || 'N/A'}
- Market Regime: ${portfolioContext.regime || 'Unknown'}`;
    }

    console.log("Starting AI chat with", messages.length, "messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return the streaming response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
