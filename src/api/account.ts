import { Position, PortfolioSummary } from "../types/positions";
import { PlacedOrder } from "../types/orders";
import { fetchPositions } from "./positions";
import { fetchTradeHistory, fetchOpenOrders } from "./orders";
import {
  calculateTradeStats,
  calculatePortfolioSummary,
  calculateAssetAllocation,
  calculateMonthlyStats,
  TradeStats,
  AssetAllocation,
  MonthlyStats
} from "../utils/analytics";
import { walletState } from "../state";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const ACCOUNT_CACHE_FILE = join(homedir(), ".polymarket-tui", "account-cache.json");

function ensureAccountCacheDir(): void {
  const dir = join(homedir(), ".polymarket-tui");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadCachedAccountOverview(): AccountOverview | null {
  try {
    ensureAccountCacheDir();
    if (!existsSync(ACCOUNT_CACHE_FILE)) return null;
    const content = readFileSync(ACCOUNT_CACHE_FILE, "utf-8");
    return JSON.parse(content) as AccountOverview;
  } catch {
    return null;
  }
}

function saveCachedAccountOverview(overview: AccountOverview): void {
  try {
    ensureAccountCacheDir();
    writeFileSync(ACCOUNT_CACHE_FILE, JSON.stringify(overview, null, 2));
  } catch (e) {
    console.error("Failed to cache account overview:", e);
  }
}

export interface AccountOverview {
  portfolioSummary: PortfolioSummary;
  tradeStats: TradeStats;
  assetAllocation: AssetAllocation[];
  monthlyStats: MonthlyStats[];
  openOrdersCount: number;
  lastUpdated: number;
}

export interface AccountMetrics {
  totalBalance: number;
  availableBalance: number;
  lockedInPositions: number;
  totalPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export async function fetchAccountOverview(): Promise<AccountOverview | null> {
  // Try to return cached data first if wallet not connected
  if (!walletState.connected || !walletState.address) {
    const cached = loadCachedAccountOverview();
    return cached;
  }

  try {
    const lookupAddress = walletState.funderAddress ?? walletState.address;
    const [positions, tradeHistory, openOrders] = await Promise.all([
      fetchPositions(lookupAddress!),
      fetchTradeHistory(),
      fetchOpenOrders(),
    ]);

    const portfolioSummary = calculatePortfolioSummary(positions);
    const tradeStats = calculateTradeStats(tradeHistory, positions);
    const assetAllocation = calculateAssetAllocation(positions);
    const monthlyStats = calculateMonthlyStats(tradeHistory);

    const overview: AccountOverview = {
      portfolioSummary,
      tradeStats,
      assetAllocation,
      monthlyStats,
      openOrdersCount: openOrders.length,
      lastUpdated: Date.now(),
    };

    // Cache the result
    saveCachedAccountOverview(overview);

    return overview;
  } catch (error) {
    console.error("Failed to fetch account overview:", error);
    // Try to return cached data on error
    const cached = loadCachedAccountOverview();
    return cached;
  }
}

export function calculateAccountMetrics(
  usdcBalance: number,
  positions: Position[],
  tradeHistory: PlacedOrder[]
): AccountMetrics {
  const portfolioSummary = calculatePortfolioSummary(positions);
  const unrealizedPnl = portfolioSummary.totalCashPnl;

  const realizedPnl = tradeHistory
    .filter(o => o.status === "FILLED" || o.status === "MATCHED")
    .reduce((sum, o) => {
      const position = positions.find(p => p.asset === o.tokenId);
      if (position) {
        return sum + position.cashPnl;
      }
      return sum;
    }, 0);

  return {
    totalBalance: usdcBalance + portfolioSummary.totalValue,
    availableBalance: usdcBalance,
    lockedInPositions: portfolioSummary.totalValue,
    totalPnl: unrealizedPnl,
    unrealizedPnl,
    realizedPnl,
  };
}

export function getAccountHealthScore(metrics: AccountMetrics): number {
  if (metrics.totalBalance === 0) return 0;

  const liquidityScore = (metrics.availableBalance / metrics.totalBalance) * 100;
  const pnlScore = metrics.totalPnl > 0 ? Math.min(100, 50 + metrics.totalPnl / 10) : Math.max(0, 50 + metrics.totalPnl / 10);
  
  return Math.round((liquidityScore + pnlScore) / 2);
}

export function getAccountRiskLevel(metrics: AccountMetrics): "low" | "medium" | "high" {
  if (metrics.totalBalance === 0) return "low";
  
  const exposureRatio = metrics.lockedInPositions / metrics.totalBalance;
  
  if (exposureRatio < 0.3) return "low";
  if (exposureRatio < 0.7) return "medium";
  return "high";
}
