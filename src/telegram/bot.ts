import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface TelegramConfig {
  botToken: string;
  chatId?: string;
  enabled: boolean;
  pollingInterval?: number;
  allowedUsers?: string[];
}

export interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: "Markdown" | "HTML";
  reply_markup?: {
    inline_keyboard: { text: string; callback_data: string }[][];
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number; username?: string };
    text: string;
    from?: { id: number; username?: string };
  };
  callback_query?: {
    id: string;
    message?: { chat: { id: number } };
    data: string;
  };
}

export interface TelegramCommand {
  command: string;
  description: string;
  handler: (args: string[], chatId: number, userId?: number) => Promise<string | null>;
}

const DEFAULT_CONFIG: TelegramConfig = {
  botToken: "",
  enabled: false,
  pollingInterval: 5000,
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
  private polling: boolean = false;
  private lastUpdateId: number = 0;
  private commands: Map<string, TelegramCommand> = new Map();
  private messageHandler?: (text: string, chatId: number) => Promise<void>;
  private pollingInterval: number = 5000;

  constructor(config?: Partial<TelegramConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.apiUrl = `https://api.telegram.org/bot${this.config.botToken}`;
    this.pollingInterval = this.config.pollingInterval || 5000;
    this.registerDefaultCommands();
  }

  private registerDefaultCommands(): void {
    this.registerCommand({
      command: "start",
      description: "Start the bot",
      handler: async () => "Welcome to Polymarket TUI Bot! Use /help for commands.",
    });

    this.registerCommand({
      command: "help",
      description: "Show help",
      handler: async () => `Available commands:
/markets - List top markets
/market <id> - Get market details
/portfolio - View your positions
/orders - View recent orders
/alerts - Manage alerts
/settings - Bot settings
/stop - Stop polling`,
    });

    this.registerCommand({
      command: "stop",
      description: "Stop bot polling",
      handler: async () => {
        this.stopPolling();
        return "Bot stopped.";
      },
    });
  }

  registerCommand(command: TelegramCommand): void {
    this.commands.set(command.command, command);
  }

  setMessageHandler(handler: (text: string, chatId: number) => Promise<void>): void {
    this.messageHandler = handler;
  }

  async sendMessage(text: string, parseMode: "Markdown" | "HTML" = "Markdown", chatId?: number): Promise<boolean> {
    const targetChatId = chatId || this.config.chatId;
    if (!targetChatId) {
      console.log("Telegram: No chat ID configured");
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
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

  async sendMarketList(markets: { question: string; volume: number; url?: string }[], chatId?: number): Promise<boolean> {
    const text = markets
      .slice(0, 10)
      .map((m, i) => `${i + 1}. *${m.question}*\n   Volume: $${m.volume.toLocaleString()}`)
      .join("\n\n");

    return this.sendMessage(`📊 *Top Markets*\n\n${text || "No markets found"}`, "Markdown", chatId);
  }

  async sendMarketDetails(market: {
    question: string;
    outcomes: { outcome: string; price: number; volume: number }[];
    volume: number;
    url?: string;
  }, chatId?: number): Promise<boolean> {
    const outcomesText = market.outcomes
      .map((o) => `• ${o.outcome}: ${(o.price * 100).toFixed(0)}¢ ($${o.volume.toLocaleString()})`)
      .join("\n");

    return this.sendMessage(
      `🎯 *${market.question}*\n\n` + `Volume: $${market.volume.toLocaleString()}\n\n` + `Outcomes:\n${outcomesText}`,
      "Markdown",
      chatId
    );
  }

  async sendPortfolio(positions: { outcome: string; size: number; value: number; pnl: number }[], chatId?: number): Promise<boolean> {
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
    return this.sendMessage(header + (positionsText || "No open positions"), "Markdown", chatId);
  }

  async sendOrders(orders: { market: string; side: string; price: number; size: number; status: string }[], chatId?: number): Promise<boolean> {
    const ordersText = orders
      .slice(0, 10)
      .map((o) => `• ${o.side} ${o.size} @ ${(o.price * 100).toFixed(0)}¢ [${o.status}] - ${o.market.slice(0, 30)}`)
      .join("\n");

    return this.sendMessage(`📋 *Recent Orders*\n\n${ordersText || "No recent orders"}`, "Markdown", chatId);
  }

  async sendAlert(message: string, severity: "info" | "warning" | "critical" = "info", chatId?: number): Promise<boolean> {
    const emoji = severity === "critical" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";
    return this.sendMessage(`${emoji} *Alert*\n\n${message}`, "Markdown", chatId);
  }

  async sendChart(chartData: string, chatId?: number): Promise<boolean> {
    const targetChatId = chatId || this.config.chatId;
    if (!targetChatId) return false;

    try {
      const response = await fetch(`${this.apiUrl}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          photo: `data:image/png;base64,${chartData}`,
          caption: "Portfolio Chart",
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async startPolling(): Promise<void> {
    if (this.polling || !this.config.botToken) return;
    this.polling = true;
    console.log("Telegram bot: Starting polling...");

    const poll = async () => {
      if (!this.polling) return;

      try {
        const response = await fetch(`${this.apiUrl}/getUpdates?timeout=60&offset=${this.lastUpdateId + 1}`);
        const data = await response.json() as { ok: boolean; result: TelegramUpdate[] };

        if (data.ok && data.result) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id;

            if (update.callback_query) {
              await this.handleCallbackQuery(update.callback_query);
              continue;
            }

            if (update.message) {
              const chatId = update.message.chat.id;
              const text = update.message.text;
              const userId = update.message.from?.id;

              if (this.config.allowedUsers && !this.config.allowedUsers.includes(String(userId))) {
                continue;
              }

              await this.handleMessage(text, chatId, userId);
            }
          }
        }
      } catch (e) {
        console.error("Telegram polling error:", e);
      }

      if (this.polling) {
        setTimeout(poll, this.pollingInterval);
      }
    };

    poll();
  }

  stopPolling(): void {
    this.polling = false;
  }

  private async handleMessage(text: string, chatId: number, userId?: number): Promise<void> {
    if (!text.startsWith("/")) {
      if (this.messageHandler) {
        await this.messageHandler(text, chatId);
      }
      return;
    }

    const parts = text.slice(1).split(" ");
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    const cmd = this.commands.get(command || "");
    if (cmd) {
      const response = await cmd.handler(args, chatId, userId);
      if (response) {
        await this.sendMessage(response, "Markdown", chatId);
      }
    }
  }

  private async handleCallbackQuery(query: { id: string; message?: { chat: { id: number } }; data: string }): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: query.id }),
      });
    } catch {}
  }

  isPolling(): boolean {
    return this.polling;
  }

  getCommands(): TelegramCommand[] {
    return Array.from(this.commands.values());
  }
}

let botInstance: TelegramBot | null = null;

export function createTelegramBot(config?: Partial<TelegramConfig>): TelegramBot {
  botInstance = new TelegramBot(config);
  return botInstance;
}

export function getTelegramBot(): TelegramBot | null {
  return botInstance;
}

export async function runTelegramBot(config?: Partial<TelegramConfig>): Promise<TelegramBot> {
  const telegramConfig = { ...loadTelegramConfig(), ...config };
  const bot = createTelegramBot(telegramConfig);

  if (!telegramConfig.botToken) {
    console.error("Telegram bot token not configured. Set it in telegram.json or pass it as argument.");
    process.exit(1);
  }

  await bot.startPolling();
  return bot;
}
