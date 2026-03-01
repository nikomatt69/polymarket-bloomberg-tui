import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface TelegramConfig {
  botToken: string;
  chatId?: string;
  enabled: boolean;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
}

export interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: "Markdown" | "HTML";
  reply_markup?: {
    inline_keyboard: { text: string; callback_data: string }[][];
  };
}

const DEFAULT_CONFIG: TelegramConfig = {
  botToken: "",
  enabled: false,
};

function getConfigPath(): string {
  return join(homedir(), ".polymarket-tui", "telegram.json");
}

export function loadTelegramConfig(): TelegramConfig {
  try {
    const path = getConfigPath();
    if (existsSync(path)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(path, "utf-8")) };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export function saveTelegramConfig(config: TelegramConfig): void {
  const path = getConfigPath();
  const dir = join(homedir(), ".polymarket-tui");
  try {
    writeFileSync(path, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Failed to save Telegram config:", e);
  }
}

export class TelegramBot {
  private config: TelegramConfig;
  private apiUrl: string;

  constructor(config?: Partial<TelegramConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.apiUrl = `https://api.telegram.org/bot${this.config.botToken}`;
  }

  async sendMessage(text: string, parseMode: "Markdown" | "HTML" = "Markdown"): Promise<boolean> {
    if (!this.config.botToken || !this.config.chatId) {
      console.log("Telegram bot not configured");
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text,
          parse_mode: parseMode,
        } as TelegramMessage),
      });

      return response.ok;
    } catch (e) {
      console.error("Failed to send Telegram message:", e);
      return false;
    }
  }

  async sendMarketList(markets: { question: string; volume: number; url: string }[]): Promise<boolean> {
    const text = markets
      .slice(0, 10)
      .map((m, i) => `${i + 1}. *${m.question}*\n   Volume: $${m.volume.toLocaleString()}`)
      .join("\n\n");

    return this.sendMessage(`📊 *Top Markets*\n\n${text || "No markets found"}`);
  }

  async sendMarketDetails(market: {
    question: string;
    outcomes: { outcome: string; price: number; volume: number }[];
    volume: number;
    url?: string;
  }): Promise<boolean> {
    const outcomesText = market.outcomes
      .map((o) => `• ${o.outcome}: ${(o.price * 100).toFixed(0)}¢ ($${o.volume.toLocaleString()})`)
      .join("\n");

    return this.sendMessage(
      `🎯 *${market.question}*\n\n` + `Volume: $${market.volume.toLocaleString()}\n\n` + `Outcomes:\n${outcomesText}`
    );
  }

  async sendPortfolio(positions: { outcome: string; size: number; value: number; pnl: number }[]): Promise<boolean> {
    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);

    const positionsText = positions
      .slice(0, 10)
      .map((p) => {
        const pnlEmoji = p.pnl >= 0 ? "🟢" : "🔴";
        return `${pnlEmoji} ${p.outcome}: $${p.value.toFixed(2)} (${p.pnl >= 0 ? "+" : ""}$${p.pnl.toFixed(2)})`;
      })
      .join("\n");

    const header = `💼 *Portfolio*\n\nTotal Value: $${totalValue.toFixed(2)}\nP&L: ${totalPnl >= 0 ? "🟢" : "🔴"}$${totalPnl.toFixed(2)}\n\n`;
    return this.sendMessage(header + (positionsText || "No open positions"));
  }

  async sendOrders(orders: { market: string; side: string; price: number; size: number; status: string }[]): Promise<boolean> {
    const ordersText = orders
      .slice(0, 10)
      .map((o) => `• ${o.side} ${o.size} @ ${(o.price * 100).toFixed(0)}¢ [${o.status}] - ${o.market.slice(0, 30)}`)
      .join("\n");

    return this.sendMessage(`📋 *Recent Orders*\n\n${ordersText || "No recent orders"}`);
  }

  async sendAlert(message: string, severity: "info" | "warning" | "critical" = "info"): Promise<boolean> {
    const emoji = severity === "critical" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";
    return this.sendMessage(`${emoji} *Alert*\n\n${message}`);
  }

  startPolling(onCommand: (command: string, args: string[], chatId: number) => Promise<string | null>): void {
    let offset = 0;
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(
          `${this.apiUrl}/getUpdates?timeout=30&offset=${offset}`,
          { signal: AbortSignal.timeout(35000) }
        );
        if (res.ok) {
          const data = await res.json() as { ok: boolean; result: TelegramUpdate[] };
          if (data.ok) {
            for (const update of data.result) {
              offset = update.update_id + 1;
              const text = update.message?.text;
              const chatId = update.message?.chat.id;
              if (text && chatId && text.startsWith("/")) {
                const parts = text.split(/\s+/);
                const command = parts[0];
                const args = parts.slice(1);
                const reply = await onCommand(command, args, chatId);
                if (reply) {
                  await fetch(`${this.apiUrl}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: "Markdown" }),
                  });
                }
              }
            }
          }
        }
      } catch {
        // Network error, retry after delay
      }
      if (active) setTimeout(poll, 1000);
    };

    setTimeout(poll, 0);

    // Expose stop function via closure
    (this as unknown as Record<string, unknown>)._stopPolling = () => { active = false; };
  }

  async handleCommand(command: string, args: string[]): Promise<string | null> {
    switch (command) {
      case "/markets":
        return "Use /market <market_id> to get details";

      case "/portfolio":
        return "Use /portfolio to view your positions";

      case "/orders":
        return "Use /orders to view recent orders";

      case "/alerts":
        return "Use /alerts to manage your alerts";

      case "/start":
        return "Welcome to Polymarket TUI Bot! Use /help for commands.";

      case "/help":
        return `Available commands:
/markets - List top markets
/market <id> - Get market details
/portfolio - View your positions
/orders - View recent orders
/alerts - Manage alerts
/settings - Bot settings`;

      default:
        return null;
    }
  }
}

export async function runTelegramBot(config?: Partial<TelegramConfig>): Promise<TelegramBot> {
  const telegramConfig = loadTelegramConfig();
  const finalConfig = { ...telegramConfig, ...config };

  if (!finalConfig.enabled || !finalConfig.botToken) {
    return new TelegramBot(finalConfig);
  }

  const bot = new TelegramBot(finalConfig);
  bot.startPolling(async (command, args, chatId) => {
    const response = await bot.handleCommand(command, args);
    return response;
  });

  return bot;
}
