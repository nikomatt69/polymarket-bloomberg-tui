import Anthropic from "@anthropic-ai/sdk";
import { Market } from "../types/market";

export interface SentimentAnalysis {
  marketId: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  keyFactors: string[];
  timestamp: number;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

export async function analyzeMarketSentiment(market: Market): Promise<SentimentAnalysis | null> {
  if (!anthropic) {
    console.warn("ANTHROPIC_API_KEY not set");
    return null;
  }

  const outcomesInfo = market.outcomes?.map(o => 
    `${o.title}: ${(o.price * 100).toFixed(1)}¢ (Vol: $${(o.volume || 0 / 1000).toFixed(1)}K)`
  ).join(", ") || "Binary outcome market";

  const prompt = `You are a financial analyst specializing in prediction markets. Analyze the following Polymarket market and provide a brief sentiment assessment.

MARKET: ${market.title}
${market.description ? `DESCRIPTION: ${market.description}` : ""}
CURRENT PRICES: ${outcomesInfo}
24H VOLUME: $${((market.volume24h || 0) / 1000).toFixed(1)}K
24H CHANGE: ${(market.change24h || 0).toFixed(1)}%

Provide your analysis in this exact JSON format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "summary": "2-3 sentence summary of the market direction",
  "keyFactors": ["factor 1", "factor 2", "factor 3"]
}

Respond only with valid JSON, no other text.`;

  try {
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.content[0].type === "text" ? result.content[0].text.trim() : "";
    const parsed = JSON.parse(text);

    return {
      marketId: market.id,
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
      summary: parsed.summary,
      keyFactors: parsed.keyFactors,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Failed to analyze sentiment:", error);
    return null;
  }
}

export async function analyzeMultipleMarkets(markets: Market[]): Promise<SentimentAnalysis[]> {
  const results: SentimentAnalysis[] = [];
  
  for (const market of markets.slice(0, 5)) {
    const analysis = await analyzeMarketSentiment(market);
    if (analysis) {
      results.push(analysis);
    }
  }
  
  return results;
}

export function getOverallMarketSentiment(analyses: SentimentAnalysis[]): {
  sentiment: "bullish" | "bearish" | "neutral";
  avgConfidence: number;
  marketCount: number;
} {
  if (analyses.length === 0) {
    return { sentiment: "neutral", avgConfidence: 0, marketCount: 0 };
  }

  const bullishCount = analyses.filter(a => a.sentiment === "bullish").length;
  const bearishCount = analyses.filter(a => a.sentiment === "bearish").length;
  const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

  let sentiment: "bullish" | "bearish" | "neutral";
  if (bullishCount > bearishCount) {
    sentiment = "bullish";
  } else if (bearishCount > bullishCount) {
    sentiment = "bearish";
  } else {
    sentiment = "neutral";
  }

  return { sentiment, avgConfidence, marketCount: analyses.length };
}
