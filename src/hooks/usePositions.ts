/**
 * SolidJS reactive hook for user position state management
 */

import { createStore, produce } from "solid-js/store";
import { Position, PositionAnalytics, SectorAllocation } from "../types/positions";
import { fetchPositions, calculatePortfolioSummary as calcSummary, invalidatePositionsCache } from "../api/data/positions";
import { walletState } from "../state";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const POSITIONS_FILE = join(homedir(), ".polymarket-tui", "positions.json");

function ensurePositionsDir(): void {
  const dir = join(homedir(), ".polymarket-tui");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadPersistedPositions(): Position[] {
  try {
    ensurePositionsDir();
    if (!existsSync(POSITIONS_FILE)) return [];
    const content = readFileSync(POSITIONS_FILE, "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) return data as Position[];
    return [];
  } catch {
    return [];
  }
}

function savePersistedPositions(positions: Position[]): void {
  try {
    ensurePositionsDir();
    writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2));
  } catch (e) {
    console.error("Failed to persist positions:", e);
  }
}

export type PositionTag = "long" | "short" | "neutral";

interface PositionsState {
  positions: Position[];
  positionsAnalytics: PositionAnalytics;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

export const [positionsState, setPositionsState] = createStore<PositionsState>({
  positions: loadPersistedPositions(),
  positionsAnalytics: {
    totalValue: 0,
    totalCashPnl: 0,
    totalPercentPnl: 0,
    positionCount: 0,
    weightedAvgEntry: 0,
    largestPosition: null,
    smallestPosition: null,
    sectorAllocations: [],
    topPerformers: [],
    bottomPerformers: [],
    bestPerformer: null,
    worstPerformer: null,
  },
  loading: false,
  error: null,
  lastFetch: null,
});

function inferSector(title: string): string {
  const t = title.toLowerCase();
  
  const sectors: [string, RegExp][] = [
    ["Politics", /(?:election|president|trump|biden|democrat|republican|congress|senate|governor|mayor)/i],
    ["Sports", /(?:nfl|nba|mlb|nhl|football|basketball|baseball|hockey|soccer|olympic|world cup|super bowl)/i],
    ["Crypto", /(?:bitcoin|btc|ethereum|eth|solana|crypto|token|defi|nft|web3)/i],
    ["Economics", /(?:fed|interest rate|inflation|gdp|recession|unemployment|economy|market|crash)/i],
    ["Tech", /(?:ai|tech|apple|microsoft|google|meta|amazon|startup|valuation|ipo)/i],
    ["Entertainment", /(?:oscar|grammy|emmys|award|movie|film|series|tv|netflix|box office)/i],
    ["Science", /(?:climate|weather|temperature|pandemic|virus|vaccine|space|nasa)/i],
    ["World", /(?:war|ukraine|russia|china|europe|asia|middle east|global)/i],
  ];
  
  for (const [sector, regex] of sectors) {
    if (regex.test(t)) return sector;
  }
  
  return "Other";
}

function computePositionTag(avgPrice: number, curPrice: number): PositionTag {
  if (avgPrice === 0) return "neutral";
  const diff = (curPrice - avgPrice) / avgPrice;
  if (diff > 0.02) return "long";
  if (diff < -0.02) return "short";
  return "neutral";
}

function calculatePositionsAnalytics(positions: Position[]): PositionAnalytics {
  const summary = calcSummary(positions);
  
  if (positions.length === 0) {
    return {
      ...summary,
      weightedAvgEntry: 0,
      largestPosition: null,
      smallestPosition: null,
      sectorAllocations: [],
      topPerformers: [],
      bottomPerformers: [],
      bestPerformer: null,
      worstPerformer: null,
    };
  }

  // Weighted average entry price
  const totalCost = positions.reduce((sum, p) => sum + p.initialValue, 0);
  const weightedAvgEntry = totalCost > 0 
    ? positions.reduce((sum, p) => sum + (p.avgPrice * p.initialValue), 0) / totalCost
    : 0;

  // Sort by value for largest/smallest
  const sortedByValue = [...positions].sort((a, b) => b.currentValue - a.currentValue);
  
  // Sector allocation
  const sectorMap = new Map<string, { value: number; pnl: number; count: number }>();
  for (const pos of positions) {
    const sector = inferSector(pos.title);
    const existing = sectorMap.get(sector);
    if (existing) {
      existing.value += pos.currentValue;
      existing.pnl += pos.cashPnl;
      existing.count += 1;
    } else {
      sectorMap.set(sector, { value: pos.currentValue, pnl: pos.cashPnl, count: 1 });
    }
  }
  
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const sectorAllocations: SectorAllocation[] = Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      pnl: data.pnl,
      positionCount: data.count,
    }))
    .sort((a, b) => b.value - a.value);

  // Best/worst performers
  const sortedByPnl = [...positions].sort((a, b) => b.cashPnl - a.cashPnl);
  const topPerformers = sortedByPnl.slice(0, 3).map(p => ({
    title: p.title,
    outcome: p.outcome,
    pnl: p.cashPnl,
    roi: p.percentPnl,
  }));
  
  const bottomPerformers = sortedByPnl.slice(-3).reverse().map(p => ({
    title: p.title,
    outcome: p.outcome,
    pnl: p.cashPnl,
    roi: p.percentPnl,
  }));

  return {
    ...summary,
    weightedAvgEntry,
    largestPosition: sortedByValue[0] ?? null,
    smallestPosition: sortedByValue[sortedByValue.length - 1] ?? null,
    sectorAllocations,
    topPerformers,
    bottomPerformers,
    bestPerformer: topPerformers[0] ?? null,
    worstPerformer: bottomPerformers[bottomPerformers.length - 1] ?? null,
  };
}

export async function fetchUserPositions(): Promise<void> {
  if (!walletState.connected || !walletState.address) return;

  setPositionsState("loading", true);
  setPositionsState("error", null);

  // Positions are held by the proxy/funder wallet, not the EOA
  const lookupAddress = walletState.funderAddress ?? walletState.address;

  try {
    const positions = await fetchPositions(lookupAddress);
    const analytics = calculatePositionsAnalytics(positions);

    // Persist positions to disk
    savePersistedPositions(positions);

    setPositionsState(produce((state) => {
      state.positions = positions;
      state.positionsAnalytics = analytics;
      state.lastFetch = new Date();
    }));
  } catch (err) {
    setPositionsState("error", err instanceof Error ? err.message : "Failed to fetch positions");
  } finally {
    setPositionsState("loading", false);
  }
}

export const refreshPositions = fetchUserPositions;

export function invalidateAndRefreshPositions(): void {
  invalidatePositionsCache();
  void fetchUserPositions();
}
