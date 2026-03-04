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
  getMarketBySlug,
  getMarketHistory,
  getTopHolders,
  getSampledMarkets,
  getSimplifiedMarkets,
  getMarketFilters,
  getGroupItems,
  getMarketResolutionStatus,
  getTrendingMarketsList,
  getPopularMarkets,
  getMarketComments,
  postMarketComment,
  getRelatedMarkets,
  getFeaturedMarkets,
  getClosedMarkets,
  getResolvedMarkets,
  type MarketFilters,
  type TopHolder,
  type SimplifiedMarket,
  type MarketFilterOptions,
  type GroupItem,
  type MarketResolution,
  type TrendingMarket,
  type MarketComment,
  type FeaturedGroup,
} from "./markets";

// Events
export {
  getActiveEvents,
  getEventById,
  getEventBySlug,
  getEventsBySeries,
  getEventsByTag,
  getFeaturedEvents,
  type EventFilters,
} from "./events";

// Series
export {
  getSeries,
  getSeriesById,
  getSeriesBySlug,
  getMarketsBySeries,
} from "./series";

// Tags
export {
  getTags,
  getTagId,
  getTagBySlug,
  getMarketsByTag,
} from "./tags";

// Categories
export {
  getCategories,
  getCategoryBySlug,
  getCategoryTagId,
  POLYMARKET_CATEGORIES,
} from "./categories";

export type { PolymarketCategoryId } from "./categories";

// Search
export {
  search,
  publicSearch,
  searchEvents,
  searchMarketsByQuery,
  searchProfiles,
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
  getSportById,
  getSportLeagues,
  type SportsTeam,
  type SportsMarketType,
  type SportsMetadata,
} from "./sports";
