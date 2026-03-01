/**
 * Settings panel — tabbed overlay for theme, providers, account, display, and key bindings
 * Key: E — toggle open/close
 * Tabs: THEME · PROVIDERS · ACCOUNT · DISPLAY · KEYS
 */

import { For, Show, createSignal } from "solid-js";
import { useTheme } from "../context/theme";
import {
  walletState,
  appState,
  aiProviderState,
  settingsSelectedProviderId,
  setSettingsSelectedProviderId,
  setSettingsPanelOpen,
  settingsPanelTab,
  settingsThemeQuery,
  settingsThemeSearchEditing,
  setSettingsPanelTab,
  setSortBy,
  setTimeframe,
  setWalletModalOpen,
  setActiveAIProvider,
  updateAIProviderField,
  addAIProvider,
  removeAIProvider,
  maskSecret,
} from "../state";
import { disconnectWalletHook, refreshWalletBalance } from "../hooks/useWallet";
import { watchlistState, toggleWatchlistFilter } from "../hooks/useWatchlist";
import { truncateAddress } from "../auth/wallet";

export function SettingsPanel() {
  const ctx = useTheme();
  const { theme, toggleMode } = ctx;
  const THEME_LIST_WINDOW = 8;

  const fuzzyScore = (query: string, target: string): number | null => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return 0;

    const t = target.toLowerCase();
    let cursor = 0;
    let lastIdx = -10;
    let score = 0;

    for (const ch of q) {
      const idx = t.indexOf(ch, cursor);
      if (idx === -1) {
        return null;
      }

      score += idx <= 1 ? 5 : 1;
      if (idx === lastIdx + 1) {
        score += 7;
      }
      if (target[idx] === query[0]) {
        score += 2;
      }

      cursor = idx + 1;
      lastIdx = idx;
    }

    score += Math.max(0, 16 - (t.length - q.length));
    return score;
  };

  const matchedThemeNames = () => {
    const query = settingsThemeQuery().trim();
    const names = ctx.availableThemes;

    if (query.length === 0) {
      return names;
    }

    return names
      .map((name) => ({
        name,
        score: fuzzyScore(query, name),
      }))
      .filter((entry): entry is { name: string; score: number } => entry.score !== null)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((entry) => entry.name);
  };

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
    const names = matchedThemeNames();
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

  const themeIndexPad = () => Math.max(2, String(Math.max(themeCount(), matchedThemeNames().length)).length);

  const [addingProvider, setAddingProvider] = createSignal(false);
  const [newProviderId, setNewProviderId] = createSignal("");
  const [newProviderName, setNewProviderName] = createSignal("");
  const [newProviderBaseUrl, setNewProviderBaseUrl] = createSignal("https://openrouter.ai/api/v1");
  const [newProviderModel, setNewProviderModel] = createSignal("anthropic/claude-sonnet-4");
  const [newProviderApiKey, setNewProviderApiKey] = createSignal("");
  const [providerError, setProviderError] = createSignal("");

  const selectedProvider = () =>
    aiProviderState.providers.find((provider) => provider.id === settingsSelectedProviderId())
    ?? aiProviderState.providers.find((provider) => provider.id === aiProviderState.activeProviderId)
    ?? aiProviderState.providers[0]
    ?? null;

  const isActiveProvider = (providerId: string) => aiProviderState.activeProviderId === providerId;

  const providerRowColor = (providerId: string) => {
    if (providerId === settingsSelectedProviderId()) return theme.highlight;
    if (isActiveProvider(providerId)) return theme.success;
    return theme.text;
  };

  const startAddProvider = () => {
    setAddingProvider(true);
    setProviderError("");
    setNewProviderId("");
    setNewProviderName("");
    setNewProviderBaseUrl("https://openrouter.ai/api/v1");
    setNewProviderModel("");
    setNewProviderApiKey("");
  };

  const createProvider = () => {
    const result = addAIProvider({
      id: newProviderId(),
      name: newProviderName(),
      baseUrl: newProviderBaseUrl(),
      model: newProviderModel(),
      apiKey: newProviderApiKey(),
      kind: "custom",
    });

    if (!result.ok) {
      setProviderError(result.error);
      return;
    }

    setSettingsSelectedProviderId(newProviderId().trim());
    setAddingProvider(false);
    setProviderError("");
  };

  const removeSelectedProvider = () => {
    const selected = selectedProvider();
    if (!selected) {
      return;
    }

    const result = removeAIProvider(selected.id);
    if (!result.ok) {
      setProviderError(result.error);
      return;
    }

    const fallback = aiProviderState.providers.find((provider) => provider.id === aiProviderState.activeProviderId)
      ?? aiProviderState.providers[0]
      ?? null;
    if (fallback) {
      setSettingsSelectedProviderId(fallback.id);
    }
    setProviderError("");
  };

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
        <box onMouseDown={() => setSettingsPanelTab("providers")}>
          <text
            content={settingsPanelTab() === "providers" ? " [PROVIDERS] " : "  PROVIDERS  "}
            fg={settingsPanelTab() === "providers" ? theme.primary : theme.textMuted}
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
          <box flexDirection="row" gap={1}>
            <text content="Search:" fg={theme.textMuted} />
            <text
              content={settingsThemeSearchEditing() ? `${settingsThemeQuery()}▌` : (settingsThemeQuery() || "(none)")}
              fg={settingsThemeSearchEditing() ? theme.warning : theme.text}
            />
            <text content={`  Matches: ${matchedThemeNames().length}`} fg={theme.textMuted} />
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
          <Show when={matchedThemeNames().length > 0} fallback={<text content="No themes match current search" fg={theme.error} />}>
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
          </Show>
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

        {/* PROVIDERS tab */}
        <Show when={settingsPanelTab() === "providers"}>
          <box flexDirection="row" width="100%" gap={3}>
            <box flexDirection="column" width={34}>
              <text content="AI Providers" fg={theme.primary} />
              <text content="Select provider:" fg={theme.textMuted} />
              <For each={aiProviderState.providers}>
                {(provider) => (
                  <box onMouseDown={() => setSettingsSelectedProviderId(provider.id)}>
                    <text
                      content={`${provider.id === settingsSelectedProviderId() ? ">" : " "} ${provider.name} (${provider.id})${isActiveProvider(provider.id) ? " *ACTIVE" : ""}`}
                      fg={providerRowColor(provider.id)}
                    />
                  </box>
                )}
              </For>

              <text content="" />
              <box flexDirection="row" gap={2}>
                <box onMouseDown={startAddProvider}>
                  <text content="[Click] Add" fg={theme.success} />
                </box>
                <box onMouseDown={removeSelectedProvider}>
                  <text content="[D/Click] Remove" fg={theme.error} />
                </box>
              </box>
            </box>

            <box flexDirection="column" flexGrow={1}>
              <Show when={!addingProvider()} fallback={
                <box flexDirection="column" width="100%">
                  <text content="Create custom provider" fg={theme.primary} />
                  <box flexDirection="row" gap={1}>
                    <text content="Id:" fg={theme.textMuted} width={11} />
                    <input width="100%" value={newProviderId()} onInput={setNewProviderId} />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="Name:" fg={theme.textMuted} width={11} />
                    <input width="100%" value={newProviderName()} onInput={setNewProviderName} />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="Base URL:" fg={theme.textMuted} width={11} />
                    <input width="100%" value={newProviderBaseUrl()} onInput={setNewProviderBaseUrl} />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="Model id:" fg={theme.textMuted} width={11} />
                    <input width="100%" value={newProviderModel()} onInput={setNewProviderModel} />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="API key:" fg={theme.textMuted} width={11} />
                    <input width="100%" value={newProviderApiKey()} onInput={setNewProviderApiKey} />
                  </box>
                  <Show when={providerError().length > 0}>
                    <text content={providerError()} fg={theme.error} />
                  </Show>
                  <box flexDirection="row" gap={2}>
                    <box onMouseDown={createProvider}>
                      <text content="[CLICK] Save Provider" fg={theme.success} />
                    </box>
                    <box onMouseDown={() => { setAddingProvider(false); setProviderError(""); }}>
                      <text content="[CLICK] Cancel" fg={theme.textMuted} />
                    </box>
                  </box>
                </box>
              }>
                <Show when={selectedProvider()}>
                  <text content={`Selected: ${selectedProvider()!.name}`} fg={theme.primary} />
                  <box flexDirection="row" gap={1}>
                    <text content="Provider id:" fg={theme.textMuted} width={11} />
                    <text content={selectedProvider()!.id} fg={theme.text} />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="Type:" fg={theme.textMuted} width={11} />
                    <text content={selectedProvider()!.kind.toUpperCase()} fg={theme.text} />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="Base URL:" fg={theme.textMuted} width={11} />
                    <input
                      width="100%"
                      value={selectedProvider()!.baseUrl}
                      onInput={(value: string) => {
                        updateAIProviderField(selectedProvider()!.id, "baseUrl", value);
                        setProviderError("");
                      }}
                    />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="Model id:" fg={theme.textMuted} width={11} />
                    <input
                      width="100%"
                      value={selectedProvider()!.model}
                      onInput={(value: string) => {
                        updateAIProviderField(selectedProvider()!.id, "model", value);
                        setProviderError("");
                      }}
                    />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="API key:" fg={theme.textMuted} width={11} />
                    <input
                      width="100%"
                      value={selectedProvider()!.apiKey ?? ""}
                      onInput={(value: string) => {
                        updateAIProviderField(selectedProvider()!.id, "apiKey", value);
                        setProviderError("");
                      }}
                    />
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text content="Stored key:" fg={theme.textMuted} width={11} />
                    <text content={maskSecret(selectedProvider()!.apiKey)} fg={theme.text} />
                  </box>

                  <box flexDirection="row" gap={2}>
                    <box onMouseDown={() => {
                      if (setActiveAIProvider(selectedProvider()!.id)) {
                        setProviderError("");
                      }
                    }}>
                      <text content="[Click] Set Active" fg={theme.success} />
                    </box>
                    <text
                      content={isActiveProvider(selectedProvider()!.id) ? "ACTIVE" : ""}
                      fg={isActiveProvider(selectedProvider()!.id) ? theme.success : theme.textMuted}
                    />
                  </box>
                  <text content="Model id is fully manual: write any provider model string." fg={theme.textMuted} />
                </Show>
              </Show>
            </box>
          </box>

          <Show when={providerError().length > 0}>
            <text content={providerError()} fg={theme.error} />
          </Show>
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
            <box onMouseDown={() => setTimeframe("1h")}>
              <text
                content={appState.timeframe === "1h" ? "[1H] " : " 1H  "}
                fg={appState.timeframe === "1h" ? theme.primary : theme.textMuted}
              />
            </box>
            <box onMouseDown={() => setTimeframe("4h")}>
              <text
                content={appState.timeframe === "4h" ? "[4H] " : " 4H  "}
                fg={appState.timeframe === "4h" ? theme.primary : theme.textMuted}
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
            <box onMouseDown={() => setTimeframe("1w")}>
              <text
                content={appState.timeframe === "1w" ? "[1W] " : " 1W  "}
                fg={appState.timeframe === "1w" ? theme.primary : theme.textMuted}
              />
            </box>
            <box onMouseDown={() => setTimeframe("1M")}>
              <text
                content={appState.timeframe === "1M" ? "[1M] " : " 1M  "}
                fg={appState.timeframe === "1M" ? theme.primary : theme.textMuted}
              />
            </box>
            <box onMouseDown={() => setTimeframe("all")}>
              <text
                content={appState.timeframe === "all" ? "[ALL] " : " ALL  "}
                fg={appState.timeframe === "all" ? theme.primary : theme.textMuted}
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
        <text content="[Tab/←/→] Switch tab    [/] Theme search    [↑/↓] Provider list    [Click] Set active    [ESC] Close" fg={theme.textMuted} />
      </box>
    </box>
  );
}
