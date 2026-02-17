/**
 * Price alert types
 */

export type AlertCondition = "above" | "below";
export type AlertStatus = "active" | "triggered" | "dismissed";

export interface PriceAlert {
  id: string;
  marketId: string;
  marketTitle: string;
  outcomeTitle: string;
  condition: AlertCondition;
  threshold: number; // 0-1
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
}
