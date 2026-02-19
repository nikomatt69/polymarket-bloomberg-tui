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
