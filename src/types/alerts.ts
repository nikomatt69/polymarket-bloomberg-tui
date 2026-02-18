/**
 * Price alert types
 */

export type AlertCondition = "above" | "below";
export type AlertStatus = "active" | "triggered" | "dismissed";
export type AlertMetric = "price" | "change24h" | "volume24h" | "liquidity";

export interface PriceAlert {
  id: string;
  marketId: string;
  marketTitle: string;
  outcomeId: string;
  outcomeTitle: string;
  metric: AlertMetric;
  condition: AlertCondition;
  threshold: number;
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
}
