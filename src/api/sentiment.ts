import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { Market } from "../types/market";
import { getActiveAIProvider } from "../state";

export interface SentimentAnalysis {
  marketId: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  keyFactors: string[];
  timestamp: number;
}

function normalizeResponseJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseSentiment(raw: string): {
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  keyFactors: string[];
} {
  const cleaned = normalizeResponseJson(raw);
  const parsed = JSON.parse(cleaned) as {
    sentiment?: string;
    confidence?: number;
    summary?: string;
    keyFactors?: string[];
  };

  const sentiment =
    parsed.sentiment === "bullish" || parsed.sentiment === "bearish" || parsed.sentiment === "neutral"
      ? parsed.sentiment
      : "neutral";

  return {
    sentiment,
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence ?? 50))),
    summary: String(parsed.summary ?? "No analysis available"),
    keyFactors: Array.isArray(parsed.keyFactors)
      ? parsed.keyFactors.map(String).filter(Boolean)
      : [],
  };
}

function resolveSentimentModel():
  | { model: unknown; providerLabel: string }
  | { error: string } {
  const provider = getActiveAIProvider();
  if (!provider) {
    return { error: "No AI provider configured" };
  }

  const apiKey = (provider.apiKey ?? "").trim();
  if (!apiKey) {
    return {
      error: `Provider \"${provider.name}\" has no API key`,
    };
  }

  const modelId = provider.model.trim();
  if (!modelId) {
    return {
      error: `Provider \"${provider.name}\" has no model id`,
    };
  }

  if (provider.kind === "anthropic") {
    const anthropic = createAnthropic({
      apiKey,
      baseURL: provider.baseUrl,
    });

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: anthropic(modelId) as any,
      providerLabel: `${provider.name} / ${modelId}`,
    };
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: provider.baseUrl,
    headers:
      provider.kind === "openrouter"
        ? {
            "HTTP-Referer": "https://polymarket-tui.local",
            "X-Title": "Polymarket Bloomberg TUI",
          }
        : undefined,
  });

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: openai(modelId) as any,
    providerLabel: `${provider.name} / ${modelId}`,
  };
}

export function getSentimentProviderError(): string | null {
  const resolved = resolveSentimentModel();
  if ("error" in resolved) {
    return `${resolved.error}. Configure Settings > PROVIDERS.`;
  }
  return null;
}

export async function analyzeMarketSentiment(market: Market): Promise<SentimentAnalysis | null> {
  const resolved = resolveSentimentModel();
  if ("error" in resolved) {
    return null;
  }

  const outcomesInfo = market.outcomes?.map((outcome) =>
    `${outcome.title}: ${(outcome.price * 100).toFixed(1)}¢ (Vol: $${((outcome.volume || 0) / 1000).toFixed(1)}K)`
  ).join(", ") || "Binary outcome market";

  const prompt = `You are a financial analyst specializing in prediction markets. Analyze the following Polymarket market and provide a brief sentiment assessment.

PROVIDER: ${resolved.providerLabel}
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
    const result = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: resolved.model as any,
      prompt,
      maxTokens: 900,
      temperature: 0.2,
    });

    const parsed = parseSentiment(result.text.trim());

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

  const bullishCount = analyses.filter((item) => item.sentiment === "bullish").length;
  const bearishCount = analyses.filter((item) => item.sentiment === "bearish").length;
  const avgConfidence = analyses.reduce((sum, item) => sum + item.confidence, 0) / analyses.length;

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
