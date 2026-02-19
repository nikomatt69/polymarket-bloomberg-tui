/**
 * Polymarket Data API
 * Positions and user activity
 */

// Positions
export {
  fetchPositions,
  calculatePortfolioSummary,
  getPositionByAsset,
  getActivePositions,
  getRedeemablePositions,
} from "./positions";

// Activity
export {
  fetchActivity,
  fetchRecentActivity,
} from "./activity";

export type { ActivityItem } from "./activity";

// Misc
export {
  fetchClosedPositions,
  fetchPositionValues,
  fetchTraderLeaderboard,
  fetchTraderProfile,
  searchTraderProfiles,
  fetchMarketMakers,
  fetchPortfolioAnalytics,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchReferralStats,
  createReferralLink,
  fetchUserSettings,
  updateUserSettings,
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  fetchPriceAlerts,
  createPriceAlert,
  deletePriceAlert,
  fetchMarketComments,
  postComment,
  fetchGlobalStats,
  fetchFeaturedMarkets,
  type ClosedPosition,
  type PositionValue,
  type PositionValuesResponse,
  type TraderLeaderboardEntry,
  type TraderLeaderboardResponse,
  type TraderProfile,
  type MarketMakerStats,
  type PortfolioAnalytics,
  type Notification,
  type ReferralStats,
  type ReferralLink,
  type UserSettings,
  type WatchlistItem,
  type PriceAlert,
  type MarketComment,
  type GlobalStats,
  type FeaturedMarket,
} from "./misc";

// Builders
export {
  fetchBuilderLeaderboard,
  fetchBuilderStats,
  fetchBuilderMarkets,
  type BuilderEntry,
  type BuilderLeaderboardResponse,
  type BuilderStats,
  type BuilderMarket,
} from "./builders";
