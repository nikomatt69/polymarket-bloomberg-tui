import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export type HotkeyAction =
  | "toggle_wallet"
  | "toggle_order"
  | "toggle_sell"
  | "toggle_history"
  | "toggle_portfolio"
  | "toggle_alerts"
  | "toggle_indicators"
  | "toggle_sentiment"
  | "toggle_compare"
  | "toggle_watchlist"
  | "toggle_account"
  | "toggle_analytics"
  | "toggle_assistant"
  | "toggle_settings"
  | "toggle_shortcuts"
  | "toggle_orderbook"
  | "toggle_filter"
  | "toggle_messages"
  | "toggle_profile"
  | "toggle_user_search"
  | "refresh"
  | "sort_ascending"
  | "sort_descending"
  | "quit";

export interface HotkeyBinding {
  key: string;
  action: HotkeyAction;
  description: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface HotkeyConfig {
  enabled: boolean;
  bindings: HotkeyBinding[];
  customBindings: HotkeyBinding[];
}

const DEFAULT_BINDINGS: HotkeyBinding[] = [
  { key: "w", action: "toggle_wallet", description: "Wallet" },
  { key: "o", action: "toggle_order", description: "Buy order" },
  { key: "s", action: "toggle_sell", description: "Sell order" },
  { key: "h", action: "toggle_history", description: "Order history" },
  { key: "p", action: "toggle_portfolio", description: "Portfolio" },
  { key: "z", action: "toggle_alerts", description: "Price alerts" },
  { key: "i", action: "toggle_indicators", description: "Indicators" },
  { key: "m", action: "toggle_sentiment", description: "Sentiment" },
  { key: "c", action: "toggle_compare", description: "Compare" },
  { key: "x", action: "toggle_watchlist", description: "Watchlist" },
  { key: "u", action: "toggle_account", description: "Account stats" },
  { key: "a", action: "toggle_analytics", description: "Analytics" },
  { key: "I", action: "toggle_assistant", description: "AI Assistant", shift: true },
  { key: "e", action: "toggle_settings", description: "Settings" },
  { key: "k", action: "toggle_shortcuts", description: "Shortcuts panel" },
  { key: "d", action: "toggle_orderbook", description: "Live order book" },
  { key: "f", action: "toggle_filter", description: "Filter" },
  { key: "M", action: "toggle_messages", description: "Messages", shift: true },
  { key: "U", action: "toggle_profile", description: "User profile", shift: true },
  { key: "L", action: "toggle_user_search", description: "User search", shift: true },
  { key: "r", action: "refresh", description: "Refresh data" },
  { key: "q", action: "quit", description: "Quit" },
];

const DEFAULT_CONFIG: HotkeyConfig = {
  enabled: true,
  bindings: DEFAULT_BINDINGS,
  customBindings: [],
};

function getConfigPath(): string {
  return join(homedir(), ".polymarket-tui", "hotkeys.json");
}

export function loadHotkeyConfig(): HotkeyConfig {
  try {
    const path = getConfigPath();
    if (existsSync(path)) {
      const saved = JSON.parse(readFileSync(path, "utf-8"));
      return {
        ...DEFAULT_CONFIG,
        ...saved,
        bindings: saved.bindings || DEFAULT_BINDINGS,
      };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function saveHotkeyConfig(config: HotkeyConfig): void {
  const path = getConfigPath();
  try {
    writeFileSync(path, JSON.stringify(config, null, 2));
  } catch {
    console.error("Failed to save hotkey config");
  }
}

export function getDefaultBindings(): HotkeyBinding[] {
  return [...DEFAULT_BINDINGS];
}

export function getActiveBindings(): HotkeyBinding[] {
  const config = loadHotkeyConfig();
  return [...config.bindings, ...config.customBindings];
}

export function getBindingForAction(action: HotkeyAction): HotkeyBinding | undefined {
  const bindings = getActiveBindings();
  return bindings.find((b) => b.action === action);
}

export function getActionForKey(key: string, ctrl: boolean = false, shift: boolean = false, alt: boolean = false): HotkeyAction | undefined {
  const bindings = getActiveBindings();
  return bindings.find((b) => {
    const keyMatch = b.key.toLowerCase() === key.toLowerCase();
    const ctrlMatch = !!b.ctrl === ctrl;
    const shiftMatch = !!b.shift === shift;
    const altMatch = !!b.alt === alt;
    return keyMatch && ctrlMatch && shiftMatch && altMatch;
  })?.action;
}

export function addCustomBinding(binding: HotkeyBinding): void {
  const config = loadHotkeyConfig();
  const existing = config.customBindings.findIndex((b) => b.action === binding.action);
  if (existing >= 0) {
    config.customBindings[existing] = binding;
  } else {
    config.customBindings.push(binding);
  }
  saveHotkeyConfig(config);
}

export function removeCustomBinding(action: HotkeyAction): void {
  const config = loadHotkeyConfig();
  config.customBindings = config.customBindings.filter((b) => b.action !== action);
  saveHotkeyConfig(config);
}

export function resetToDefaults(): void {
  saveHotkeyConfig({ ...DEFAULT_CONFIG });
}

export function getActionDescription(action: HotkeyAction): string {
  const binding = getBindingForAction(action);
  return binding?.description || action;
}

export function formatHotkeyDisplay(binding: HotkeyBinding): string {
  let parts: string[] = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");
  parts.push(binding.key.toUpperCase());
  return parts.join("+");
}
