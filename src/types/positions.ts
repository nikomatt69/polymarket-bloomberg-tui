/**
 * Position and portfolio types for Polymarket Data API
 */

export interface Position {
  asset: string;
  conditionId: string;
  size: number;          // shares held
  avgPrice: number;      // average purchase price (0-1)
  currentValue: number;  // current total value in USDC
  cashPnl: number;       // profit/loss in USDC
  percentPnl: number;    // profit/loss as percentage
  curPrice: number;      // current market price (0-1)
  outcome: string;       // "YES" / "NO" or outcome title
  title: string;         // market title
  endDate: string | null;
  redeemable: boolean;
  initialValue: number;  // cost basis in USDC
}

export interface PortfolioSummary {
  totalValue: number;
  totalCashPnl: number;
  totalPercentPnl: number;
  positionCount: number;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
  pnl: number;
  positionCount: number;
}

export interface Performers {
  title: string;
  outcome: string;
  pnl: number;
  roi: number;
}

export interface PositionAnalytics extends PortfolioSummary {
  weightedAvgEntry: number;
  largestPosition: Position | null;
  smallestPosition: Position | null;
  sectorAllocations: SectorAllocation[];
  topPerformers: Performers[];
  bottomPerformers: Performers[];
  bestPerformer: Performers | null;
  worstPerformer: Performers | null;
}
