/**
 * Shared query builders and endpoint constants for Polymarket APIs.
 *
 * Notes:
 * - Gamma API: market/event discovery (public)
 * - CLOB API: prices/order books/trading (public + authenticated)
 * - GraphQL query strings are kept for subgraph compatibility.
 */

import type { Timeframe } from "../types/market";

export const GAMMA_BASE_URL = "https://gamma-api.polymarket.com";
export const CLOB_BASE_URL = "https://clob.polymarket.com";

export const CLOB_BATCH_MARKET_DATA_LIMIT = 500;
export const CLOB_BATCH_ORDER_LIMIT = 15;
export const CLOB_BULK_CANCEL_LIMIT = 3000;

export const CLOB_INTERVAL_BY_TIMEFRAME: Record<Timeframe, string> = {
  "1h": "5m",
  "4h": "15m",
  "1d": "1h",
  "5d": "6h",
  "1w": "1d",
  "1M": "1d",
  all: "max",
};

export type QueryPrimitive = string | number | boolean;
export type QueryValue = QueryPrimitive | QueryPrimitive[];

export function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter((v) => v.length > 0)));
}

export function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

export function buildQueryString(params: Record<string, QueryValue | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.map(String).join(","));
      continue;
    }

    search.set(key, String(value));
  }

  return search.toString();
}

export interface GammaMarketsQuery {
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  active?: boolean;
  closed?: boolean;
  id?: string | string[];
  slug?: string | string[];
  clob_token_ids?: string[];
  condition_ids?: string[];
  market_maker_address?: string[];
  tag_id?: number;
  related_tags?: boolean;
  cyom?: boolean;
  uma_resolution_status?: string;
  game_id?: string;
  sports_market_types?: string[];
  rewards_min_size?: number;
  question_ids?: string[];
  include_tag?: boolean;
  liquidity_num_min?: number;
  liquidity_num_max?: number;
  volume_num_min?: number;
  volume_num_max?: number;
  end_date_min?: string;
  end_date_max?: string;
  start_date_min?: string;
  start_date_max?: string;
}

export interface GammaEventsQuery {
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  id?: string | string[];
  slug?: string | string[];
  active?: boolean;
  closed?: boolean;
  featured?: boolean;
  archived?: boolean;
  cyom?: boolean;
  include_chat?: boolean;
  include_template?: boolean;
  recurrence?: string;
  tag_id?: number;
  tag_slug?: string;
  exclude_tag_id?: number[];
  related_tags?: boolean;
  liquidity_min?: number;
  liquidity_max?: number;
  volume_min?: number;
  volume_max?: number;
  start_date_min?: string;
  start_date_max?: string;
  end_date_min?: string;
  end_date_max?: string;
}

export interface GammaPublicSearchQuery {
  q: string;
  cache?: boolean;
  events_status?: string;
  limit_per_type?: number;
  page?: number;
  events_tag?: string[];
  keep_closed_markets?: number;
  sort?: string;
  ascending?: boolean;
  search_tags?: boolean;
  search_profiles?: boolean;
  recurrence?: string;
  exclude_tag_id?: number[];
  optimized?: boolean;
}

export function buildGammaMarketsQuery(params: GammaMarketsQuery): string {
  return buildQueryString(params as Record<string, QueryValue | undefined>);
}

export function buildGammaEventsQuery(params: GammaEventsQuery): string {
  return buildQueryString(params as Record<string, QueryValue | undefined>);
}

export function buildGammaPublicSearchQuery(params: GammaPublicSearchQuery): string {
  return buildQueryString(params as unknown as Record<string, QueryValue | undefined>);
}

export interface ClobTokenRequest {
  token_id: string;
  side?: "BUY" | "SELL";
}

export function buildClobTokenBatchRequest(tokenIds: string[]): ClobTokenRequest[] {
  return uniqueNonEmpty(tokenIds).map((token_id) => ({ token_id }));
}

export function buildClobMarketPriceBatchRequest(
  entries: Array<{ tokenId: string; side: "BUY" | "SELL" }>,
): ClobTokenRequest[] {
  return entries
    .filter((entry) => entry.tokenId.trim().length > 0)
    .map((entry) => ({ token_id: entry.tokenId.trim(), side: entry.side }));
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOB API Query Builders
// ─────────────────────────────────────────────────────────────────────────────

export interface ClobOrdersQuery {
  address?: string;
  status?: "open" | "filled" | "cancelled" | "all";
  side?: "BUY" | "SELL";
  limit?: number;
  before?: string | number;
  after?: string | number;
}

export interface ClobTradesQuery {
  address?: string;
  order_id?: string;
  limit?: number;
  before?: string | number;
  after?: string | number;
}

export interface ClobPositionsQuery {
  user?: string;
  limit?: number;
  offset?: number;
}

export interface ClobPricesQuery {
  asset_id?: string;
  side?: "BUY" | "SELL";
}

export interface ClobOrderBookQuery {
  asset_id: string;
  depth?: number;
}

export function buildClobOrdersQuery(params: ClobOrdersQuery): string {
  const filtered: Record<string, QueryPrimitive> = {};
  if (params.address !== undefined) filtered.address = params.address;
  if (params.status !== undefined) filtered.status = params.status;
  if (params.side !== undefined) filtered.side = params.side;
  if (params.limit !== undefined) filtered.limit = params.limit;
  if (params.before !== undefined) filtered.before = params.before;
  if (params.after !== undefined) filtered.after = params.after;
  return buildQueryString(filtered);
}

export function buildClobTradesQuery(params: ClobTradesQuery): string {
  const filtered: Record<string, QueryPrimitive> = {};
  if (params.address !== undefined) filtered.address = params.address;
  if (params.order_id !== undefined) filtered.order_id = params.order_id;
  if (params.limit !== undefined) filtered.limit = params.limit;
  if (params.before !== undefined) filtered.before = params.before;
  if (params.after !== undefined) filtered.after = params.after;
  return buildQueryString(filtered);
}

export function buildClobPositionsQuery(params: ClobPositionsQuery): string {
  const filtered: Record<string, QueryPrimitive> = {};
  if (params.user !== undefined) filtered.user = params.user;
  if (params.limit !== undefined) filtered.limit = params.limit;
  if (params.offset !== undefined) filtered.offset = params.offset;
  return buildQueryString(filtered);
}

export function buildClobPricesQuery(params: ClobPricesQuery): string {
  const filtered: Record<string, QueryPrimitive> = {};
  if (params.asset_id !== undefined) filtered.asset_id = params.asset_id;
  if (params.side !== undefined) filtered.side = params.side;
  return buildQueryString(filtered);
}

export function buildClobOrderBookQuery(params: ClobOrderBookQuery): string {
  const filtered: Record<string, QueryPrimitive> = {
    asset_id: params.asset_id,
  };
  if (params.depth !== undefined) filtered.depth = params.depth;
  return buildQueryString(filtered);
}

// ─────────────────────────────────────────────────────────────────────────────
// Data API Query Builders
// ─────────────────────────────────────────────────────────────────────────────

export interface DataApiPositionsQuery {
  user: string;
  market?: string | string[];
  eventId?: number | number[];
  limit?: number;
  offset?: number;
  sizeThreshold?: number;
  sortBy?: string;
  sortDirection?: "ASC" | "DESC";
  redeemable?: boolean;
  mergeable?: boolean;
  title?: string;
}

export interface DataApiValueQuery {
  user: string;
  market?: string | string[];
}

export interface DataApiActivityQuery {
  user: string;
  market?: string | string[];
  eventId?: number | number[];
  type?: string | string[];
  side?: "BUY" | "SELL";
  limit?: number;
  offset?: number;
  start?: number;
  end?: number;
  sortBy?: "TIMESTAMP" | "TOKENS" | "CASH";
  sortDirection?: "ASC" | "DESC";
}

export interface DataApiTradesQuery {
  user?: string;
  market?: string | string[];
  eventId?: number | number[];
  side?: "BUY" | "SELL";
  takerOnly?: boolean;
  filterType?: "CASH" | "TOKENS";
  filterAmount?: number;
  limit?: number;
  offset?: number;
}

export function buildDataApiPositionsQuery(params: DataApiPositionsQuery): string {
  const filtered: Record<string, QueryValue> = { user: params.user };
  if (params.market !== undefined) filtered.market = params.market;
  if (params.eventId !== undefined) filtered.eventId = params.eventId;
  if (params.limit !== undefined) filtered.limit = params.limit;
  if (params.offset !== undefined) filtered.offset = params.offset;
  if (params.sizeThreshold !== undefined) filtered.sizeThreshold = params.sizeThreshold;
  if (params.sortBy !== undefined) filtered.sortBy = params.sortBy;
  if (params.sortDirection !== undefined) filtered.sortDirection = params.sortDirection;
  if (params.redeemable !== undefined) filtered.redeemable = params.redeemable;
  if (params.mergeable !== undefined) filtered.mergeable = params.mergeable;
  if (params.title !== undefined) filtered.title = params.title;
  return buildQueryString(filtered);
}

export function buildDataApiValueQuery(params: DataApiValueQuery): string {
  return buildQueryString({ user: params.user, market: params.market });
}

export function buildDataApiActivityQuery(params: DataApiActivityQuery): string {
  return buildQueryString(params as unknown as Record<string, QueryValue | undefined>);
}

export function buildDataApiTradesQuery(params: DataApiTradesQuery): string {
  return buildQueryString(params as unknown as Record<string, QueryValue | undefined>);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge API Query Builders
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeTransactionsQuery {
  address: string;
  limit?: number;
  offset?: number;
}

export interface BridgeQuoteQuery {
  asset: string;
  amount: string;
  sourceChain: string;
  destinationChain: string;
}

export function buildBridgeTransactionsQuery(params: BridgeTransactionsQuery): string {
  const filtered: Record<string, QueryPrimitive> = { address: params.address };
  if (params.limit !== undefined) filtered.limit = params.limit;
  if (params.offset !== undefined) filtered.offset = params.offset;
  return buildQueryString(filtered);
}

export function buildBridgeQuoteQuery(params: BridgeQuoteQuery): string {
  return buildQueryString({
    asset: params.asset,
    amount: params.amount,
    sourceChain: params.sourceChain,
    destinationChain: params.destinationChain,
  });
}

// Legacy subgraph GraphQL query strings (kept for compatibility)
export const GET_MARKETS_QUERY = `
  query GetMarkets($first: Int!, $skip: Int!) {
    markets(first: $first, skip: $skip, orderBy: volume, orderDirection: desc) {
      id
      title
      description
      outcomes {
        id
        title
      }
      volume
      liquidityBin
      createdTime
      closingTime
      closed
      resolved
    }
  }
`;

export const GET_MARKET_DETAILS_QUERY = `
  query GetMarketDetails($id: ID!) {
    market(id: $id) {
      id
      title
      description
      outcomes {
        id
        title
        price
        volume
      }
      volume
      liquidityBin
      createdTime
      closingTime
      closed
      resolved
      openInterest
    }
  }
`;

export const GET_OUTCOMES_QUERY = `
  query GetOutcomes($marketId: ID!) {
    outcomes(where: { market: $marketId }) {
      id
      title
      market {
        id
      }
      price
      volume
    }
  }
`;

export const GET_PRICE_HISTORY_QUERY = `
  query GetPriceHistory($marketId: ID!, $skip: Int!) {
    priceHistories(
      first: 100
      skip: $skip
      where: { market: $marketId }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      timestamp
      price
      outcome {
        id
        title
      }
    }
  }
`;

export const GET_MARKET_TRADES_QUERY = `
  query GetMarketTrades($marketId: ID!) {
    trades(where: { market: $marketId }, orderBy: timestamp, orderDirection: desc, first: 10) {
      id
      timestamp
      buyer
      outcome {
        id
        title
      }
      shares
      price
    }
  }
`;
