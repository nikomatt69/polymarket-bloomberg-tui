/**
 * Polymarket Data API client for user position data
 */

import { Position, PortfolioSummary } from "../types/positions";

const DATA_API_BASE = "https://data-api.polymarket.com";

interface DataApiPosition {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  curPrice: number;
  outcome: string;
  title: string;
  endDate: string | null;
  redeemable: boolean;
  initialValue: number;
}

function mapPosition(raw: DataApiPosition): Position {
  return {
    asset: raw.asset,
    conditionId: raw.conditionId,
    size: raw.size ?? 0,
    avgPrice: raw.avgPrice ?? 0,
    currentValue: raw.currentValue ?? 0,
    cashPnl: raw.cashPnl ?? 0,
    percentPnl: raw.percentPnl ?? 0,
    curPrice: raw.curPrice ?? 0,
    outcome: raw.outcome ?? "",
    title: raw.title ?? "Unknown Market",
    endDate: raw.endDate ?? null,
    redeemable: raw.redeemable ?? false,
    initialValue: raw.initialValue ?? 0,
  };
}

export async function fetchPositions(address: string): Promise<Position[]> {
  const response = await fetch(
    `${DATA_API_BASE}/positions?user=${address}&limit=100`
  );

  if (!response.ok) {
    throw new Error(`Data API error: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return (data as DataApiPosition[]).map(mapPosition);
}

export function calculatePortfolioSummary(positions: Position[]): PortfolioSummary {
  if (positions.length === 0) {
    return { totalValue: 0, totalCashPnl: 0, totalPercentPnl: 0, positionCount: 0 };
  }

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalCashPnl = positions.reduce((sum, p) => sum + p.cashPnl, 0);
  const totalInitial = positions.reduce((sum, p) => sum + p.initialValue, 0);
  const totalPercentPnl = totalInitial > 0 ? (totalCashPnl / totalInitial) * 100 : 0;

  return {
    totalValue,
    totalCashPnl,
    totalPercentPnl,
    positionCount: positions.length,
  };
}
