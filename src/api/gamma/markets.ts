/**
 * Polymarket Gamma API - Markets
 * Base: https://gamma-api.polymarket.com
 */

import { Market, Outcome, PriceHistory, PricePoint } from "../../types/market";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

interface GammaMarket {
  id: string;
  question: string | null;
  conditionId: string;
  slug: string | null;
  endDate: string | null;
  category: string | null;
  liquidity: string | null;
  description: string | null;
  outcomes: string | null;
  outcomePrices: string | null;
  volume: string | null;
  active: boolean | null;
  closed: boolean | null;
  volumeNum: number | null;
  liquidityNum: number | null;
  volume24hr: number | null;
  oneDayPriceChange: number | null;
  clobTokenIds: string | null;
  groupItemTitle?: string | null;
  tags?: string[] | null;
}

function parseNumeric(value: unknown, fallback: number = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseGammaMarket(market: GammaMarket): Market {
  const outcomes = parseJsonArray(market.outcomes);
  const outcomePrices = parseJsonArray(market.outcomePrices).map((value) => parseNumeric(value, 0.5));
  const clobTokenIds = parseJsonArray(market.clobTokenIds);

  const normalizedOutcomes = outcomes.length > 0 ? outcomes : ["Yes", "No"];

  const outcomeList: Outcome[] = normalizedOutcomes.map((title: string, i: number) => ({
    id: clobTokenIds[i] || `outcome_${i}`,
    title,
    price: parseNumeric(outcomePrices[i], 0.5),
    volume24h: 0,
    volume: 0,
    liquidity: 0,
    change24h: 0,
  }));

  return {
    id: market.id,
    title: market.question || "Unknown Market",
    description: market.description || "",
    outcomes: outcomeList,
    volume24h: parseNumeric(market.volume24hr, 0),
    volume: parseNumeric(market.volume, 0),
    liquidity: parseNumeric(market.liquidity, parseNumeric(market.liquidityNum, 0)),
    change24h: parseNumeric(market.oneDayPriceChange, 0),
    openInterest: 0,
    resolutionDate: market.endDate ? new Date(market.endDate) : undefined,
    totalTrades: 0,
    category: market.category || "general",
    closed: market.closed || false,
    resolved: false,
  };
}

export async function getMarkets(limit: number = 50): Promise<Market[]> {
  const response = await fetch(
    `${GAMMA_API_BASE}/markets?limit=${limit}&closed=false&order=volumeNum&ascending=false`
  );

  if (!response.ok) {
    throw new Error(`Gamma API error: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected Gamma API response format");
  }

  return data
    .map((item) => parseGammaMarket(item as GammaMarket))
    .filter((market) => market.outcomes.length > 0);
}

export async function getMarketDetails(marketId: string): Promise<Market | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets?id=${marketId}`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return parseGammaMarket(data[0]);
  } catch (error) {
    console.error("Failed to fetch market details:", error);
    return null;
  }
}

export async function getMarketsByCategory(category: string, limit: number = 50): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=${limit}&closed=false&category=${encodeURIComponent(category)}&order=volumeNum&ascending=false`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch markets by category:", error);
    return [];
  }
}

export async function searchMarkets(query: string): Promise<Market[]> {
  const allMarkets = await getMarkets(100);
  return allMarkets.filter(
    (m) =>
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(query.toLowerCase()))
  );
}

export async function getTrendingMarkets(limit: number = 20): Promise<Market[]> {
  return getMarkets(limit);
}

export async function getLiveSportsMarkets(): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=200&closed=false&order=volumeNum&ascending=false`
    );

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    const sportsKeywords = [
      "nba", "nfl", "nhl", "mlb", "ncaa", "soccer", "football",
      "basketball", "baseball", "hockey", "ufc", "mma", "tennis",
      "golf", "boxing", "cricket", "rugby", "world cup", "olympics"
    ];

    return data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => {
        if (market.outcomes.length === 0) return false;
        const titleLower = market.title.toLowerCase();
        const categoryLower = (market.category || "").toLowerCase();
        return sportsKeywords.some((kw) => titleLower.includes(kw) || categoryLower.includes(kw));
      })
      .slice(0, 50);
  } catch (error) {
    console.error("Failed to fetch live sports markets:", error);
    return [];
  }
}
