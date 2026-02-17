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
  const monthlyMap = new Map<string, MonthlyStats>();

  orders.forEach(order => {
    if (order.status !== "FILLED" && order.status !== "MATCHED") return;
    
    const date = new Date(order.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = date.toLocaleString("en-US", { month: "short", year: "2-digit" });
    
    const volume = order.price * order.originalSize;
    
    const existing = monthlyMap.get(monthKey);
    if (existing) {
      existing.volume += volume;
      existing.tradeCount += 1;
    } else {
      monthlyMap.set(monthKey, {
        month: monthLabel,
        volume,
        pnl: 0,
        tradeCount: 1,
      });
    }
  });

  return Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
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
