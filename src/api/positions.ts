/**
 * Backward-compatible Data API client for user position data.
 * Canonical implementation lives in src/api/data/positions.ts.
 */

export {
  fetchPositions,
  calculatePortfolioSummary,
  fetchPortfolioValue,
  getPositionByAsset,
  getActivePositions,
  getRedeemablePositions,
  invalidatePositionsCache,
} from "./data/positions";
