/**
 * Polymarket Gamma API - Search
 * Base: https://gamma-api.polymarket.com
 */

import { Market, Event, Tag, Outcome } from "../../types/market";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export interface SearchFilters {
  limit?: number;
  offset?: number;
  events?: boolean;
  markets?: boolean;
  profiles?: boolean;
  tags?: boolean;
  active?: boolean;
  closed?: boolean;
  tagId?: number;
  tagSlug?: string;
}

export interface SearchResult {
  events: Event[];
  markets: Market[];
  profiles: ProfileSearchResult[];
  tags: Tag[];
}

export interface ProfileSearchResult {
  id: string;
  address: string;
  username: string | null;
  avatarUrl: string | null;
}

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

function parseGammaMarketResponse(market: GammaMarket): Market {
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

interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  seriesId?: string;
  seriesTitle?: string;
  markets?: GammaMarket[];
  tags?: string[];
  active?: boolean;
}

function parseSearchEventsResponse(data: GammaEvent[]): Event[] {
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    slug: item.slug,
    startDate: item.startDate,
    endDate: item.endDate,
    seriesId: item.seriesId,
    seriesName: item.seriesTitle,
    markets: (item.markets || []).map(parseGammaMarketResponse),
    tags: item.tags,
    status: item.endDate && new Date(item.endDate) < new Date() ? "resolved" : (item.active ? "live" : "upcoming"),
  }));
}

interface GammaTag {
  id: string;
  slug: string;
  label: string;
}

function parseSearchTagsResponse(data: GammaTag[]): Tag[] {
  return data.map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.label,
  }));
}

function buildSearchQuery(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  if (filters.events !== undefined) params.set("events", String(filters.events));
  if (filters.markets !== undefined) params.set("markets", String(filters.markets));
  if (filters.profiles !== undefined) params.set("profiles", String(filters.profiles));
  if (filters.tags !== undefined) params.set("tags", String(filters.tags));
  if (filters.active !== undefined) params.set("active", String(filters.active));
  if (filters.closed !== undefined) params.set("closed", String(filters.closed));
  if (filters.tagId !== undefined) params.set("tag_id", String(filters.tagId));
  if (filters.tagSlug) params.set("tag_slug", filters.tagSlug);

  return params;
}

interface SearchResponse {
  events?: GammaEvent[];
  markets?: GammaMarket[];
  profiles?: ProfileSearchResult[];
  tags?: GammaTag[];
}

export async function search(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResult> {
  try {
    const params = buildSearchQuery(filters);
    params.set("q", query);

    const response = await fetch(`${GAMMA_API_BASE}/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = (await response.json()) as SearchResponse;

    return {
      events: parseSearchEventsResponse(data.events || []),
      markets: (data.markets || []).map(parseGammaMarketResponse),
      profiles: data.profiles || [],
      tags: parseSearchTagsResponse(data.tags || []),
    };
  } catch (error) {
    console.error("Failed to search:", error);
    return { events: [], markets: [], profiles: [], tags: [] };
  }
}

export async function searchEvents(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<Event[]> {
  try {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("events", "true");

    const response = await fetch(`${GAMMA_API_BASE}/search?${params.toString()}`);

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as SearchResponse;
    return parseSearchEventsResponse(data.events || []);
  } catch (error) {
    console.error("Failed to search events:", error);
    return [];
  }
}

export async function searchMarketsByQuery(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<Market[]> {
  try {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("markets", "true");

    const response = await fetch(`${GAMMA_API_BASE}/search?${params.toString()}`);

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as SearchResponse;
    return (data.markets || []).map(parseGammaMarketResponse);
  } catch (error) {
    console.error("Failed to search markets:", error);
    return [];
  }
}

export async function searchTags(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<Tag[]> {
  try {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("tags", "true");

    const response = await fetch(`${GAMMA_API_BASE}/search?${params.toString()}`);

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as SearchResponse;
    return parseSearchTagsResponse(data.tags || []);
  } catch (error) {
    console.error("Failed to search tags:", error);
    return [];
  }
}
