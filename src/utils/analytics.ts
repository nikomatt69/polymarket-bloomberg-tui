import { Position, PortfolioSummary } from "../types/positions";
import { PlacedOrder } from "../types/orders";

export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalVolume: number;
  avgTradeSize: number;
  totalProfit: number;
  totalLoss: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
}

export interface MonthlyStats {
  month: string;
  volume: number;
  pnl: number;
  tradeCount: number;
}

export interface MarketConcentrationEntry {
  marketTitle: string;
  value: number;
  percentage: number;
  pnl: number;
  outcomeCount: number;
}

export interface MarketConcentrationRisk {
  hhi: number;
  topExposurePct: number;
  effectiveMarketCount: number;
  riskLevel: "low" | "medium" | "high";
  entries: MarketConcentrationEntry[];
}

export interface AssetAllocation {
  outcome: string;
  value: number;
  percentage: number;
}

export function calculateTradeStats(orders: PlacedOrder[], positions: Position[]): TradeStats {
  const filledOrders = orders.filter(o => o.status === "FILLED" || o.status === "MATCHED");
  
  if (filledOrders.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalVolume: 0,
      avgTradeSize: 0,
      totalProfit: 0,
      totalLoss: 0,
      netPnl: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
    };
  }

  const totalVolume = filledOrders.reduce((sum, o) => sum + (o.price * o.originalSize), 0);
  const avgTradeSize = totalVolume / filledOrders.length;

  const winningTrades = filledOrders.filter(o => {
    const position = positions.find(p => p.asset === o.tokenId);
    return position && position.cashPnl > 0;
  }).length;
  
  const losingTrades = filledOrders.filter(o => {
    const position = positions.find(p => p.asset === o.tokenId);
    return position && position.cashPnl < 0;
  }).length;

  const profits = positions.filter(p => p.cashPnl > 0).map(p => p.cashPnl);
  const losses = positions.filter(p => p.cashPnl < 0).map(p => p.cashPnl);

  const totalProfit = profits.reduce((sum, p) => sum + p, 0);
  const totalLoss = Math.abs(losses.reduce((sum, p) => sum + p, 0));
  const netPnl = totalProfit - totalLoss;

  return {
    totalTrades: filledOrders.length,
    winningTrades,
    losingTrades,
    winRate: filledOrders.length > 0 ? (winningTrades / filledOrders.length) * 100 : 0,
    totalVolume,
    avgTradeSize,
    totalProfit,
    totalLoss,
    netPnl,
    avgWin: profits.length > 0 ? totalProfit / profits.length : 0,
    avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
    largestWin: profits.length > 0 ? Math.max(...profits) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses) : 0,
    profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
  };
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

export function calculateAssetAllocation(positions: Position[]): AssetAllocation[] {
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  if (totalValue === 0) return [];

  return positions.map(p => ({
    outcome: p.outcome,
    value: p.currentValue,
    percentage: (p.currentValue / totalValue) * 100,
  })).sort((a, b) => b.value - a.value);
}

export function calculateMonthlyStats(orders: PlacedOrder[]): MonthlyStats[] {
  type Bucket = MonthlyStats & { monthStartTs: number };
  type Lot = { size: number; price: number };

  const monthlyMap = new Map<string, Bucket>();
  const inventoryLots = new Map<string, Lot[]>();

  const filledOrders = orders
    .filter((order) => order.status === "FILLED" || order.status === "MATCHED")
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const order of filledOrders) {
    const filledSize = order.sizeMatched > 0 ? order.sizeMatched : order.originalSize;
    if (!Number.isFinite(filledSize) || filledSize <= 0) {
      continue;
    }

    const date = new Date(order.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = date.toLocaleString("en-US", { month: "short", year: "2-digit" });
    const monthStartTs = Date.UTC(date.getFullYear(), date.getMonth(), 1);

    const bucket = monthlyMap.get(monthKey) ?? {
      month: monthLabel,
      volume: 0,
      pnl: 0,
      tradeCount: 0,
      monthStartTs,
    };

    bucket.volume += order.price * filledSize;
    bucket.tradeCount += 1;

    const tokenLots = inventoryLots.get(order.tokenId) ?? [];

    if (order.side === "BUY") {
      tokenLots.push({ size: filledSize, price: order.price });
      inventoryLots.set(order.tokenId, tokenLots);
    } else {
      let remainingToMatch = filledSize;
      let realizedPnl = 0;

      while (remainingToMatch > 1e-8 && tokenLots.length > 0) {
        const lot = tokenLots[0]!;
        const matchedSize = Math.min(remainingToMatch, lot.size);
        realizedPnl += (order.price - lot.price) * matchedSize;

        lot.size -= matchedSize;
        remainingToMatch -= matchedSize;

        if (lot.size <= 1e-8) {
          tokenLots.shift();
        }
      }

      bucket.pnl += realizedPnl;
      inventoryLots.set(order.tokenId, tokenLots);
    }

    monthlyMap.set(monthKey, bucket);
  }

  return Array.from(monthlyMap.values())
    .sort((a, b) => b.monthStartTs - a.monthStartTs)
    .map(({ monthStartTs: _monthStartTs, ...row }) => row);
}

export function calculateMarketConcentration(positions: Position[]): MarketConcentrationRisk {
  const totalValue = positions.reduce((sum, position) => sum + position.currentValue, 0);

  if (totalValue <= 0) {
    return {
      hhi: 0,
      topExposurePct: 0,
      effectiveMarketCount: 0,
      riskLevel: "low",
      entries: [],
    };
  }

  const marketMap = new Map<string, MarketConcentrationEntry>();

  for (const position of positions) {
    const key = position.title || "Unknown market";
    const existing = marketMap.get(key);
    if (existing) {
      existing.value += position.currentValue;
      existing.pnl += position.cashPnl;
      existing.outcomeCount += 1;
    } else {
      marketMap.set(key, {
        marketTitle: key,
        value: position.currentValue,
        percentage: 0,
        pnl: position.cashPnl,
        outcomeCount: 1,
      });
    }
  }

  const entries = Array.from(marketMap.values())
    .map((entry) => ({
      ...entry,
      percentage: (entry.value / totalValue) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  const hhi = entries.reduce((sum, entry) => sum + entry.percentage * entry.percentage, 0);
  const topExposurePct = entries[0]?.percentage ?? 0;
  const effectiveMarketCount = hhi > 0 ? 10_000 / hhi : 0;
  const riskLevel: "low" | "medium" | "high" =
    hhi >= 3_500 || topExposurePct >= 55
      ? "high"
      : hhi >= 2_000 || topExposurePct >= 35
        ? "medium"
        : "low";

  return {
    hhi,
    topExposurePct,
    effectiveMarketCount,
    riskLevel,
    entries,
  };
}

export function calculateROI(initialBalance: number, currentValue: number): number {
  if (initialBalance === 0) return 0;
  return ((currentValue - initialBalance) / initialBalance) * 100;
}

export function calculateMaxDrawdown(values: number[]): number {
  if (values.length < 2) return 0;
  
  let maxDrawdown = 0;
  let peak = values[0];
  
  for (const value of values) {
    if (value > peak) peak = value;
    const drawdown = ((peak - value) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  return maxDrawdown;
}

export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
  if (returns.length < 2) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  return (avgReturn - riskFreeRate) / stdDev;
}

export function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
  } else if (absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(2)}K`;
  }
  return `${sign}$${absValue.toFixed(2)}`;
}

export function formatPercentage(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
}

export interface PnLTimeSeriesEntry {
  date: string;
  value: number;
  pnl: number;
}

export function calculatePnLTimeSeries(orders: PlacedOrder[], positions: Position[]): PnLTimeSeriesEntry[] {
  const dailyMap = new Map<string, { value: number; pnl: number }>();

  const filledOrders = orders
    .filter((o) => o.status === "FILLED" || o.status === "MATCHED")
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const order of filledOrders) {
    const date = new Date(order.createdAt).toISOString().split("T")[0]!;
    const existing = dailyMap.get(date) || { value: 0, pnl: 0 };
    const tradeValue = order.price * (order.sizeMatched > 0 ? order.sizeMatched : order.originalSize);

    if (order.side === "BUY") {
      existing.value += tradeValue;
    } else {
      existing.value -= tradeValue;
      const position = positions.find((p) => p.asset === order.tokenId);
      existing.pnl += position ? position.cashPnl : 0;
    }

    dailyMap.set(date, existing);
  }

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface PositionRiskScore {
  positionId: string;
  outcome: string;
  score: number;
  factors: {
    concentrationRisk: number;
    volatilityRisk: number;
    liquidityRisk: number;
    pnlRisk: number;
  };
  recommendation: "hold" | "reduce" | "close";
}

export function calculatePositionRisk(positions: Position[], markets: { id: string; volume: number; prices: number[] }[]): PositionRiskScore[] {
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  if (totalValue === 0) return [];

  return positions.map((position) => {
    const market = markets.find((m) => m.id === position.marketId || m.id === position.asset);
    const currentPrice = position.currentPrice || 0.5;
    const volume = market?.volume || 0;

    const concentrationRisk = (position.currentValue / totalValue) * 100;
    const volatilityRisk = Math.abs(position.currentPrice - 0.5) * 100 * 2;
    const liquidityRisk = volume < 10000 ? 50 : volume < 50000 ? 25 : 0;
    const pnlRisk = position.cashPnl < 0 ? Math.min(50, Math.abs(position.cashPnl) / position.initialValue * 100) : 0;

    const score = Math.min(100, concentrationRisk * 0.4 + volatilityRisk * 0.3 + liquidityRisk * 0.2 + pnlRisk * 0.1);

    let recommendation: "hold" | "reduce" | "close" = "hold";
    if (score >= 70 || concentrationRisk >= 50) recommendation = "close";
    else if (score >= 40) recommendation = "reduce";

    return {
      positionId: position.asset || position.id,
      outcome: position.outcome,
      score: Math.round(score),
      factors: {
        concentrationRisk: Math.round(concentrationRisk),
        volatilityRisk: Math.round(volatilityRisk),
        liquidityRisk,
        pnlRisk: Math.round(pnlRisk),
      },
      recommendation,
    };
  }).sort((a, b) => b.score - a.score);
}
