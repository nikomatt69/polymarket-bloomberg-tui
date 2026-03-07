/**
 * Polymarket CLOB API
 * Order book, prices, trading, and order history
 */

// Prices & Order Book
export {
  getPriceHistory,
  getOrderBookSummary,
  getOrderBookSummaries,
  getMarketQuotes,
  getMarketDepth,
  getCurrentPrice,
  getMidpointPrice,
  getBatchPrices,
  getBatchMidpoints,
  getLastTradePrice,
  getLastTradeSnapshot,
  getBatchLastTradePrices,
  getBatchLastTradeSnapshots,
} from "./prices";

export type {
  OrderBookSummary,
  MarketQuote,
  MarketDepth,
  LastTradeSnapshot,
} from "./prices";

// Trading
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
} from "./trading";

// Misc (spread, fee-rates, tick-size)
export {
  getSpread,
  getSpreads,
  getSpreadsMap,
  getFeeRates,
  getTickSize,
  getMultipleOrderBooks,
  getOrderDetails,
  getServerTime,
  isMarketHealthy,
  getHealthStatus,
  type SpreadResponse,
  type FeeRatesResponse,
  type FeeRate,
  type TickSizeResponse,
  type OrderDetails,
  type HealthStatus,
} from "./misc";

// Additional (fills, assets, candles, etc.)
export {
  getFills,
  getAssets,
  getAssetById,
  getCandles,
  getMarketStats,
  getHistoricalVolume,
  getAggregatedOrderBook,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  getUserInfo,
  estimateGas,
  getTransactions,
  type Fill,
  type Asset,
  type Candle,
  type MarketStats,
  type VolumeData,
  type AggregatedBook,
  type AggregatedOrder,
  type ApiKey,
  type UserInfo,
  type GasEstimate,
  type Transaction,
} from "./additional";
