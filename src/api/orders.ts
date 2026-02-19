/**
 * Backward-compatible trading facade.
 * Canonical implementation lives in src/api/clob/trading.ts.
 */

export {
  placeOrder,
  cancelOrder,
  cancelAllOrders,
  cancelOrdersBulk,
  cancelOrdersForAssetIds,
  fetchOpenOrders,
  fetchTradeHistory,
} from "./clob/trading";
