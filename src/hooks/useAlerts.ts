/**
 * Price alert management — persistence, evaluation, notification
 */

import { createStore } from "solid-js/store";
import { PriceAlert, AlertCondition, AlertMetric } from "../types/alerts";
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
  addMetric: AlertMetric;
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
  addMetric: "price",
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
    const alerts: unknown = JSON.parse(raw);
    if (!Array.isArray(alerts)) {
      setAlertsState("alerts", []);
      return;
    }

    const normalized = alerts
      .map((alert): PriceAlert | null => {
        if (!alert || typeof alert !== "object") return null;
        const item = alert as Partial<PriceAlert>;
        if (!item.id || !item.marketId || !item.marketTitle || !item.outcomeTitle) return null;

        const metric: AlertMetric =
          item.metric === "change24h" || item.metric === "volume24h" || item.metric === "liquidity"
            ? item.metric
            : "price";

        const condition: AlertCondition = item.condition === "below" ? "below" : "above";
        const status =
          item.status === "triggered" || item.status === "dismissed"
            ? item.status
            : "active";
        const threshold =
          typeof item.threshold === "number"
            ? item.threshold
            : Number.parseFloat(String(item.threshold ?? "0"));
        if (!Number.isFinite(threshold)) return null;

        return {
          id: String(item.id),
          marketId: String(item.marketId),
          marketTitle: String(item.marketTitle),
          outcomeId: String(item.outcomeId ?? ""),
          outcomeTitle: String(item.outcomeTitle),
          metric,
          condition,
          threshold,
          status,
          createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
          triggeredAt: typeof item.triggeredAt === "number" ? item.triggeredAt : undefined,
        };
      })
      .filter((item): item is PriceAlert => item !== null);

    setAlertsState("alerts", normalized);
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
  outcomeId: string,
  outcomeTitle: string,
  metric: AlertMetric,
  condition: AlertCondition,
  threshold: number
): void {
  const alert: PriceAlert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    marketId,
    marketTitle,
    outcomeId,
    outcomeTitle,
    metric,
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
  const marketMap = new Map<string, Market>();
  const outcomeMap = new Map<string, number>();

  for (const m of markets) {
    marketMap.set(m.id, m);
    for (const o of m.outcomes) {
      if (o.id) {
        outcomeMap.set(o.id, o.price);
      }
    }
  }

  let anyTriggered = false;
  let lastTriggeredId: string | null = null;

  const resolveMetricValue = (alert: PriceAlert): number | null => {
    const market = marketMap.get(alert.marketId);
    if (!market) return null;

    switch (alert.metric) {
      case "price": {
        if (alert.outcomeId && outcomeMap.has(alert.outcomeId)) {
          return outcomeMap.get(alert.outcomeId) ?? null;
        }
        const fallbackOutcome = market.outcomes.find((outcome) => outcome.title === alert.outcomeTitle);
        return fallbackOutcome ? fallbackOutcome.price : null;
      }
      case "change24h":
        return market.change24h;
      case "volume24h":
        return market.volume24h;
      case "liquidity":
        return market.liquidity;
      default:
        return null;
    }
  };

  setAlertsState("alerts", (prev) =>
    prev.map((alert) => {
      if (alert.status !== "active") return alert;

      const value = resolveMetricValue(alert);

      if (value === null || !Number.isFinite(value)) return alert;

      const hit =
        alert.condition === "above" ? value >= alert.threshold :
        value <= alert.threshold;

      if (hit) {
        anyTriggered = true;
        lastTriggeredId = alert.id;
        return { ...alert, status: "triggered" as const, triggeredAt: Date.now() };
      }
      return alert;
    })
  );

  if (anyTriggered) {
    setAlertsState("lastTriggered", lastTriggeredId);
    saveAlerts();
    // system bell
    process.stdout.write("\x07");
  }
}
