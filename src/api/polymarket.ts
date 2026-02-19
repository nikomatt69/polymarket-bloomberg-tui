/**
 * Polymarket API Client
 * Modular API structure for Polymarket data
 *
 * Structure:
 * - gamma/   : Market data, events, series, tags, categories, search, sports
 * - clob/    : Order book, prices, trading
 * - data/    : Positions, activity
 *
 * For imports, use either:
 * - Specific: import { getMarkets } from "../api/gamma";
 * - Combined: import { getMarkets } from "../api/polymarket";
 */

// Re-export Gamma API - Markets
export {
  getMarkets,
  getMarketDetails,
  getMarketsByCategory,
  searchMarkets,
  getTrendingMarkets,
  getLiveSportsMarkets,
  type MarketFilters,
} from "./gamma";

// Re-export Gamma API - Events
export {
  getActiveEvents,
  getEventById,
  getEventsBySeries,
  type EventFilters,
} from "./gamma";

// Re-export Gamma API - Series
export {
  getSeries,
  getSeriesById,
  getMarketsBySeries,
} from "./gamma";

// Re-export Gamma API - Tags
export {
  getTags,
  getTagBySlug,
  getMarketsByTag,
} from "./gamma";

// Re-export Gamma API - Categories
export {
  getCategories,
  getCategoryBySlug,
  POLYMARKET_CATEGORIES,
} from "./gamma";

export type { PolymarketCategoryId } from "./gamma";

// Re-export Gamma API - Search
export {
  search,
  searchEvents,
  searchMarketsByQuery,
  searchTags,
  type SearchFilters,
  type SearchResult,
  type ProfileSearchResult,
} from "./gamma";

// Re-export Gamma API - Sports
export {
  getTeams,
  getTeamById,
  getTeamByAbbreviation,
  getValidSportsMarketTypes,
  getSportsMetadata,
  getTeamsByLeague,
  searchTeams,
  type SportsTeam,
  type SportsMarketType,
  type SportsMetadata,
} from "./gamma";

// Re-export CLOB API
export {
  getPriceHistory,
  getOrderBookSummary,
  getOrderBookSummaries,
  getMarketQuotes,
  getMarketDepth,
  getCurrentPrice,
  getMidpointPrice,
} from "./clob";

export type {
  OrderBookSummary,
  MarketQuote,
  MarketDepth,
} from "./clob";

export {
  placeOrder,
  cancelOrder,
  cancelAllOrders,
  cancelOrdersBulk,
  cancelOrdersForAssetIds,
  fetchOpenOrders,
  fetchTradeHistory,
} from "./clob";

// Re-export Data API
export {
  fetchPositions,
  calculatePortfolioSummary,
  getPositionByAsset,
  getActivePositions,
  getRedeemablePositions,
} from "./data";

export {
  fetchActivity,
  fetchRecentActivity,
} from "./data";

export type { ActivityItem } from "./data";
