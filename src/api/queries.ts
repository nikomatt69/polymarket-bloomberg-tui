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

export function buildQueryString(params: Record<string, QueryPrimitive | QueryPrimitive[] | undefined>): string {
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
  resolved?: boolean;
  tag_id?: number;
  tag?: string;
  category?: string;
  slug?: string;
  id?: string;
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
  active?: boolean;
  closed?: boolean;
  featured?: boolean;
  archived?: boolean;
  tag_id?: number;
  tag_slug?: string;
  slug?: string;
  id?: string;
}

export function buildGammaMarketsQuery(params: GammaMarketsQuery): string {
  return buildQueryString(params as Record<string, QueryPrimitive | QueryPrimitive[] | undefined>);
}

export function buildGammaEventsQuery(params: GammaEventsQuery): string {
  return buildQueryString(params as Record<string, QueryPrimitive | QueryPrimitive[] | undefined>);
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
