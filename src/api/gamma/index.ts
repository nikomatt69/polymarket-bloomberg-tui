/**
 * Polymarket Gamma API
 * All market data, events, series, tags, categories, search, and sports
 */

// Markets
export {
  getMarkets,
  getMarketDetails,
  getMarketsByCategory,
  searchMarkets,
  getTrendingMarkets,
  getLiveSportsMarkets,
  type MarketFilters,
} from "./markets";

// Events
export {
  getActiveEvents,
  getEventById,
  getEventsBySeries,
  type EventFilters,
} from "./events";

// Series
export {
  getSeries,
  getSeriesById,
  getMarketsBySeries,
} from "./series";

// Tags
export {
  getTags,
  getTagBySlug,
  getMarketsByTag,
} from "./tags";

// Categories
export {
  getCategories,
  getCategoryBySlug,
  POLYMARKET_CATEGORIES,
} from "./categories";

export type { PolymarketCategoryId } from "./categories";

// Search
export {
  search,
  searchEvents,
  searchMarketsByQuery,
  searchTags,
  type SearchFilters,
  type SearchResult,
  type ProfileSearchResult,
} from "./search";

// Sports
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
} from "./sports";
