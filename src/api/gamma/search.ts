/**
 * Polymarket Gamma API - Search
 * Base: https://gamma-api.polymarket.com
 */

import { Event, Market, Outcome, Tag } from "../../types/market";
import { buildGammaPublicSearchQuery } from "../queries";

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
  cache?: boolean;
  eventsStatus?: string;
  limitPerType?: number;
  page?: number;
  eventsTag?: string[];
  keepClosedMarkets?: boolean;
  sort?: string;
  ascending?: boolean;
  searchTags?: boolean;
  searchProfiles?: boolean;
  recurrence?: string;
  excludeTagId?: number[];
  optimized?: boolean;
}

export interface SearchPagination {
  hasMore: boolean;
  totalResults: number;
}

export interface SearchResult {
  events: Event[];
  markets: Market[];
  profiles: ProfileSearchResult[];
  tags: Tag[];
  pagination?: SearchPagination | null;
}

export interface ProfileSearchResult {
  id: string;
  address: string;
  username: string | null;
  avatarUrl: string | null;
  bio?: string | null;
}

interface GammaTag {
  id: string | number;
  slug?: string | null;
  label?: string | null;
  event_count?: number | null;
}

interface GammaSeriesRef {
  id?: string | number;
  slug?: string | null;
  title?: string | null;
}

interface GammaMarket {
  id: string;
  question: string | null;
  conditionId: string;
  slug?: string | null;
  endDate?: string | null;
  category?: string | null;
  liquidity?: string | number | null;
  liquidityNum?: number | null;
  description?: string | null;
  outcomes?: string | null;
  outcomePrices?: string | null;
  volume?: string | number | null;
  volumeNum?: number | null;
  volume24hr?: number | null;
  active?: boolean | null;
  closed?: boolean | null;
  oneDayPriceChange?: number | null;
  clobTokenIds?: string | null;
}

interface GammaEvent {
  id: string;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean | null;
  closed?: boolean | null;
  markets?: GammaMarket[] | null;
  tags?: GammaTag[] | null;
  series?: GammaSeriesRef[] | null;
}

interface GammaProfile {
  id: string | number;
  name?: string | null;
  pseudonym?: string | null;
  profileImage?: string | null;
  bio?: string | null;
  proxyWallet?: string | null;
}

interface SearchResponse {
  events?: GammaEvent[] | null;
  markets?: GammaMarket[] | null;
  profiles?: GammaProfile[] | null;
  tags?: GammaTag[] | null;
  pagination?: SearchPagination | null;
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

function normalizeProbability(value: unknown, fallback: number = 0.5): number {
  const parsed = parseNumeric(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return Math.min(1, Math.max(0, normalized));
}

function parseJsonArray(raw: string | null | undefined): string[] {
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
  const outcomePrices = parseJsonArray(market.outcomePrices).map((value) => normalizeProbability(value, 0.5));
  const clobTokenIds = parseJsonArray(market.clobTokenIds);
  const normalizedOutcomes = outcomes.length > 0 ? outcomes : ["Yes", "No"];

  const parsedOutcomes: Outcome[] = normalizedOutcomes.map((title, index) => ({
    id: clobTokenIds[index] || `outcome_${index}`,
    title,
    price: normalizeProbability(outcomePrices[index], 0.5),
    volume24h: 0,
    volume: 0,
    liquidity: 0,
    change24h: 0,
  }));

  return {
    id: market.id,
    title: market.question || "Unknown Market",
    description: market.description || "",
    slug: market.slug || undefined,
    outcomes: parsedOutcomes,
    volume24h: parseNumeric(market.volume24hr, 0),
    volume: parseNumeric(market.volumeNum ?? market.volume, 0),
    liquidity: parseNumeric(market.liquidityNum ?? market.liquidity, 0),
    change24h: parseNumeric(market.oneDayPriceChange, 0),
    openInterest: 0,
    resolutionDate: market.endDate ? new Date(market.endDate) : undefined,
    totalTrades: 0,
    category: market.category || "general",
    closed: market.closed ?? false,
    resolved: market.closed ?? false,
  };
}

function parseSearchStatus(event: GammaEvent): Event["status"] {
  if (event.closed) return "resolved";
  if (event.active) return "live";
  if (event.endDate) {
    const endTime = new Date(event.endDate).getTime();
    if (Number.isFinite(endTime) && endTime <= Date.now()) {
      return "resolved";
    }
  }
  return "upcoming";
}

function parseSearchEventsResponse(data: GammaEvent[]): Event[] {
  return data.map((item) => {
    const series = Array.isArray(item.series) ? item.series[0] : undefined;
    return {
      id: item.id,
      title: item.title || "Unknown Event",
      description: item.description || undefined,
      slug: item.slug || item.id,
      startDate: item.startDate || undefined,
      endDate: item.endDate || undefined,
      seriesId: series?.id ? String(series.id) : undefined,
      seriesName: series?.title || undefined,
      markets: Array.isArray(item.markets) ? item.markets.map(parseGammaMarketResponse) : [],
      tags: Array.isArray(item.tags)
        ? item.tags
            .map((tag) => tag.label || tag.slug || String(tag.id))
            .filter((tag): tag is string => Boolean(tag))
        : undefined,
      status: parseSearchStatus(item),
    };
  });
}

function parseSearchTagsResponse(data: GammaTag[]): Tag[] {
  return data.map((item) => ({
    id: String(item.id),
    slug: item.slug || String(item.id),
    name: item.label || item.slug || String(item.id),
    marketsCount: item.event_count ?? undefined,
  }));
}

function parseProfiles(data: GammaProfile[]): ProfileSearchResult[] {
  return data.map((profile) => ({
    id: String(profile.id),
    address: profile.proxyWallet || "",
    username: profile.pseudonym || profile.name || null,
    avatarUrl: profile.profileImage || null,
    bio: profile.bio || null,
  }));
}

function dedupeMarkets(markets: Market[]): Market[] {
  const deduped = new Map<string, Market>();
  for (const market of markets) {
    if (!deduped.has(market.id)) {
      deduped.set(market.id, market);
    }
  }
  return Array.from(deduped.values());
}

function collectMarketsFromSearch(data: SearchResponse, limit?: number): Market[] {
  const directMarkets = Array.isArray(data.markets) ? data.markets.map(parseGammaMarketResponse) : [];
  const marketsFromEvents = Array.isArray(data.events)
    ? parseSearchEventsResponse(data.events).flatMap((event) => event.markets)
    : [];
  const markets = dedupeMarkets([...directMarkets, ...marketsFromEvents]);
  return limit !== undefined ? markets.slice(0, limit) : markets;
}

function resolveEventsStatus(filters: SearchFilters): string | undefined {
  if (filters.eventsStatus) return filters.eventsStatus;
  if (filters.active === true && filters.closed !== true) return "active";
  if (filters.closed === true && filters.active !== true) return "closed";
  if (filters.active === true && filters.closed === true) return "all";
  return undefined;
}

function resolveEventsTags(filters: SearchFilters): string[] | undefined {
  const values = [...(filters.eventsTag ?? [])];
  if (filters.tagId !== undefined) values.push(String(filters.tagId));
  if (filters.tagSlug) values.push(filters.tagSlug);
  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

function resolveLimitPerType(filters: SearchFilters): number | undefined {
  return filters.limitPerType ?? filters.limit;
}

function resolvePage(filters: SearchFilters): number | undefined {
  if (filters.page !== undefined) return filters.page;
  const limitPerType = resolveLimitPerType(filters);
  if (filters.offset !== undefined && limitPerType && limitPerType > 0) {
    return Math.floor(filters.offset / limitPerType) + 1;
  }
  return undefined;
}

function buildSearchQuery(query: string, filters: SearchFilters): string {
  const trimmedQuery = query.trim();
  return buildGammaPublicSearchQuery({
    q: trimmedQuery,
    cache: filters.cache,
    events_status: resolveEventsStatus(filters),
    limit_per_type: resolveLimitPerType(filters),
    page: resolvePage(filters),
    events_tag: resolveEventsTags(filters),
    keep_closed_markets: filters.keepClosedMarkets || filters.closed ? 1 : undefined,
    sort: filters.sort,
    ascending: filters.ascending,
    search_tags: filters.searchTags ?? filters.tags,
    search_profiles: filters.searchProfiles ?? filters.profiles,
    recurrence: filters.recurrence,
    exclude_tag_id: filters.excludeTagId,
    optimized: filters.optimized,
  });
}

async function fetchSearchResponse(query: string, filters: SearchFilters = {}): Promise<SearchResponse> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return {};
  }

  const response = await fetch(`${GAMMA_API_BASE}/public-search?${buildSearchQuery(trimmedQuery, filters)}`);
  if (!response.ok) {
    throw new Error(`Public search API error: ${response.status}`);
  }

  return (await response.json()) as SearchResponse;
}

export async function publicSearch(query: string, filters: SearchFilters = {}): Promise<SearchResult> {
  try {
    const data = await fetchSearchResponse(query, filters);
    const limitPerType = resolveLimitPerType(filters);
    return {
      events: parseSearchEventsResponse(Array.isArray(data.events) ? data.events : []),
      markets: collectMarketsFromSearch(data, limitPerType),
      profiles: parseProfiles(Array.isArray(data.profiles) ? data.profiles : []),
      tags: parseSearchTagsResponse(Array.isArray(data.tags) ? data.tags : []),
      pagination: data.pagination ?? null,
    };
  } catch (error) {
    console.error("Failed to public search:", error);
    return { events: [], markets: [], profiles: [], tags: [], pagination: null };
  }
}

export async function search(query: string, filters: SearchFilters = {}): Promise<SearchResult> {
  return publicSearch(query, filters);
}

export async function searchEvents(query: string, limit: number = 20, offset: number = 0): Promise<Event[]> {
  const result = await publicSearch(query, {
    limit,
    offset,
    searchProfiles: false,
    searchTags: false,
  });
  return result.events;
}

export async function searchMarketsByQuery(query: string, limit: number = 20, offset: number = 0): Promise<Market[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0 || limit <= 0) return [];

  const targetCount = offset + limit;
  const accumulatedMarkets: Market[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && accumulatedMarkets.length < targetCount) {
    const result = await publicSearch(trimmedQuery, {
      limitPerType: limit,
      page,
      searchProfiles: false,
      searchTags: false,
    });

    accumulatedMarkets.push(...result.markets);
    hasMore = result.pagination?.hasMore ?? false;
    page += 1;

    if (result.markets.length === 0) {
      break;
    }
  }

  return dedupeMarkets(accumulatedMarkets).slice(offset, offset + limit);
}

export async function searchProfiles(query: string, limit: number = 20): Promise<ProfileSearchResult[]> {
  const result = await publicSearch(query, {
    limit,
    searchProfiles: true,
    searchTags: false,
  });
  return result.profiles;
}

export async function searchTags(query: string, limit: number = 20, offset: number = 0): Promise<Tag[]> {
  const result = await publicSearch(query, {
    limit,
    offset,
    searchProfiles: false,
    searchTags: true,
  });
  return result.tags;
}
