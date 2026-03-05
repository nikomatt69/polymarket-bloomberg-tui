/**
 * Polymarket API client for fetching market data
 * Uses Gamma API for markets and CLOB API for price history and trading
 */

import { Market, Outcome, PriceHistory, PricePoint, Event, Series, Tag, Category, Timeframe } from "../types/market";
import {
  GAMMA_BASE_URL,
  CLOB_BASE_URL,
  CLOB_INTERVAL_BY_TIMEFRAME,
  CLOB_BATCH_MARKET_DATA_LIMIT,
  buildClobTokenBatchRequest,
  buildGammaEventsQuery,
  buildGammaMarketsQuery,
  buildQueryString,
  chunkArray,
  uniqueNonEmpty,
} from "./queries";

const GAMMA_API_BASE = GAMMA_BASE_URL;
const CLOB_API_BASE = CLOB_BASE_URL;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

interface GammaSeries {
  id: string;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  category?: string;
}

interface GammaTag {
  id: string;
  slug: string;
  name: string;
  category?: string;
}

interface ClobPriceHistoryResponse {
  history?: Array<{ t: number; p: number | string }>;
}

interface ClobSinglePriceResponse {
  price?: string | number;
}

interface ClobMarketPriceResponse {
  price?: string | number;
  side?: "BUY" | "SELL" | "";
}

interface ClobBookLevel {
  price: string;
  size: string;
}

interface ClobBookResponse {
  market?: string;
  asset_id?: string;
  timestamp?: string;
  hash?: string;
  bids?: ClobBookLevel[];
  asks?: ClobBookLevel[];
  min_order_size?: string;
  tick_size?: string;
  neg_risk?: boolean;
  last_trade_price?: string;
}

interface ClobSpreadResponse {
  spread?: string | number;
}

interface GammaSearchResponse {
  markets?: GammaMarket[];
}

export interface OrderBookSummary {
  marketId: string;
  tokenId: string;
  bestBid: number | null;
  bestAsk: number | null;
  midpoint: number | null;
  spread: number | null;
  spreadBps: number | null;
  bidDepth: number;
  askDepth: number;
  minOrderSize: number | null;
  tickSize: number | null;
  updatedAt: number | null;
  negRisk: boolean;
  lastTradePrice: number | null;
  lastTradeSide: "BUY" | "SELL" | null;
  hash?: string;
}

export interface MarketQuote {
  tokenId: string;
  outcome: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  volume24h: number;
  liquidity: number;
}

export interface MarketDepth {
  bids: Array<{ price: number; size: number; total: number }>;
  asks: Array<{ price: number; size: number; total: number }>;
  spread: number;
  midPrice: number;
}

export interface TradeInfo {
  orderId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  status: string;
  marketTitle: string;
  outcomeTitle: string;
  timestamp: string;
}

export interface PositionInfo {
  asset: string;
  outcome: string;
  marketId: string;
  marketTitle: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  cashPnl: number;
  percentPnl: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

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
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  if (!Number.isFinite(normalized)) return fallback;
  return Math.min(1, Math.max(0, normalized));
}

function toTimestampMs(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const parsed = parseNumeric(value, Number.NaN);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 1_000_000_000_000 ? Math.round(parsed * 1000) : Math.round(parsed);
}

function toIsoDate(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input);
  return date.toISOString();
}

async function fetchJson<T>(url: string, init?: RequestInit, retries: number = MAX_RETRIES): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      attempt += 1;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to fetch JSON response");
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

/** Slug mapping for category → Gamma tag slug (matches CLOB tag filter `tag=slug`) */
const CATEGORY_SLUG_MAP: Record<string, string> = {
  Sports: "sports",
  Politics: "politics",
  Crypto: "cryptocurrency",
  Business: "economics",
  Entertainment: "pop-culture",
  Science: "science",
  AI: "artificial-intelligence",
  Tech: "technology",
  World: "world",
  Health: "health",
  Climate: "climate-and-environment",
};

/**
 * Resolve category from market data.
 * Gamma API `category` field is often null for new markets.
 * This function:
 * 1. Uses `category` field when present (normalizes whitespace/hyphens)
 * 2. Falls back to keyword inference from question/slug
 * 3. Returns "general" as last resort
 */
function resolveCategoryFromMarket(market: GammaMarket): string {
  // 1. Try direct category field (normalize trailing space, convert hyphens)
  const rawCat = market.category;
  if (rawCat && rawCat.trim()) {
    return rawCat.trim().toLowerCase().replace(/-/g, "");
  }

  // 2. Infer from question and slug keywords
  const text = `${market.question ?? ""} ${market.slug ?? ""}`.toLowerCase();

  // Sports patterns
  if (/\b(nba|nfl|nhl|mlb|soccer|football|ufc|mma|tennis|world cup|fifa|qualif|championship|season|win the|beat |score |game\b)/.test(text)) {
    return "sports";
  }
  // Politics patterns
  if (/\b(trump|biden|election|president|congress|senate|republican|democrat|governor|polling|vote|cabinet|ukraine|russia|china |taiwan|policy|law|bill|supreme court)/.test(text)) {
    return "politics";
  }
  // Crypto patterns
  if (/\b(bitcoin|btc|ethereum|eth|solana|xrp|binance|coinbase|crypto|defi|blockchain|token\b)/.test(text)) {
    return "crypto";
  }
  // Tech patterns
  if (/\b(ai |openai|gpt|chatgpt|anthropic|claude|google |microsoft|apple |meta |twitter|amazon |tesla|spacex|tech|software|startup|ipo|valuation\b)/.test(text)) {
    return "tech";
  }
  // Entertainment patterns
  if (/\b(album|music|song|artist|movie|film|netflix|disney|spotify|gta|video game|grammy|oscar|emmy|tony\b)/.test(text)) {
    return "entertainment";
  }
  // Science/Health patterns
  if (/\b(vaccine|covid|coronavirus|health|medical|disease|fda|cdc|science|research|study|trial\b)/.test(text)) {
    return "science";
  }
  // Business/Economics patterns
  if (/\b(market|stock|economy|gdp|fed|inflation|unemployment|interest|recession|bank|finance|oil|energy\b)/.test(text)) {
    return "business";
  }

  return "general";
}

function parseGammaMarket(market: GammaMarket): Market {
  const outcomes = parseJsonArray(market.outcomes);
  const outcomePrices = parseJsonArray(market.outcomePrices).map((value) => normalizeProbability(value, 0.5));
  const clobTokenIds = parseJsonArray(market.clobTokenIds);

  const normalizedOutcomes = outcomes.length > 0 ? outcomes : ["Yes", "No"];

  const outcomeList: Outcome[] = normalizedOutcomes.map((title: string, i: number) => ({
    id: clobTokenIds[i] || `outcome_${i}`,
    title,
    price: normalizeProbability(outcomePrices[i], 0.5),
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
    category: resolveCategoryFromMarket(market),
    closed: market.closed || false,
    resolved: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Data API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchGammaMarkets(params: Parameters<typeof buildGammaMarketsQuery>[0]): Promise<Market[]> {
  const query = buildGammaMarketsQuery(params);
  const data = await fetchJson<GammaMarket[]>(`${GAMMA_API_BASE}/markets?${query}`);
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => parseGammaMarket(item))
    .filter((market) => market.outcomes.length > 0);
}

async function enrichMarketsWithOrderBook(markets: Market[]): Promise<Market[]> {
  if (markets.length === 0) return markets;

  const tokenIds = uniqueNonEmpty(
    markets.flatMap((market) => market.outcomes.map((outcome) => outcome.id)).filter((id) => !id.startsWith("outcome_")),
  );

  if (tokenIds.length === 0) return markets;

  const books = await getOrderBookSummaries(tokenIds);
  return markets.map((market) => ({
    ...market,
    outcomes: market.outcomes.map((outcome) => {
      const book = books[outcome.id];
      const referencePrice = book?.midpoint ?? book?.lastTradePrice ?? outcome.price;

      return {
        ...outcome,
        price: normalizeProbability(referencePrice, outcome.price),
      };
    }),
  }));
}

export async function getMarkets(limit: number = 50, offset: number = 0): Promise<Market[]> {
  const baseMarkets = await fetchGammaMarkets({
    limit,
    offset,
    active: true,
    closed: false,
    order: "volumeNum",
    ascending: false,
  });

  return enrichMarketsWithOrderBook(baseMarkets);
}

export async function getMarketDetails(marketId: string): Promise<Market | null> {
  try {
    const safeId = encodeURIComponent(marketId);
    const direct = await fetchJson<GammaMarket | GammaMarket[]>(`${GAMMA_API_BASE}/markets/${safeId}`);
    const candidate = Array.isArray(direct) ? direct[0] : direct;

    if (candidate && typeof candidate === "object") {
      const enriched = await enrichMarketsWithOrderBook([parseGammaMarket(candidate)]);
      return enriched[0] ?? null;
    }
  } catch {
    // fallback path below
  }

  try {
    const query = buildGammaMarketsQuery({ id: marketId, limit: 1, offset: 0 });
    const data = await fetchJson<GammaMarket[]>(`${GAMMA_API_BASE}/markets?${query}`);
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const enriched = await enrichMarketsWithOrderBook([parseGammaMarket(data[0])]);
    return enriched[0] ?? null;
  } catch (error) {
    console.error("Failed to fetch market details:", error);
    return null;
  }
}

export async function getMarketsByCategory(category: string, limit: number = 50, offset: number = 0): Promise<Market[]> {
  // Gamma API doesn't support category filtering — we fetch and filter client-side
  // using the same keyword matching as resolveCategoryFromMarket()
  const catSlug = CATEGORY_SLUG_MAP[category] ?? category.toLowerCase();

  // Build keyword patterns for this category (same as inference logic)
  const categoryKeywords: Record<string, string[]> = {
    sports: ["nba", "nfl", "nhl", "mlb", "soccer", "football", "ufc", "mma", "tennis", "world cup", "fifa", "qualif", "championship", "season", "win the", "beat", "score", "game"],
    politics: ["trump", "biden", "election", "president", "congress", "senate", "republican", "democrat", "governor", "polling", "vote", "cabinet", "ukraine", "russia", "china", "taiwan", "policy", "law", "bill", "supreme court"],
    crypto: ["bitcoin", "btc", "ethereum", "eth", "solana", "xrp", "binance", "coinbase", "crypto", "defi", "blockchain", "token"],
    tech: ["ai ", "openai", "gpt", "chatgpt", "anthropic", "claude", "google ", "microsoft", "apple ", "meta ", "twitter", "amazon ", "tesla", "spacex", "tech", "software", "startup", "ipo", "valuation"],
    entertainment: ["album", "music", "song", "artist", "movie", "film", "netflix", "disney", "spotify", "gta", "video game", "grammy", "oscar", "emmy", "tony"],
    science: ["vaccine", "covid", "coronavirus", "health", "medical", "disease", "fda", "cdc", "science", "research", "study", "trial"],
    business: ["market", "stock", "economy", "gdp", "fed", "inflation", "unemployment", "interest", "recession", "bank", "finance", "oil", "energy"],
  };

  const keywords = categoryKeywords[catSlug] ?? [catSlug];

  try {
    // Fetch more than needed since we'll filter client-side
    const baseMarkets = await fetchGammaMarkets({
      limit: Math.max(limit * 4, 200),
      offset,
      active: true,
      closed: false,
      order: "volumeNum",
      ascending: false,
    });

    // Client-side filter by keyword match in title or inferred category
    const filtered = baseMarkets.filter((m) => {
      // First check if market's resolved category matches
      if (m.category === catSlug) return true;

      // Then check keywords in title
      const titleLower = m.title.toLowerCase();
      return keywords.some((kw) => titleLower.includes(kw));
    });

    return enrichMarketsWithOrderBook(filtered.slice(0, limit));
  } catch (error) {
    console.error("Failed to fetch markets by category:", error);
    return [];
  }
}

export async function searchMarkets(query: string): Promise<Market[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = buildQueryString({
    q: trimmed,
    markets: true,
    events: false,
    tags: false,
    profiles: false,
    limit: 50,
    offset: 0,
  });

  for (const endpoint of ["public-search", "search"]) {
    try {
      const payload = await fetchJson<GammaSearchResponse>(`${GAMMA_API_BASE}/${endpoint}?${params}`, undefined, 0);
      const markets = Array.isArray(payload.markets)
        ? payload.markets.map((market) => parseGammaMarket(market)).filter((market) => market.outcomes.length > 0)
        : [];
      if (markets.length > 0) {
        return enrichMarketsWithOrderBook(markets);
      }
    } catch {
      // try next endpoint
    }
  }

  const fallback = await getMarkets(100);
  const queryLower = trimmed.toLowerCase();
  return fallback.filter(
    (market) =>
      market.title.toLowerCase().includes(queryLower)
      || (market.description && market.description.toLowerCase().includes(queryLower)),
  );
}

export async function getTrendingMarkets(limit: number = 20): Promise<Market[]> {
  try {
    const markets = await fetchGammaMarkets({
      limit,
      offset: 0,
      active: true,
      closed: false,
      order: "competitive",
      ascending: false,
    });
    return enrichMarketsWithOrderBook(markets);
  } catch {
    return getMarkets(limit);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Price History API
// ─────────────────────────────────────────────────────────────────────────────

export async function getPriceHistory(
  marketId: string,
  timeframe: Timeframe = "1d",
  tokenIdOverride?: string,
  start?: Date | string,
  end?: Date | string,
): Promise<PriceHistory | null> {
  try {
    let tokenId = tokenIdOverride;
    if (!tokenId) {
      const marketDetails = await getMarketDetails(marketId);
      if (!marketDetails || marketDetails.outcomes.length === 0) {
        return null;
      }
      tokenId = marketDetails.outcomes[0]?.id;
    }

    if (!tokenId) {
      return null;
    }

    const params = buildQueryString({
      market: tokenId,
      interval: CLOB_INTERVAL_BY_TIMEFRAME[timeframe],
      startTs: start ? Math.floor(new Date(toIsoDate(start)).getTime() / 1000) : undefined,
      endTs: end ? Math.floor(new Date(toIsoDate(end)).getTime() / 1000) : undefined,
    });

    const data = await fetchJson<ClobPriceHistoryResponse>(`${CLOB_API_BASE}/prices-history?${params}`);

    if (!data.history || !Array.isArray(data.history)) {
      return null;
    }

    const pricePoints: PricePoint[] = data.history.map((point) => ({
      timestamp: point.t * 1000,
      price: (() => {
        const raw = parseNumeric(point.p, 0);
        return raw > 1 ? raw / 100 : raw;
      })(),
      outcomeId: tokenId,
    }));

    if (pricePoints.length === 0) {
      return null;
    }

    return {
      marketId,
      outcomeId: tokenId,
      data: pricePoints,
      timeframe,
    };
  } catch (error) {
    console.error("Failed to fetch price history:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Book API
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrderBookSummary(tokenId: string): Promise<OrderBookSummary | null> {
  try {
    const params = buildQueryString({ token_id: tokenId });
    const data = await fetchJson<ClobBookResponse>(`${CLOB_API_BASE}/book?${params}`);
    const bids = Array.isArray(data?.bids) ? data.bids : [];
    const asks = Array.isArray(data?.asks) ? data.asks : [];

    const bestBid = bids.length > 0 ? normalizeProbability(bids[0].price, 0) : null;
    const bestAsk = asks.length > 0 ? normalizeProbability(asks[0].price, 0) : null;
    const midpoint =
      bestBid !== null && bestAsk !== null
        ? (bestBid + bestAsk) / 2
        : bestBid !== null
          ? bestBid
          : bestAsk;
    const spread = bestBid !== null && bestAsk !== null ? Math.max(0, bestAsk - bestBid) : null;
    const spreadBps =
      midpoint !== null && midpoint > 0 && spread !== null
        ? (spread / midpoint) * 10_000
        : null;
    const bidDepth = bids.reduce((sum, level) => sum + parseNumeric(level.size, 0), 0);
    const askDepth = asks.reduce((sum, level) => sum + parseNumeric(level.size, 0), 0);
    const lastTradePrice = data.last_trade_price ? normalizeProbability(data.last_trade_price, midpoint ?? 0.5) : null;

    return {
      marketId: data.market ?? "",
      tokenId: data.asset_id ?? tokenId,
      bestBid,
      bestAsk,
      midpoint,
      spread,
      spreadBps,
      bidDepth,
      askDepth,
      minOrderSize: data.min_order_size ? parseNumeric(data.min_order_size, 0) : null,
      tickSize: data.tick_size ? parseNumeric(data.tick_size, 0) : null,
      updatedAt: toTimestampMs(data.timestamp),
      negRisk: data.neg_risk === true,
      lastTradePrice,
      lastTradeSide: null,
      hash: data.hash,
    };
  } catch {
    return null;
  }
}

export async function getOrderBookSummaries(tokenIds: string[]): Promise<Record<string, OrderBookSummary>> {
  const unique = uniqueNonEmpty(tokenIds);
  if (unique.length === 0) return {};

  const result: Record<string, OrderBookSummary> = {};

  for (const batch of chunkArray(unique, CLOB_BATCH_MARKET_DATA_LIMIT)) {
    try {
      const payload = JSON.stringify(buildClobTokenBatchRequest(batch));
      const books = await fetchJson<ClobBookResponse[]>(
        `${CLOB_API_BASE}/books`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
      );

      if (!Array.isArray(books)) continue;

      for (const book of books) {
        const tokenId = book.asset_id;
        if (!tokenId) continue;

        const bids = Array.isArray(book.bids) ? book.bids : [];
        const asks = Array.isArray(book.asks) ? book.asks : [];
        const bestBid = bids.length > 0 ? normalizeProbability(bids[0].price, 0) : null;
        const bestAsk = asks.length > 0 ? normalizeProbability(asks[0].price, 0) : null;
        const midpoint =
          bestBid !== null && bestAsk !== null
            ? (bestBid + bestAsk) / 2
            : bestBid !== null
              ? bestBid
              : bestAsk;
        const spread = bestBid !== null && bestAsk !== null ? Math.max(0, bestAsk - bestBid) : null;
        const spreadBps =
          midpoint !== null && midpoint > 0 && spread !== null
            ? (spread / midpoint) * 10_000
            : null;

        result[tokenId] = {
          marketId: book.market ?? "",
          tokenId,
          bestBid,
          bestAsk,
          midpoint,
          spread,
          spreadBps,
          bidDepth: bids.reduce((sum, level) => sum + parseNumeric(level.size, 0), 0),
          askDepth: asks.reduce((sum, level) => sum + parseNumeric(level.size, 0), 0),
          minOrderSize: book.min_order_size ? parseNumeric(book.min_order_size, 0) : null,
          tickSize: book.tick_size ? parseNumeric(book.tick_size, 0) : null,
          updatedAt: toTimestampMs(book.timestamp),
          negRisk: book.neg_risk === true,
          lastTradePrice: book.last_trade_price ? normalizeProbability(book.last_trade_price, midpoint ?? 0.5) : null,
          lastTradeSide: null,
          hash: book.hash,
        };
      }
    } catch {
      const fallbackEntries = await Promise.all(
        batch.map(async (id) => [id, await getOrderBookSummary(id)] as const),
      );

      for (const [id, summary] of fallbackEntries) {
        if (summary) {
          result[id] = summary;
        }
      }
    }
  }

  return result;
}

export async function getCurrentPrice(tokenId: string, side: "BUY" | "SELL" = "BUY"): Promise<number | null> {
  try {
    const params = buildQueryString({ token_id: tokenId, side });
    const data = await fetchJson<ClobSinglePriceResponse>(`${CLOB_API_BASE}/price?${params}`);
    return data.price !== undefined ? normalizeProbability(data.price, 0.5) : null;
  } catch {
    return null;
  }
}

export async function getBatchMarketPrices(
  requests: Array<{ tokenId: string; side: "BUY" | "SELL" }>,
): Promise<Record<string, number>> {
  const filtered = requests.filter((request) => request.tokenId.trim().length > 0);
  if (filtered.length === 0) return {};

  const result: Record<string, number> = {};

  for (const batch of chunkArray(filtered, CLOB_BATCH_MARKET_DATA_LIMIT)) {
    try {
      const payload = JSON.stringify(
        batch.map((entry) => ({ token_id: entry.tokenId, side: entry.side })),
      );
      const response = await fetchJson<Array<{ token_id: string; price: string | number }>>(
        `${CLOB_API_BASE}/prices`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
      );

      if (!Array.isArray(response)) continue;
      for (const entry of response) {
        if (!entry.token_id || entry.price === undefined) continue;
        result[entry.token_id] = normalizeProbability(entry.price, 0.5);
      }
    } catch {
      // Keep partial successes
    }
  }

  return result;
}

export async function getMidpointPrice(tokenId: string): Promise<number | null> {
  try {
    const params = buildQueryString({ token_id: tokenId });
    const data = await fetchJson<Record<string, string | number>>(`${CLOB_API_BASE}/midpoint?${params}`);
    const raw = data.mid ?? data.midpoint;
    return raw !== undefined ? normalizeProbability(raw, 0.5) : null;
  } catch {
    return null;
  }
}

export async function getMidpointPrices(tokenIds: string[]): Promise<Record<string, number>> {
  const unique = uniqueNonEmpty(tokenIds);
  if (unique.length === 0) return {};

  const result: Record<string, number> = {};

  for (const batch of chunkArray(unique, CLOB_BATCH_MARKET_DATA_LIMIT)) {
    try {
      const payload = JSON.stringify(buildClobTokenBatchRequest(batch));
      const data = await fetchJson<Record<string, string | number>>(
        `${CLOB_API_BASE}/midpoints`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
      );

      for (const [tokenId, value] of Object.entries(data ?? {})) {
        result[tokenId] = normalizeProbability(value, 0.5);
      }
    } catch {
      // keep partial successes
    }
  }

  return result;
}

export interface LastTradeSnapshot {
  price: number;
  side: "BUY" | "SELL" | null;
}

export async function getLastTradePrice(tokenId: string): Promise<LastTradeSnapshot | null> {
  try {
    const params = buildQueryString({ token_id: tokenId });
    const data = await fetchJson<ClobMarketPriceResponse>(`${CLOB_API_BASE}/last-trade-price?${params}`);
    if (data.price === undefined) return null;

    const side = data.side === "BUY" || data.side === "SELL" ? data.side : null;
    return {
      price: normalizeProbability(data.price, 0.5),
      side,
    };
  } catch {
    return null;
  }
}

export async function getLastTradePrices(tokenIds: string[]): Promise<Record<string, LastTradeSnapshot>> {
  const unique = uniqueNonEmpty(tokenIds);
  if (unique.length === 0) return {};

  const result: Record<string, LastTradeSnapshot> = {};

  for (const batch of chunkArray(unique, CLOB_BATCH_MARKET_DATA_LIMIT)) {
    try {
      const payload = JSON.stringify(buildClobTokenBatchRequest(batch));
      const data = await fetchJson<Array<{ token_id: string; price: string | number; side?: "BUY" | "SELL" | "" }>>(
        `${CLOB_API_BASE}/last-trades-prices`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
      );

      if (!Array.isArray(data)) continue;
      for (const item of data) {
        if (!item.token_id || item.price === undefined) continue;
        result[item.token_id] = {
          price: normalizeProbability(item.price, 0.5),
          side: item.side === "BUY" || item.side === "SELL" ? item.side : null,
        };
      }
    } catch {
      // keep partial successes
    }
  }

  return result;
}

export async function getSpread(tokenId: string): Promise<number | null> {
  try {
    const params = buildQueryString({ token_id: tokenId });
    const data = await fetchJson<ClobSpreadResponse>(`${CLOB_API_BASE}/spread?${params}`);
    if (data.spread === undefined) return null;
    return normalizeProbability(data.spread, 0);
  } catch {
    return null;
  }
}

export async function getSpreads(tokenIds: string[]): Promise<Record<string, number>> {
  const unique = uniqueNonEmpty(tokenIds);
  if (unique.length === 0) return {};

  const result: Record<string, number> = {};

  for (const batch of chunkArray(unique, CLOB_BATCH_MARKET_DATA_LIMIT)) {
    try {
      const payload = JSON.stringify(buildClobTokenBatchRequest(batch));
      const data = await fetchJson<Array<{ token_id: string; spread: string | number }>>(
        `${CLOB_API_BASE}/spreads`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
      );

      if (!Array.isArray(data)) continue;
      for (const item of data) {
        if (!item.token_id || item.spread === undefined) continue;
        result[item.token_id] = normalizeProbability(item.spread, 0);
      }
    } catch {
      // keep partial successes
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Quotes API
// ─────────────────────────────────────────────────────────────────────────────

export async function getMarketQuotes(marketId: string): Promise<MarketQuote[]> {
  const market = await getMarketDetails(marketId);
  if (!market) return [];

  const tokenIds = uniqueNonEmpty(market.outcomes.map((outcome) => outcome.id));
  const [books, lastTrades] = await Promise.all([
    getOrderBookSummaries(tokenIds),
    getLastTradePrices(tokenIds),
  ]);

  return market.outcomes.map((outcome) => {
    const book = books[outcome.id];
    const trade = lastTrades[outcome.id];
    const quotePrice = trade?.price ?? book?.midpoint ?? book?.lastTradePrice ?? outcome.price;

    return {
      tokenId: outcome.id,
      outcome: outcome.title,
      price: normalizeProbability(quotePrice, outcome.price),
      bid: book?.bestBid ?? outcome.price,
      ask: book?.bestAsk ?? outcome.price,
      spread: book?.spread ?? 0,
      volume24h: market.volume24h,
      liquidity: market.liquidity,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Depth API
// ─────────────────────────────────────────────────────────────────────────────

export async function getMarketDepth(tokenId: string, levels: number = 10): Promise<MarketDepth | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/book?token_id=${tokenId}`);
    if (!response.ok) return null;

    const json = await response.json();
    if (!json) return null;

    const data = json as ClobBookResponse;
    const bids = Array.isArray(data?.bids) ? data.bids : [];
    const asks = Array.isArray(data?.asks) ? data.asks : [];

    let bidTotal = 0;
    const bidLevels = bids.slice(0, levels).map((level) => {
      const size = parseNumeric(level.size, 0);
      bidTotal += size;
      return { price: normalizeProbability(level.price, 0), size, total: bidTotal };
    });

    let askTotal = 0;
    const askLevels = asks.slice(0, levels).map((level) => {
      const size = parseNumeric(level.size, 0);
      askTotal += size;
      return { price: normalizeProbability(level.price, 0), size, total: askTotal };
    });

    const bestBid = bidLevels[0]?.price ?? 0;
    const bestAsk = askLevels[0]?.price ?? 0;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;

    return {
      bids: bidLevels,
      asks: askLevels,
      spread,
      midPrice,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Events & Series API
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveEvents(limit: number = 50): Promise<Event[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/events?limit=${limit}&active=true`
    );

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
      markets: (item.markets || []).map((m) => parseGammaMarket(m)).filter((market) => market.outcomes.length > 0),
      tags: item.tags,
      status: item.endDate && new Date(item.endDate) < new Date() ? "resolved" : (item.active ? "live" : "upcoming"),
    }));
  } catch (error) {
    console.error("Failed to fetch active events:", error);
    return [];
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

export async function getMarketsByTag(tagSlug: string, limit: number = 50): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=${limit}&closed=false&tag=${encodeURIComponent(tagSlug)}&order=volumeNum&ascending=false`
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
    console.error("Failed to fetch markets by tag:", error);
    return [];
  }
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

export async function getTags(): Promise<Tag[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/tags`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: GammaTag) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      category: item.category,
    }));
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return [];
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/categories`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: { id?: string; category?: string; slug?: string; count?: number }) => ({
      id: item.id || item.category || item.slug || "",
      slug: item.category || item.slug || "",
      name: item.category || item.slug || "",
      marketsCount: item.count || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sports Markets API
// ─────────────────────────────────────────────────────────────────────────────

export async function getLiveSportsMarkets(): Promise<Market[]> {
  try {
    const query = buildGammaMarketsQuery({
      limit: 200,
      offset: 0,
      active: true,
      closed: false,
      category: "Sports",
      order: "volumeNum",
      ascending: false,
    });
    const data = await fetchJson<GammaMarket[]>(`${GAMMA_API_BASE}/markets?${query}`);
    if (!Array.isArray(data)) {
      return [];
    }

    const sportsKeywords = [
      "nba", "nfl", "nhl", "mlb", "ncaa", "soccer", "football",
      "basketball", "baseball", "hockey", "ufc", "mma", "tennis",
      "golf", "boxing", "cricket", "rugby", "world cup", "olympics"
    ];

    const sportsMarkets = data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => {
        if (market.outcomes.length === 0) return false;
        const titleLower = market.title.toLowerCase();
        const categoryLower = (market.category || "").toLowerCase();
        return sportsKeywords.some((kw) => titleLower.includes(kw) || categoryLower.includes(kw));
      })
      .slice(0, 50);

    return enrichMarketsWithOrderBook(sportsMarkets);
  } catch (error) {
    console.error("Failed to fetch live sports markets:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Info API
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenInfo {
  assetId: string;
  symbol: string;
  name: string;
  decimals: number;
  color: string;
  icon?: string;
}

export async function getTokenInfo(tokenId: string): Promise<TokenInfo | null> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/token?asset_id=${tokenId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    return {
      assetId: (data.asset_id as string) ?? tokenId,
      symbol: (data.symbol as string) ?? "UNKNOWN",
      name: (data.name as string) ?? "Unknown Token",
      decimals: parseNumeric(data.decimals, 6),
      color: (data.color as string) ?? "#000000",
      icon: data.icon as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function getMultipleTokenInfo(tokenIds: string[]): Promise<Record<string, TokenInfo>> {
  const unique = Array.from(new Set(tokenIds.filter(Boolean)));
  const results: Record<string, TokenInfo> = {};

  await Promise.all(
    unique.map(async (tokenId) => {
      const info = await getTokenInfo(tokenId);
      if (info) {
        results[tokenId] = info;
      }
    })
  );

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Status API
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketStatus {
  marketId: string;
  status: "open" | "closed" | "resolved" | "pending";
  resolvedOutcome?: string;
  resolutionDate?: string;
}

export async function getMarketStatus(marketId: string): Promise<MarketStatus | null> {
  try {
    const query = buildGammaMarketsQuery({ id: marketId, limit: 1, offset: 0 });
    const data = await fetchJson<Array<Record<string, unknown>>>(`${GAMMA_API_BASE}/markets?${query}`);
    if (!Array.isArray(data) || data.length === 0) return null;

    const market = data[0] as Record<string, unknown>;
    const isResolved = market.resolved === true;
    const isClosed = market.closed === true;

    return {
      marketId,
      status: isResolved ? "resolved" : isClosed ? "closed" : "open",
      resolvedOutcome: typeof market.resolvedOutcome === "string" ? market.resolvedOutcome : undefined,
      resolutionDate: typeof market.endDate === "string" ? market.endDate : undefined,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Metrics API
// ─────────────────────────────────────────────────────────────────────────────

export interface GlobalMetrics {
  totalVolume24h: number;
  totalMarkets: number;
  activeMarkets: number;
  topCategories: Array<{ category: string; volume: number }>;
}

export async function getGlobalMetrics(): Promise<GlobalMetrics> {
  try {
    const markets = await getMarkets(200);

    const totalVolume24h = markets.reduce((sum, m) => sum + m.volume24h, 0);
    const categoryVolume = new Map<string, number>();
    for (const market of markets) {
      const key = (market.category ?? "general").trim() || "general";
      categoryVolume.set(key, (categoryVolume.get(key) ?? 0) + market.volume24h);
    }

    const topCategories = Array.from(categoryVolume.entries())
      .map(([category, volume]) => ({ category, volume }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return {
      totalVolume24h,
      totalMarkets: markets.length,
      activeMarkets: markets.filter((m) => !m.closed).length,
      topCategories,
    };
  } catch {
    return {
      totalVolume24h: 0,
      totalMarkets: 0,
      activeMarkets: 0,
      topCategories: [],
    };
  }
}
