/**
 * Price alert types
 */

export type AlertCondition = "above" | "below" | "crossesAbove" | "crossesBelow";
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
  cooldownMinutes: number;
  debouncePasses: number;
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
  lastNotifiedAt?: number;
  triggerCount?: number;
}
