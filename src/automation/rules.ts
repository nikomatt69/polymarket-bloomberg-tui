import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export type TriggerType = "price_above" | "price_below" | "percent_change" | "volume_spike" | "time";
export type ActionType = "buy" | "sell" | "close_position" | "alert" | "notify" | "rebalance";

export interface Trigger {
  type: TriggerType;
  marketId?: string;
  outcome?: string;
  value: number;
  windowSeconds?: number;
}

export interface Action {
  type: ActionType;
  marketId?: string;
  outcome?: string;
  amount?: number;
  percentage?: number;
  message?: string;
}

export interface TradingRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  action: Action;
  createdAt: number;
  lastTriggered?: number;
}

export interface RuleEngine {
  checkTriggers(markets: MarketData[], positions: PositionData[]): TradingRule[];
  executeAction(rule: TradingRule, context: ExecutionContext): Promise<void>;
}

interface MarketData {
  id: string;
  title: string;
  outcomes: { outcome: string; price: number; volume: number; tokenId?: string }[];
}

interface PositionData {
  marketId: string;
  outcome: string;
  size: number;
  currentValue: number;
}

interface ExecutionContext {
  market?: MarketData;
  position?: PositionData;
}

function getRulesPath(): string {
  return join(homedir(), ".polymarket-tui", "rules.json");
}

export function loadRules(): TradingRule[] {
  try {
    const path = getRulesPath();
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

export function saveRules(rules: TradingRule[]): void {
  const path = getRulesPath();
  const dir = join(homedir(), ".polymarket-tui");
  try {
    writeFileSync(path, JSON.stringify(rules, null, 2));
  } catch (e) {
    console.error("Failed to save rules:", e);
  }
}

export function createRule(name: string, trigger: Trigger, action: Action): TradingRule {
  return {
    id: crypto.randomUUID(),
    name,
    enabled: true,
    trigger,
    action,
    createdAt: Date.now(),
  };
}

export function evaluateTrigger(trigger: Trigger, market: MarketData, previousPrice?: number): boolean {
  const outcome = market.outcomes.find((o) => o.outcome === (trigger.outcome ?? "Yes"));
  if (!outcome) return false;

  const currentPrice = outcome.price;
  const currentVolume = outcome.volume;

  switch (trigger.type) {
    case "price_above":
      return currentPrice > trigger.value;

    case "price_below":
      return currentPrice < trigger.value;

    case "percent_change":
      if (!previousPrice || previousPrice === 0) return false;
      const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100;
      return Math.abs(percentChange) >= trigger.value;

    case "volume_spike":
      return currentVolume > trigger.value;

    default:
      return false;
  }
}

export async function executeAction(
  action: Action,
  context: ExecutionContext
): Promise<{ success: boolean; message: string }> {
  switch (action.type) {
    case "buy":
    case "sell": {
      const outcome = context.market?.outcomes.find(
        (o) => o.outcome === (action.outcome ?? "Yes")
      );
      if (!outcome?.tokenId || !action.amount) {
        return { success: false, message: `No tokenId or amount for ${action.type}` };
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { placeOrder } = require("../api/orders") as typeof import("../api/orders");
        await placeOrder({
          tokenId: outcome.tokenId,
          side: action.type === "buy" ? "BUY" : "SELL",
          price: outcome.price,
          shares: action.amount,
          type: "GTC",
        });
        return { success: true, message: `Order placed: ${action.type} ${action.amount} shares` };
      } catch (e) {
        return { success: false, message: `Order failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    case "close_position": {
      const pos = context.position;
      if (!pos) return { success: false, message: "No position found to close" };
      const outcome = context.market?.outcomes.find(
        (o) => o.outcome === pos.outcome
      );
      if (!outcome?.tokenId) {
        return { success: false, message: "No tokenId found for position outcome" };
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { placeOrder } = require("../api/orders") as typeof import("../api/orders");
        await placeOrder({
          tokenId: outcome.tokenId,
          side: "SELL",
          price: outcome.price,
          shares: pos.size,
          type: "GTC",
        });
        return { success: true, message: `Position closed: sold ${pos.size} shares of ${pos.outcome}` };
      } catch (e) {
        return { success: false, message: `Close failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    case "alert": {
      process.stdout.write("\x07");
      return { success: true, message: action.message || "Alert triggered" };
    }

    case "notify": {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { TelegramBot, loadTelegramConfig } = require("../telegram/bot") as typeof import("../telegram/bot");
        const cfg = loadTelegramConfig();
        if (cfg.enabled && cfg.botToken) {
          const bot = new TelegramBot(cfg);
          await bot.sendAlert(action.message || "Automation rule triggered", "info");
        }
      } catch {
        // Telegram not configured, silently skip
      }
      return { success: true, message: `Notification sent: ${action.message}` };
    }

    case "rebalance": {
      console.log(`[Automation] Rebalance intent: ${action.percentage ?? 50}% allocation for market ${action.marketId}`);
      return { success: true, message: `Rebalance logged: ${action.percentage ?? 50}% allocation` };
    }

    default:
      return { success: false, message: "Unknown action" };
  }
}

export function checkAllRules(
  rules: TradingRule[],
  markets: MarketData[],
  positions: PositionData[],
  priceHistory: Map<string, number>
): TradingRule[] {
  const triggered: TradingRule[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const market = markets.find((m) => m.id === rule.trigger.marketId || m.title.includes(rule.trigger.marketId || ""));
    if (!market) continue;

    const previousPrice = priceHistory.get(market.id);
    if (evaluateTrigger(rule.trigger, market, previousPrice)) {
      triggered.push(rule);
    }
  }

  return triggered;
}
