/**
 * Settings panel — tabbed overlay for theme, account, display, and key bindings
 * Key: E — toggle open/close
 * Tabs: THEME · ACCOUNT · DISPLAY · KEYS
 */

import { For, Show } from "solid-js";
import { useTheme } from "../context/theme";
import {
  walletState,
  appState,
  setSettingsPanelOpen,
  settingsPanelTab,
  setSettingsPanelTab,
  setSortBy,
  setTimeframe,
  setWalletModalOpen,
} from "../state";
import { disconnectWalletHook, refreshWalletBalance } from "../hooks/useWallet";
import { watchlistState, toggleWatchlistFilter } from "../hooks/useWatchlist";
import { truncateAddress } from "../auth/wallet";

export function SettingsPanel() {
  const ctx = useTheme();
  const { theme, toggleMode } = ctx;
  const THEME_LIST_WINDOW = 8;

  const themeCount = () => ctx.availableThemes.length;

  const themePosition = () => {
    const idx = ctx.availableThemes.indexOf(ctx.themeName);
    return idx >= 0 ? idx + 1 : 0;
  };

  const prevThemeName = () => {
    const names = ctx.availableThemes;
    if (names.length === 0) {
      return "-";
    }
    const idx = names.indexOf(ctx.themeName);
    const current = idx >= 0 ? idx : 0;
    return names[(current - 1 + names.length) % names.length] ?? names[0]!;
  };

  const nextThemeName = () => {
    const names = ctx.availableThemes;
    if (names.length === 0) {
      return "-";
    }
    const idx = names.indexOf(ctx.themeName);
    const current = idx >= 0 ? idx : 0;
    return names[(current + 1) % names.length] ?? names[0]!;
  };

  const visibleThemeEntries = () => {
    const names = ctx.availableThemes;
    if (names.length === 0) {
      return [] as Array<{ name: string; index: number; active: boolean }>;
    }

    const currentIdx = names.indexOf(ctx.themeName);
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;
    const half = Math.floor(THEME_LIST_WINDOW / 2);
    let start = Math.max(0, safeIdx - half);

    if (start + THEME_LIST_WINDOW > names.length) {
      start = Math.max(0, names.length - THEME_LIST_WINDOW);
    }

    return names.slice(start, start + THEME_LIST_WINDOW).map((name, i) => {
      const index = start + i;
      return {
        name,
        index,
        active: name === ctx.themeName,
      };
    });
  };

  const themeIndexPad = () => Math.max(2, String(themeCount()).length);

  return (
    <box
      position="absolute"
      top={2}
      left="6%"
      width="88%"
      height={26}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={170}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ SETTINGS " fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={() => setSettingsPanelOpen(false)}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Tab bar */}
      <box height={1} backgroundColor={theme.backgroundPanel} flexDirection="row" paddingLeft={2}>
        <box onMouseDown={() => setSettingsPanelTab("theme")}>
          <text
            content={settingsPanelTab() === "theme" ? " [THEME] " : "  THEME  "}
            fg={settingsPanelTab() === "theme" ? theme.primary : theme.textMuted}
          />
        </box>
        <box onMouseDown={() => setSettingsPanelTab("account")}>
          <text
            content={settingsPanelTab() === "account" ? " [ACCOUNT] " : "  ACCOUNT  "}
            fg={settingsPanelTab() === "account" ? theme.primary : theme.textMuted}
          />
        </box>
        <box onMouseDown={() => setSettingsPanelTab("display")}>
          <text
            content={settingsPanelTab() === "display" ? " [DISPLAY] " : "  DISPLAY  "}
            fg={settingsPanelTab() === "display" ? theme.primary : theme.textMuted}
          />
        </box>
        <box onMouseDown={() => setSettingsPanelTab("keys")}>
          <text
            content={settingsPanelTab() === "keys" ? " [KEYS] " : "  KEYS  "}
            fg={settingsPanelTab() === "keys" ? theme.primary : theme.textMuted}
          />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.primaryMuted} />

      {/* Body */}
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>

        {/* THEME tab */}
        <Show when={settingsPanelTab() === "theme"}>
          <box flexDirection="row" gap={1}>
            <text content="Mode:" fg={theme.textMuted} />
            <text content={ctx.mode.toUpperCase()} fg={theme.primary} />
            <text content="  Theme:" fg={theme.textMuted} />
            <text content={`${ctx.themeName} (${themePosition()}/${themeCount()})`} fg={theme.accent} />
          </box>
          <box flexDirection="row" gap={3}>
            <box onMouseDown={() => toggleMode()}>
              <text content="[T/Enter] Mode" fg={theme.text} />
            </box>
            <box onMouseDown={() => ctx.cycleTheme(1)}>
              <text content="[N/↓] Next" fg={theme.text} />
            </box>
            <box onMouseDown={() => ctx.cycleTheme(-1)}>
              <text content="[P/↑] Prev" fg={theme.text} />
            </box>
            <box onMouseDown={() => ctx.reloadThemes()}>
              <text content="[R] Reload" fg={theme.textMuted} />
            </box>
          </box>
          <box flexDirection="row" gap={1}>
            <text content="Prev:" fg={theme.textMuted} />
            <text content={prevThemeName()} fg={theme.text} />
            <text content="  Next:" fg={theme.textMuted} />
            <text content={nextThemeName()} fg={theme.text} />
          </box>
          <box flexDirection="row" gap={1}>
            <text content="Source:" fg={theme.textMuted} />
            <text content="nikcli/src/cli/cmd/tui/context/theme" fg={theme.textMuted} />
          </box>
          <text content="" />
          <text content="Theme list (click to apply):" fg={theme.textMuted} />
          <box flexDirection="column">
            <For each={visibleThemeEntries()}>
              {(entry) => (
                <box onMouseDown={() => ctx.setTheme(entry.name)}>
                  <text
                    content={`${entry.active ? ">" : " "} ${String(entry.index + 1).padStart(themeIndexPad(), "0")} ${entry.name}`}
                    fg={entry.active ? theme.highlight : theme.text}
                  />
                </box>
              )}
            </For>
          </box>
          <text content="" />
          <text content="Color palette:" fg={theme.textMuted} />
          <box flexDirection="row" gap={2}>
            <text content="Primary" fg={theme.textMuted} />
            <text content="███" fg={theme.primary} />
            <text content="  Accent" fg={theme.textMuted} />
            <text content="███" fg={theme.accent} />
            <text content="  Success" fg={theme.textMuted} />
            <text content="███" fg={theme.success} />
            <text content="  Warning" fg={theme.textMuted} />
            <text content="███" fg={theme.warning} />
            <text content="  Error" fg={theme.textMuted} />
            <text content="███" fg={theme.error} />
          </box>
        </Show>

        {/* ACCOUNT tab */}
        <Show when={settingsPanelTab() === "account"}>
          <box flexDirection="row" gap={1}>
            <text content="Status:  " fg={theme.textMuted} />
            <Show
              when={walletState.connected}
              fallback={<text content="○ NOT CONNECTED" fg={theme.error} />}
            >
              <text content="● CONNECTED" fg={theme.success} />
            </Show>
          </box>
          <Show when={walletState.connected && walletState.address}>
            <box flexDirection="row" gap={1}>
              <text content="Address: " fg={theme.textMuted} />
              <text content={truncateAddress(walletState.address!)} fg={theme.primary} />
            </box>
            <box flexDirection="row" gap={1}>
              <text content="Balance: " fg={theme.textMuted} />
              <text
                content={`${walletState.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`}
                fg={theme.success}
              />
            </box>
            <box flexDirection="row" gap={1}>
              <text content="API Creds:" fg={theme.textMuted} />
              <text
                content={walletState.apiKey ? "Configured" : "Not configured"}
                fg={walletState.apiKey ? theme.success : theme.textMuted}
              />
            </box>
          </Show>
          <text content="" />
          <box flexDirection="row" gap={3}>
            <box onMouseDown={() => { setSettingsPanelOpen(false); setWalletModalOpen(true); }}>
              <text content="[W] Wallet Modal" fg={theme.primary} />
            </box>
            <Show when={walletState.connected}>
              <box onMouseDown={() => void refreshWalletBalance()}>
                <text content="[R] Refresh Balance" fg={theme.textMuted} />
              </box>
              <box onMouseDown={() => disconnectWalletHook()}>
                <text content="[D] Disconnect" fg={theme.error} />
              </box>
            </Show>
          </box>
        </Show>

        {/* DISPLAY tab */}
        <Show when={settingsPanelTab() === "display"}>
          <box flexDirection="row" gap={1}>
            <text content="Sort:      " fg={theme.textMuted} />
            <box onMouseDown={() => setSortBy("volume")}>
              <text
                content={appState.sortBy === "volume" ? "[Volume] " : " Volume  "}
                fg={appState.sortBy === "volume" ? theme.primary : theme.textMuted}
              />
            </box>
            <box onMouseDown={() => setSortBy("change")}>
              <text
                content={appState.sortBy === "change" ? "[24h%] " : " 24h%  "}
                fg={appState.sortBy === "change" ? theme.primary : theme.textMuted}
              />
            </box>
            <box onMouseDown={() => setSortBy("name")}>
              <text
                content={appState.sortBy === "name" ? "[A-Z] " : " A-Z  "}
                fg={appState.sortBy === "name" ? theme.primary : theme.textMuted}
              />
            </box>
          </box>
          <text content="" />
          <box flexDirection="row" gap={1}>
            <text content="Timeframe: " fg={theme.textMuted} />
            <box onMouseDown={() => setTimeframe("all")}>
              <text
                content={appState.timeframe === "all" ? "[ALL] " : " ALL  "}
                fg={appState.timeframe === "all" ? theme.primary : theme.textMuted}
              />
            </box>
            <box onMouseDown={() => setTimeframe("1d")}>
              <text
                content={appState.timeframe === "1d" ? "[1D] " : " 1D  "}
                fg={appState.timeframe === "1d" ? theme.primary : theme.textMuted}
              />
            </box>
            <box onMouseDown={() => setTimeframe("5d")}>
              <text
                content={appState.timeframe === "5d" ? "[5D] " : " 5D  "}
                fg={appState.timeframe === "5d" ? theme.primary : theme.textMuted}
              />
            </box>
            <box onMouseDown={() => setTimeframe("7d")}>
              <text
                content={appState.timeframe === "7d" ? "[7D] " : " 7D  "}
                fg={appState.timeframe === "7d" ? theme.primary : theme.textMuted}
              />
            </box>
          </box>
          <text content="" />
          <box flexDirection="row" gap={1}>
            <text content="Watchlist: " fg={theme.textMuted} />
            <box onMouseDown={toggleWatchlistFilter}>
              <text
                content={watchlistState.filterActive ? "[FILTER ON] " : " FILTER OFF "}
                fg={watchlistState.filterActive ? theme.success : theme.textMuted}
              />
            </box>
          </box>
          <text content="" />
          <box flexDirection="row" gap={4}>
            <box flexDirection="row" gap={1}>
              <text content="Markets loaded:" fg={theme.textMuted} />
              <text content={String(appState.markets.length)} fg={theme.text} />
            </box>
            <box flexDirection="row" gap={1}>
              <text content="Last refresh:" fg={theme.textMuted} />
              <text content={appState.lastRefresh.toLocaleTimeString()} fg={theme.text} />
            </box>
          </box>
        </Show>

        {/* KEYS tab */}
        <Show when={settingsPanelTab() === "keys"}>
          <box flexDirection="row" width="100%">
            {/* Left column */}
            <box flexDirection="column" width={36}>
              <text content="NAVIGATION" fg={theme.primary} />
              <box flexDirection="row">
                <text content="  ↑ / ↓  " fg={theme.textMuted} width={9} />
                <text content="Navigate markets" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  Enter  " fg={theme.textMuted} width={9} />
                <text content="Select market" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  Ctrl+K " fg={theme.textMuted} width={9} />
                <text content="Cycle sort" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  R      " fg={theme.textMuted} width={9} />
                <text content="Refresh data" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  1/5/7/A" fg={theme.textMuted} width={9} />
                <text content="Timeframe" fg={theme.text} />
              </box>
              <text content="" />
              <text content="MARKET" fg={theme.primary} />
              <box flexDirection="row">
                <text content="  X      " fg={theme.textMuted} width={9} />
                <text content="Toggle watchlist" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  F      " fg={theme.textMuted} width={9} />
                <text content="Toggle filter" fg={theme.text} />
              </box>
              <text content="" />
              <text content="SYSTEM" fg={theme.primary} />
              <box flexDirection="row">
                <text content="  E      " fg={theme.textMuted} width={9} />
                <text content="Settings" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  Q      " fg={theme.textMuted} width={9} />
                <text content="Quit" fg={theme.text} />
              </box>
            </box>
            {/* Right column */}
            <box flexDirection="column" width={36}>
              <text content="PANELS" fg={theme.primary} />
              <box flexDirection="row">
                <text content="  W      " fg={theme.textMuted} width={9} />
                <text content="Wallet" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  O      " fg={theme.textMuted} width={9} />
                <text content="Buy order" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  S      " fg={theme.textMuted} width={9} />
                <text content="Sell order" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  H      " fg={theme.textMuted} width={9} />
                <text content="Order history" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  P      " fg={theme.textMuted} width={9} />
                <text content="Portfolio" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  Z      " fg={theme.textMuted} width={9} />
                <text content="Alerts" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  I      " fg={theme.textMuted} width={9} />
                <text content="Indicators" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  M      " fg={theme.textMuted} width={9} />
                <text content="Sentiment" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  C      " fg={theme.textMuted} width={9} />
                <text content="Compare" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  L      " fg={theme.textMuted} width={9} />
                <text content="Watchlist" fg={theme.text} />
              </box>
              <box flexDirection="row">
                <text content="  U      " fg={theme.textMuted} width={9} />
                <text content="Account stats" fg={theme.text} />
              </box>
            </box>
          </box>
        </Show>

        {/* Footer hint */}
        <text content="" />
        <text content="[Tab/←/→] Switch tab    [↑/↓/N/P] Theme list    [T/R] Mode/Reload    [ESC] Close" fg={theme.textMuted} />
      </box>
    </box>
  );
}
