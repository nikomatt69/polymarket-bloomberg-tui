/**
 * Backward-compatible trading facade.
 * Canonical implementation lives in src/api/clob/trading.ts.
 */

export {
  placeOrder,
  placeBatchOrders,
  cancelOrder,
  cancelAllOrders,
  cancelOrdersBulk,
  cancelOrdersForAssetIds,
  getOrderScoringStatus,
  fetchOpenOrders,
  fetchTradeHistory,
} from "./clob/trading";
