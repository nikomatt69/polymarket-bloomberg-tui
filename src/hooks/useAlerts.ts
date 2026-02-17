/**
 * Price alert management — persistence, evaluation, notification
 */

import { createStore } from "solid-js/store";
import { PriceAlert, AlertCondition } from "../types/alerts";
import { Market } from "../types/market";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface AlertsState {
  alerts: PriceAlert[];
  panelOpen: boolean;
  lastTriggered: string | null; // alert id
  // add-form sub-state (driven from app.tsx keyboard handler)
  adding: boolean;
  addCondition: "above" | "below";
  addThreshold: string;
  addFocus: "condition" | "threshold";
  addError: string;
  selectedIdx: number;
}

export const [alertsState, setAlertsState] = createStore<AlertsState>({
  alerts: [],
  panelOpen: false,
  lastTriggered: null,
  adding: false,
  addCondition: "above",
  addThreshold: "",
  addFocus: "threshold",
  addError: "",
  selectedIdx: 0,
});

// ─── persistence ────────────────────────────────────────────────────────────

function getAlertsPath(): string {
  const dir = join(homedir(), ".polymarket-tui");
  try { mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  return join(dir, "alerts.json");
}

export function loadAlerts(): void {
  try {
    const raw = readFileSync(getAlertsPath(), "utf-8");
    const alerts: PriceAlert[] = JSON.parse(raw);
    setAlertsState("alerts", Array.isArray(alerts) ? alerts : []);
  } catch {
    setAlertsState("alerts", []);
  }
}

function saveAlerts(): void {
  try {
    writeFileSync(getAlertsPath(), JSON.stringify(alertsState.alerts, null, 2));
  } catch { /* silent */ }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export function addAlert(
  marketId: string,
  marketTitle: string,
  outcomeTitle: string,
  condition: AlertCondition,
  threshold: number
): void {
  const alert: PriceAlert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    marketId,
    marketTitle,
    outcomeTitle,
    condition,
    threshold,
    status: "active",
    createdAt: Date.now(),
  };
  setAlertsState("alerts", (prev) => [alert, ...prev]);
  saveAlerts();
}

export function dismissAlert(id: string): void {
  setAlertsState("alerts", (prev) =>
    prev.map((a) => (a.id === id ? { ...a, status: "dismissed" as const } : a))
  );
  saveAlerts();
}

export function deleteAlert(id: string): void {
  setAlertsState("alerts", (prev) => prev.filter((a) => a.id !== id));
  saveAlerts();
}

// ─── evaluation ──────────────────────────────────────────────────────────────

/**
 * Called after each market refresh — checks active alerts against current prices.
 * Triggers system bell and marks alert as triggered when condition is met.
 */
export function evaluateAlerts(markets: Market[]): void {
  const priceMap = new Map<string, number>();
  for (const m of markets) {
    for (const o of m.outcomes) {
      priceMap.set(o.id, o.price);
      // also index by marketId+outcomeTitle for matching
      priceMap.set(`${m.id}:${o.title}`, o.price);
    }
  }

  let anyTriggered = false;

  setAlertsState("alerts", (prev) =>
    prev.map((alert) => {
      if (alert.status !== "active") return alert;

      const price =
        priceMap.get(alert.marketId) ??
        priceMap.get(`${alert.marketId}:${alert.outcomeTitle}`);

      if (price === undefined) return alert;

      const hit =
        alert.condition === "above" ? price >= alert.threshold :
        price <= alert.threshold;

      if (hit) {
        anyTriggered = true;
        return { ...alert, status: "triggered" as const, triggeredAt: Date.now() };
      }
      return alert;
    })
  );

  if (anyTriggered) {
    saveAlerts();
    // system bell
    process.stdout.write("\x07");
  }
}
