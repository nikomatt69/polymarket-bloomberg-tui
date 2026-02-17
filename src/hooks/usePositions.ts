/**
 * SolidJS reactive hook for user position state management
 */

import { createStore } from "solid-js/store";
import { Position } from "../types/positions";
import { fetchPositions } from "../api/positions";
import { walletState } from "../state";

interface PositionsState {
  positions: Position[];
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

export const [positionsState, setPositionsState] = createStore<PositionsState>({
  positions: [],
  loading: false,
  error: null,
  lastFetch: null,
});

export async function fetchUserPositions(): Promise<void> {
  if (!walletState.connected || !walletState.address) return;

  setPositionsState("loading", true);
  setPositionsState("error", null);

  try {
    const positions = await fetchPositions(walletState.address);
    setPositionsState("positions", positions);
    setPositionsState("lastFetch", new Date());
  } catch (err) {
    setPositionsState("error", err instanceof Error ? err.message : "Failed to fetch positions");
  } finally {
    setPositionsState("loading", false);
  }
}

export const refreshPositions = fetchUserPositions;
