/**
 * Polymarket Gamma API - Series
 * Base: https://gamma-api.polymarket.com
 */

import { Market, Series } from "../../types/market";

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

interface GammaSeries {
  id: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  category?: string;
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

  return {
    id: market.id,
    title: market.question || "Unknown Market",
    description: market.description || "",
    outcomes: normalizedOutcomes.map((title: string, i: number) => ({
      id: clobTokenIds[i] || `outcome_${i}`,
      title,
      price: parseNumeric(outcomePrices[i], 0.5),
      volume24h: 0,
      volume: 0,
      liquidity: 0,
      change24h: 0,
    })),
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

export async function getSeries(): Promise<Series[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/series`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: GammaSeries) => ({
      id: item.id,
      slug: item.slug,
      name: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      category: item.category,
    }));
  } catch (error) {
    console.error("Failed to fetch series:", error);
    return [];
  }
}

export async function getSeriesById(seriesId: string): Promise<Series | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/series?id=${encodeURIComponent(seriesId)}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const item = data[0];
    return {
      id: item.id,
      slug: item.slug,
      name: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      category: item.category,
    };
  } catch (error) {
    console.error("Failed to fetch series:", error);
    return null;
  }
}

export async function getMarketsBySeries(seriesSlug: string, limit: number = 50): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=${limit}&closed=false&series=${encodeURIComponent(seriesSlug)}&order=volumeNum&ascending=false`
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
    console.error("Failed to fetch markets by series:", error);
    return [];
  }
}
