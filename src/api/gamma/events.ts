/**
 * Polymarket Gamma API - Events
 * Base: https://gamma-api.polymarket.com
 */

import { Market, Event } from "../../types/market";

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

function filterMarketsWithOutcomes(m: GammaMarket): boolean {
  const market = parseGammaMarket(m);
  return market.outcomes.length > 0;
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

export interface EventFilters {
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  active?: boolean;
  archived?: boolean;
  featured?: boolean;
  closed?: boolean;
  tagId?: number;
  tagSlug?: string;
  excludeTagId?: number[];
  slug?: string[];
  volumeMin?: number;
  volumeMax?: number;
  liquidityMin?: number;
  liquidityMax?: number;
  startDateMin?: string;
  startDateMax?: string;
  endDateMin?: string;
  endDateMax?: string;
}

function buildEventsQuery(filters: EventFilters): string {
  const params = new URLSearchParams();

  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  if (filters.order) params.set("order", filters.order);
  if (filters.ascending !== undefined) params.set("ascending", String(filters.ascending));
  if (filters.active !== undefined) params.set("active", String(filters.active));
  if (filters.archived !== undefined) params.set("archived", String(filters.archived));
  if (filters.featured !== undefined) params.set("featured", String(filters.featured));
  if (filters.closed !== undefined) params.set("closed", String(filters.closed));
  if (filters.tagId !== undefined) params.set("tag_id", String(filters.tagId));
  if (filters.tagSlug) params.set("tag_slug", filters.tagSlug);
  if (filters.excludeTagId?.length) params.set("exclude_tag_id", filters.excludeTagId.join(","));
  if (filters.slug?.length) params.set("slug", filters.slug.join(","));
  if (filters.volumeMin !== undefined) params.set("volume_min", String(filters.volumeMin));
  if (filters.volumeMax !== undefined) params.set("volume_max", String(filters.volumeMax));
  if (filters.liquidityMin !== undefined) params.set("liquidity_min", String(filters.liquidityMin));
  if (filters.liquidityMax !== undefined) params.set("liquidity_max", String(filters.liquidityMax));
  if (filters.startDateMin) params.set("start_date_min", filters.startDateMin);
  if (filters.startDateMax) params.set("start_date_max", filters.startDateMax);
  if (filters.endDateMin) params.set("end_date_min", filters.endDateMin);
  if (filters.endDateMax) params.set("end_date_max", filters.endDateMax);

  return params.toString();
}

export async function getActiveEvents(limit: number = 50, offset: number = 0): Promise<Event[]> {
  try {
    const query = buildEventsQuery({ limit, offset, active: true, order: "volume", ascending: false });
    const response = await fetch(`${GAMMA_API_BASE}/events?${query}`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: GammaEvent) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      slug: item.slug,
      startDate: item.startDate,
      endDate: item.endDate,
      seriesId: item.seriesId,
      seriesName: item.seriesTitle,
      markets: (item.markets || []).filter(filterMarketsWithOutcomes).map(parseGammaMarket),
      tags: item.tags,
      status: item.endDate && new Date(item.endDate) < new Date() ? "resolved" : (item.active ? "live" : "upcoming"),
    }));
  } catch (error) {
    console.error("Failed to fetch active events:", error);
    return [];
  }
}

export async function getEventById(eventId: string): Promise<Event | null> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/events?id=${encodeURIComponent(eventId)}`
    );

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
      title: item.title,
      description: item.description,
      slug: item.slug,
      startDate: item.startDate,
      endDate: item.endDate,
      seriesId: item.seriesId,
      seriesName: item.seriesTitle,
      markets: (item.markets || []).filter(filterMarketsWithOutcomes).map(parseGammaMarket),
      tags: item.tags,
      status: item.endDate && new Date(item.endDate) < new Date() ? "resolved" : (item.active ? "live" : "upcoming"),
    };
  } catch (error) {
    console.error("Failed to fetch event:", error);
    return null;
  }
}

export async function getEventsBySeries(seriesSlug: string, limit: number = 50, offset: number = 0): Promise<Event[]> {
  try {
    const query = buildEventsQuery({ limit, offset, order: "volume", ascending: false });
    const response = await fetch(`${GAMMA_API_BASE}/events?${query}&series=${encodeURIComponent(seriesSlug)}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: GammaEvent) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      slug: item.slug,
      startDate: item.startDate,
      endDate: item.endDate,
      seriesId: item.seriesId,
      seriesName: item.seriesTitle,
      markets: (item.markets || []).filter(filterMarketsWithOutcomes).map(parseGammaMarket),
      tags: item.tags,
      status: item.endDate && new Date(item.endDate) < new Date() ? "resolved" : (item.active ? "live" : "upcoming"),
    }));
  } catch (error) {
    console.error("Failed to fetch events by series:", error);
    return [];
  }
}
