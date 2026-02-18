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
  addCooldownMinutes: string;
  addDebouncePasses: number;
  addFocus: "condition" | "threshold" | "cooldown" | "debounce";
  addError: string;
  selectedIdx: number;
}

interface AlertRuntimeState {
  consecutiveHits: number;
  latched: boolean;
}

const alertRuntimeState = new Map<string, AlertRuntimeState>();

function normalizeCooldownMinutes(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1_440, Math.round(parsed)));
}

function normalizeDebouncePasses(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "1"), 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

function ensureRuntimeState(alertId: string): AlertRuntimeState {
  const current = alertRuntimeState.get(alertId);
  if (current) return current;

  const next: AlertRuntimeState = { consecutiveHits: 0, latched: false };
  alertRuntimeState.set(alertId, next);
  return next;
}

export const [alertsState, setAlertsState] = createStore<AlertsState>({
  alerts: [],
  panelOpen: false,
  lastTriggered: null,
  adding: false,
  addMetric: "price",
  addCondition: "above",
  addThreshold: "",
  addCooldownMinutes: "5",
  addDebouncePasses: 1,
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

        const cooldownMinutes = normalizeCooldownMinutes((item as { cooldownMinutes?: unknown }).cooldownMinutes);
        const debouncePasses = normalizeDebouncePasses((item as { debouncePasses?: unknown }).debouncePasses);
        const triggerCount = Number.isFinite((item as { triggerCount?: unknown }).triggerCount as number)
          ? Number((item as { triggerCount?: unknown }).triggerCount)
          : 0;

        return {
          id: String(item.id),
          marketId: String(item.marketId),
          marketTitle: String(item.marketTitle),
          outcomeId: String(item.outcomeId ?? ""),
          outcomeTitle: String(item.outcomeTitle),
          metric,
          condition,
          threshold,
          cooldownMinutes,
          debouncePasses,
          status,
          createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
          triggeredAt: typeof item.triggeredAt === "number" ? item.triggeredAt : undefined,
          lastNotifiedAt: typeof (item as { lastNotifiedAt?: unknown }).lastNotifiedAt === "number"
            ? Number((item as { lastNotifiedAt?: unknown }).lastNotifiedAt)
            : undefined,
          triggerCount,
        };
      })
      .filter((item): item is PriceAlert => item !== null);

    setAlertsState("alerts", normalized);
    alertRuntimeState.clear();
    for (const alert of normalized) {
      alertRuntimeState.set(alert.id, {
        consecutiveHits: 0,
        latched: alert.status === "triggered",
      });
    }
  } catch {
    setAlertsState("alerts", []);
    alertRuntimeState.clear();
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
  threshold: number,
  cooldownMinutes: number,
  debouncePasses: number,
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
    cooldownMinutes: normalizeCooldownMinutes(cooldownMinutes),
    debouncePasses: normalizeDebouncePasses(debouncePasses),
    status: "active",
    createdAt: Date.now(),
    triggerCount: 0,
  };
  setAlertsState("alerts", (prev) => [alert, ...prev]);
  alertRuntimeState.set(alert.id, { consecutiveHits: 0, latched: false });
  saveAlerts();
}

export function dismissAlert(id: string): void {
  setAlertsState("alerts", (prev) =>
    prev.map((a) => (a.id === id ? { ...a, status: "dismissed" as const } : a))
  );
  alertRuntimeState.delete(id);
  saveAlerts();
}

export function deleteAlert(id: string): void {
  setAlertsState("alerts", (prev) => prev.filter((a) => a.id !== id));
  alertRuntimeState.delete(id);
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
  let hasStateChange = false;
  let lastTriggeredId: string | null = null;
  const now = Date.now();

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
      if (alert.status === "dismissed") return alert;

      const value = resolveMetricValue(alert);

      if (value === null || !Number.isFinite(value)) return alert;

      const runtime = ensureRuntimeState(alert.id);
      const debouncePasses = normalizeDebouncePasses(alert.debouncePasses);
      const cooldownMinutes = normalizeCooldownMinutes(alert.cooldownMinutes);

      const hit =
        alert.condition === "above" ? value >= alert.threshold :
        value <= alert.threshold;

      if (hit) {
        runtime.consecutiveHits = Math.min(debouncePasses, runtime.consecutiveHits + 1);

        const debounceSatisfied = runtime.consecutiveHits >= debouncePasses;
        const cooldownMs = cooldownMinutes * 60_000;
        const cooledDown =
          alert.lastNotifiedAt === undefined
            ? true
            : now - alert.lastNotifiedAt >= cooldownMs;

        if (!runtime.latched && debounceSatisfied && cooledDown) {
          runtime.latched = true;
          anyTriggered = true;
          hasStateChange = true;
          lastTriggeredId = alert.id;

          return {
            ...alert,
            status: "triggered" as const,
            triggeredAt: now,
            lastNotifiedAt: now,
            triggerCount: (alert.triggerCount ?? 0) + 1,
          };
        }

        return alert;
      }

      runtime.consecutiveHits = 0;
      runtime.latched = false;

      if (alert.status === "triggered") {
        hasStateChange = true;
        return { ...alert, status: "active" as const };
      }

      return alert;
    })
  );

  if (anyTriggered) {
    setAlertsState("lastTriggered", lastTriggeredId);
    // system bell
    process.stdout.write("\x07");
  }

  if (hasStateChange || anyTriggered) {
    saveAlerts();
  }
}
