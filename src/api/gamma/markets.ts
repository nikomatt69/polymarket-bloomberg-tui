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

export interface MarketFilters {
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  closed?: boolean;
  tagId?: number;
  tagSlug?: string;
  category?: string;
  volumeNumMin?: number;
  volumeNumMax?: number;
  liquidityNumMin?: number;
  liquidityNumMax?: number;
  startDateMin?: string;
  startDateMax?: string;
  endDateMin?: string;
  endDateMax?: string;
  sportsMarketTypes?: string[];
  active?: boolean;
}

function buildMarketsQuery(filters: MarketFilters): string {
  const params = new URLSearchParams();

  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  if (filters.order) params.set("order", filters.order);
  if (filters.ascending !== undefined) params.set("ascending", String(filters.ascending));
  if (filters.closed !== undefined) params.set("closed", String(filters.closed));
  if (filters.tagId !== undefined) params.set("tag_id", String(filters.tagId));
  if (filters.tagSlug) params.set("tag", filters.tagSlug);
  if (filters.volumeNumMin !== undefined) params.set("volume_num_min", String(filters.volumeNumMin));
  if (filters.volumeNumMax !== undefined) params.set("volume_num_max", String(filters.volumeNumMax));
  if (filters.liquidityNumMin !== undefined) params.set("liquidity_num_min", String(filters.liquidityNumMin));
  if (filters.liquidityNumMax !== undefined) params.set("liquidity_num_max", String(filters.liquidityNumMax));
  if (filters.startDateMin) params.set("start_date_min", filters.startDateMin);
  if (filters.startDateMax) params.set("start_date_max", filters.startDateMax);
  if (filters.endDateMin) params.set("end_date_min", filters.endDateMin);
  if (filters.endDateMax) params.set("end_date_max", filters.endDateMax);
  if (filters.sportsMarketTypes?.length) params.set("sports_market_types", filters.sportsMarketTypes.join(","));
  if (filters.active !== undefined) params.set("active", String(filters.active));

  return params.toString();
}

export async function getMarkets(limit: number = 50, offset: number = 0): Promise<Market[]> {
  const query = buildMarketsQuery({ limit, offset, closed: false, order: "volumeNum", ascending: false });
  const response = await fetch(`${GAMMA_API_BASE}/markets?${query}`);

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

// Keywords for filtering markets by category
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Sports: ["nba", "nfl", "nhl", "mlb", "ncaa", "soccer", "football", "basketball", "baseball", "hockey", "ufc", "mma", "tennis", "golf", "boxing", "cricket", "rugby", "world cup", "olympics", "espn", "wwe", "nba", "falcons", "mavericks", "lakers", "warriors", "player prop", "game prop", "matchup", "season"],
  Politics: ["trump", "biden", "election", "president", "congress", "senate", "house", "republican", "democrat", "poll", "governor", "mayor", "parliament", "prime minister", "court", "supreme court", "impeach", "vote", "referendum", "policy"],
  Crypto: ["bitcoin", "btc", "ethereum", "eth", "solana", "crypto", "blockchain", "ether", "binance", "coinbase", "defi", "nft", "token", "ordinal", " ETF", "hashrate", "miner", "halving", "wallet", "exchange"],
  Business: ["fed", "interest rate", "inflation", "gdp", "unemployment", "stock market", "sp500", "dow", "nasdaq", "apple", "google", "microsoft", "amazon", "tesla", "earnings", "revenue", "profit", "quarterly", "fed rate", "jobs", "economy"],
  Entertainment: ["oscar", "grammy", "emmy", "tony", "movie", "film", "music", "concert", "celebrity", "actor", "actress", "tv show", "netflix", "hbo", "streaming", "box office", "album", "song", "chart", "billboard"],
  Science: ["space", "nasa", "mars", "moon", "asteroid", "telescope", "climate", "weather", "earthquake", "volcano", "scientist", "research", "study", "discovery", "breakthrough"],
  AI: ["ai", "artificial intelligence", "openai", "chatgpt", "gpt", "claude", "gemini", "llm", "machine learning", "model", "neural", "anthropic", "google deepmind", "microsoft ai", "autonomous", "robot"],
  NFTs: ["nft", "bored ape", "pudgy", "cryptopunk", "opensea", "blur", "floor price", "collection", "mint", "dao", "web3"],
  Coronavirus: ["covid", "coronavirus", "pandemic", "vaccine", "omicron", "variant", "cases", "deaths", "hospital", "mask", "lockdown"],
};

// Category to tag slug mapping for Polymarket categories
const CATEGORY_TAG_SLUGS: Record<string, string> = {
  Sports: "sports",
  Politics: "politics",
  Crypto: "cryptocurrency",
  Business: "business",
  Entertainment: "entertainment",
  Science: "science",
  AI: "artificial-intelligence",
  NFTs: "nft",
  Coronavirus: "covid-19",
};

export async function getMarketsByCategory(category: string, limit: number = 50, offset: number = 0): Promise<Market[]> {
  const tagSlug = CATEGORY_TAG_SLUGS[category];

  try {
    const query = buildMarketsQuery({
      limit,
      offset,
      closed: false,
      tagSlug: tagSlug || category.toLowerCase(),
      order: "volumeNum",
      ascending: false,
    });

    const response = await fetch(`${GAMMA_API_BASE}/markets?${query}`);

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
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=50&closed=false&question=${encodeURIComponent(query)}`
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
    console.error("Failed to search markets:", error);
    return [];
  }
}

export async function getTrendingMarkets(limit: number = 20, offset: number = 0): Promise<Market[]> {
  return getMarkets(limit, offset);
}

export async function getLiveSportsMarkets(limit: number = 50, offset: number = 0): Promise<Market[]> {
  try {
    const sportsMarketTypes = [
      "player_prop",
      "game_prop",
      "matchup",
      "season_win",
      "tournament",
    ];

    const query = buildMarketsQuery({
      limit,
      offset,
      closed: false,
      order: "volumeNum",
      ascending: false,
      sportsMarketTypes,
    });

    const response = await fetch(`${GAMMA_API_BASE}/markets?${query}`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch live sports markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional Market Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export async function getMarketBySlug(slug: string): Promise<Market | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets/slug/${encodeURIComponent(slug)}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return parseGammaMarket(data as GammaMarket);
  } catch (error) {
    console.error("Failed to fetch market by slug:", error);
    return null;
  }
}

export async function getMarketHistory(marketId: string): Promise<Array<{
  id: string;
  question: string;
  description: string;
  outcome: string;
  resolutionDate: string | null;
  resolvedAt: string | null;
  yesPrice: number;
  noPrice: number;
  volume: number;
}>> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets/${encodeURIComponent(marketId)}/history`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data;
  } catch (error) {
    console.error("Failed to fetch market history:", error);
    return [];
  }
}

export interface TopHolder {
  user: string;
  balance: string;
  balanceNum: number;
  percent: number;
}

export async function getTopHolders(marketId: string, limit: number = 10): Promise<TopHolder[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets/top-holders?market=${encodeURIComponent(marketId)}&limit=${limit}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as TopHolder[];
  } catch (error) {
    console.error("Failed to fetch top holders:", error);
    return [];
  }
}

export async function getSampledMarkets(limit: number = 20): Promise<Market[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets/sampling?limit=${limit}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item: GammaMarket) => parseGammaMarket(item))
      .filter((market: Market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch sampled markets:", error);
    return [];
  }
}

export interface SimplifiedMarket {
  id: string;
  question: string;
  slug: string;
  volumeNum: number;
  liquidityNum: number;
  outcomePrices: string[];
  clobTokenIds: string[];
  endDate: string | null;
}

export async function getSimplifiedMarkets(limit: number = 50, offset: number = 0): Promise<SimplifiedMarket[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets/simplified?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as SimplifiedMarket[];
  } catch (error) {
    console.error("Failed to fetch simplified markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Filters API
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketFilterOptions {
  categories: Array<{ slug: string; name: string; count: number }>;
  tags: Array<{ slug: string; name: string; count: number }>;
  sportsMarketTypes: string[];
  orderBy: string[];
}

export async function getMarketFilters(): Promise<MarketFilterOptions | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets/filters`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as MarketFilterOptions;
    return data;
  } catch (error) {
    console.error("Failed to fetch market filters:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Item API
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  markets: Market[];
  marketCount: number;
  totalVolume: number;
  totalLiquidity: number;
}

export async function getGroupItems(groupItemId?: string): Promise<GroupItem[]> {
  try {
    const url = groupItemId
      ? `${GAMMA_API_BASE}/markets/group-item?id=${encodeURIComponent(groupItemId)}`
      : `${GAMMA_API_BASE}/markets/group-item`;

    const response = await fetch(url);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: GroupItem & { markets?: GammaMarket[] }) => ({
      ...item,
      markets: (item.markets || []).map((m: GammaMarket) => parseGammaMarket(m)),
    })) as GroupItem[];
  } catch (error) {
    console.error("Failed to fetch group items:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Resolution Status API
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketResolution {
  marketId: string;
  question: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolution: string | null;
  resolutionSource: string | null;
}

export async function getMarketResolutionStatus(marketId: string): Promise<MarketResolution | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets/${encodeURIComponent(marketId)}/resolution`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as MarketResolution;
    return data;
  } catch (error) {
    console.error("Failed to fetch market resolution status:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trending Markets API
// ─────────────────────────────────────────────────────────────────────────────

export interface TrendingMarket {
  id: string;
  question: string;
  slug: string;
  volume24hr: number;
  change24hr: number;
  rank: number;
}

export async function getTrendingMarketsList(limit: number = 20): Promise<TrendingMarket[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets/trending?limit=${limit}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as TrendingMarket[];
  } catch (error) {
    console.error("Failed to fetch trending markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Popular Markets API
// ─────────────────────────────────────────────────────────────────────────────

export async function getPopularMarkets(limit: number = 20): Promise<Market[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets/popular?limit=${limit}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item: GammaMarket) => parseGammaMarket(item))
      .filter((market: Market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch popular markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Comments API
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketComment {
  id: string;
  user: string;
  content: string;
  createdAt: string;
  likes: number;
  replies: number;
}

export async function getMarketComments(marketId: string, limit: number = 50): Promise<MarketComment[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets/${encodeURIComponent(marketId)}/comments?limit=${limit}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data as MarketComment[];
  } catch (error) {
    console.error("Failed to fetch market comments:", error);
    return [];
  }
}

export async function postMarketComment(marketId: string, content: string): Promise<MarketComment | null> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets/${encodeURIComponent(marketId)}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as MarketComment;
    return data;
  } catch (error) {
    console.error("Failed to post market comment:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Related Markets API
// ─────────────────────────────────────────────────────────────────────────────

export async function getRelatedMarkets(marketId: string, limit: number = 10): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets/${encodeURIComponent(marketId)}/related?limit=${limit}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item: GammaMarket) => parseGammaMarket(item))
      .filter((market: Market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch related markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Featured Markets API
// ─────────────────────────────────────────────────────────────────────────────

export interface FeaturedGroup {
  id: string;
  title: string;
  description: string;
  markets: Market[];
}

export async function getFeaturedMarkets(): Promise<FeaturedGroup[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets/featured`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((group: FeaturedGroup & { markets?: GammaMarket[] }) => ({
      ...group,
      markets: (group.markets || []).map((m: GammaMarket) => parseGammaMarket(m)),
    }));
  } catch (error) {
    console.error("Failed to fetch featured markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Closed Markets API
// ─────────────────────────────────────────────────────────────────────────────

export async function getClosedMarkets(limit: number = 50, offset: number = 0): Promise<Market[]> {
  try {
    const query = buildMarketsQuery({ limit, offset, closed: true, order: "volumeNum", ascending: false });
    const response = await fetch(`${GAMMA_API_BASE}/markets?${query}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item: GammaMarket) => parseGammaMarket(item))
      .filter((market: Market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch closed markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolved Markets API
// ─────────────────────────────────────────────────────────────────────────────

export async function getResolvedMarkets(limit: number = 50, offset: number = 0): Promise<Market[]> {
  try {
    const query = buildMarketsQuery({
      limit,
      offset,
      closed: false,
      order: "endDate",
      ascending: false,
    });
    const response = await fetch(`${GAMMA_API_BASE}/markets?${query}&resolved=true`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item: GammaMarket) => parseGammaMarket(item))
      .filter((market: Market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch resolved markets:", error);
    return [];
  }
}
