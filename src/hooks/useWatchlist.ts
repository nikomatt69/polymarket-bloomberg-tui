/**
 * Watchlist — persisted set of pinned market IDs with filter mode toggle
 */

import { createStore } from "solid-js/store";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface WatchlistState {
  marketIds: string[];
  filterActive: boolean; // when true, market list shows only watchlisted markets
}

export const [watchlistState, setWatchlistState] = createStore<WatchlistState>({
  marketIds: [],
  filterActive: false,
});

// ─── persistence ────────────────────────────────────────────────────────────

function getWatchlistPath(): string {
  const dir = join(homedir(), ".polymarket-tui");
  try { mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  return join(dir, "watchlist.json");
}

export function loadWatchlist(): void {
  try {
    const raw = readFileSync(getWatchlistPath(), "utf-8");
    const ids: string[] = JSON.parse(raw);
    setWatchlistState("marketIds", Array.isArray(ids) ? ids : []);
  } catch {
    setWatchlistState("marketIds", []);
  }
}

function saveWatchlist(): void {
  try {
    writeFileSync(getWatchlistPath(), JSON.stringify(watchlistState.marketIds, null, 2));
  } catch { /* silent */ }
}

// ─── actions ─────────────────────────────────────────────────────────────────

export function addToWatchlist(marketId: string): void {
  if (watchlistState.marketIds.includes(marketId)) return;
  setWatchlistState("marketIds", (prev) => [...prev, marketId]);
  saveWatchlist();
}

export function removeFromWatchlist(marketId: string): void {
  setWatchlistState("marketIds", (prev) => prev.filter((id) => id !== marketId));
  saveWatchlist();
}

export function toggleWatchlist(marketId: string): void {
  if (watchlistState.marketIds.includes(marketId)) {
    removeFromWatchlist(marketId);
  } else {
    addToWatchlist(marketId);
  }
}

export function toggleWatchlistFilter(): void {
  setWatchlistState("filterActive", !watchlistState.filterActive);
}

export function isWatched(marketId: string): boolean {
  return watchlistState.marketIds.includes(marketId);
}
