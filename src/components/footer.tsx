/**
 * Footer — Bloomberg-style keyboard shortcuts reference bar.
 * The visible shortcut chips are clickable and trigger the same actions.
 */

import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useTheme } from "../context/theme";
import {
  appState,
  accountStatsOpen,
  chatInputFocused,
  clearEnterpriseToolUiState,
  closeSearchPanel,
  enterpriseChatOpen,
  enterpriseToolSelectedId,
  getSelectedMarket,
  openSearchPanel,
  orderFormFocusField,
  orderFormOpen,
  orderFormOutcomeIdx,
  orderHistoryOpen,
  portfolioOpen,
  searchPanelCategory,
  searchPanelOpen,
  searchPanelResultIdx,
  setSearchPanelCategory,
  setSearchPanelResultIdx,
  setEnterpriseChatOpen,
  setOrderFormCurrentPrice,
  setOrderFormFocusField,
  setOrderFormMarketTitle,
  setOrderFormOpen,
  setOrderFormOutcomeTitle,
  setOrderFormPostOnly,
  setOrderFormPriceInput,
  setOrderFormSharesInput,
  setOrderFormSide,
  setOrderFormTokenId,
  setOrderHistoryOpen,
  setOrderHistorySection,
  setOrderHistorySelectedIdx,
  setOrderHistoryTradeSelectedIdx,
  setPortfolioOpen,
  setProfilePanelOpen,
  setSettingsPanelOpen,
  setSettingsThemeSearchEditing,
  setUserSearchLoading,
  setUserSearchOpen,
  setUserSearchQuery,
  setUserSearchResults,
  setWalletModalOpen,
  setXmtpChatOpen,
  settingsPanelOpen,
  userSearchOpen,
  xmtpChatOpen,
  xmtpInputFocused,
  toggleEnterpriseToolExpanded,
} from "../state";
import { alertsState, setAlertsState } from "../hooks/useAlerts";
import { positionsState, fetchUserPositions } from "../hooks/usePositions";
import { watchlistState } from "../hooks/useWatchlist";
import { refreshOrders } from "../hooks/useOrders";
import { refreshWalletBalance } from "../hooks/useWallet";
import { useAssistant } from "../hooks/useAssistant";
import { useXmtp } from "../hooks/useXmtp";
import {
  SEARCH_PANEL_CATEGORY_IDS,
  getSearchPanelResults,
  selectSearchPanelMarket,
} from "./search-panel";

interface KeyHint {
  key: string;
  fullLabel: string;
  onActivate?: () => void | Promise<void>;
}

export function Footer() {
  const { theme } = useTheme();
  const assistant = useAssistant();
  const xmtp = useXmtp();
  const [columns, setColumns] = createSignal(
    Number.isFinite(process.stdout.columns) ? process.stdout.columns : 120,
  );

  onMount(() => {
    const handleResize = () => {
      if (Number.isFinite(process.stdout.columns)) {
        setColumns(process.stdout.columns);
      }
    };

    process.stdout.on("resize", handleResize);
    onCleanup(() => {
      process.stdout.off("resize", handleResize);
    });
  });

  const openOrderForm = (side: "BUY" | "SELL") => {
    const market = getSelectedMarket();
    if (!market || market.outcomes.length === 0) return;

    const outcomeIdx = Math.min(orderFormOutcomeIdx(), market.outcomes.length - 1);
    const outcome = market.outcomes[outcomeIdx];
    if (!outcome) return;

    setOrderFormSide(side);
    setOrderFormTokenId(outcome.id);
    setOrderFormMarketTitle(market.title);
    setOrderFormOutcomeTitle(outcome.title);
    setOrderFormCurrentPrice(outcome.price);
    setOrderFormPriceInput(outcome.price.toFixed(4));
    setOrderFormSharesInput("");
    setOrderFormPostOnly(false);
    setOrderFormFocusField("shares");
    setOrderFormOpen(true);
  };

  const togglePortfolio = () => {
    const nextOpen = !portfolioOpen();
    setPortfolioOpen(nextOpen);
    if (nextOpen) {
      void fetchUserPositions();
      void refreshOrders();
    }
  };

  const openOrderHistory = () => {
    void refreshOrders();
    setOrderHistorySelectedIdx(0);
    setOrderHistoryTradeSelectedIdx(0);
    setOrderHistorySection("open");
    setOrderHistoryOpen(true);
  };

  const toggleUserSearch = () => {
    if (userSearchOpen()) {
      setUserSearchOpen(false);
    } else {
      setUserSearchOpen(true);
    }
    setUserSearchQuery("");
    setUserSearchResults([]);
    setUserSearchLoading(false);
  };

  const toggleSettings = () => {
    setSettingsPanelOpen(!settingsPanelOpen());
    setSettingsThemeSearchEditing(false);
  };

  const closeEnterpriseChat = () => {
    setEnterpriseChatOpen(false);
    clearEnterpriseToolUiState();
  };

  const closeXmtpChat = () => {
    setXmtpChatOpen(false);
    xmtp.setInputFocused(false);
  };

  const openCurrentSearchSelection = async () => {
    const market = getSearchPanelResults()[searchPanelResultIdx()];
    if (market) {
      await selectSearchPanelMarket(market);
    }
  };

  const cycleSearchCategory = () => {
    const current = SEARCH_PANEL_CATEGORY_IDS.indexOf(
      searchPanelCategory() as (typeof SEARCH_PANEL_CATEGORY_IDS)[number],
    );
    const nextCategory =
      SEARCH_PANEL_CATEGORY_IDS[(current + 1) % SEARCH_PANEL_CATEGORY_IDS.length] ?? "all";
    setSearchPanelCategory(nextCategory);
    setSearchPanelResultIdx(0);
  };

  const hints = createMemo<KeyHint[]>(() => {
    const nextHints: KeyHint[] = [];

    if (!enterpriseChatOpen() && !xmtpChatOpen()) {
      nextHints.push({ key: "↑↓/jk", fullLabel: "Navigate" });
      nextHints.push({ key: "Enter", fullLabel: "AI Chat", onActivate: () => { setEnterpriseChatOpen(true); } });
      nextHints.push({ key: "F", fullLabel: "P2P Chat", onActivate: () => { setXmtpChatOpen(true); } });
      nextHints.push({ key: "/", fullLabel: "Search", onActivate: openSearchPanel });
    }

    if (enterpriseChatOpen()) {
      if (chatInputFocused()) {
        nextHints.push({
          key: "Enter",
          fullLabel: "Send",
          onActivate: async () => {
            await assistant.submitPrompt();
            assistant.blurInput();
          },
        });
        nextHints.push({ key: "↑↓", fullLabel: "History", onActivate: assistant.navigateHistoryUp });
        nextHints.push({ key: "Ctrl+U", fullLabel: "Clear Line", onActivate: () => assistant.setInput("") });
        nextHints.push({ key: "Esc", fullLabel: "Blur", onActivate: assistant.blurInput });
        nextHints.push({ key: "Ctrl+L", fullLabel: "Clear Chat", onActivate: assistant.clearChat });
      } else {
        nextHints.push({ key: "I/Enter", fullLabel: "Focus Input", onActivate: assistant.focusInput });
        nextHints.push({ key: "↑↓", fullLabel: "Tool Select" });
        nextHints.push({
          key: "Space",
          fullLabel: "Expand Tool",
          onActivate: () => {
            const id = enterpriseToolSelectedId();
            if (id) toggleEnterpriseToolExpanded(id);
          },
        });
        nextHints.push({ key: "Esc", fullLabel: "Close Chat", onActivate: closeEnterpriseChat });
      }
    } else if (xmtpChatOpen()) {
      if (xmtpInputFocused()) {
        nextHints.push({
          key: "Enter",
          fullLabel: "Send",
          onActivate: () => void xmtp.sendMessage(xmtp.inputValue()),
        });
        nextHints.push({ key: "↑↓", fullLabel: "History", onActivate: xmtp.navigateHistoryUp });
        nextHints.push({ key: "Esc", fullLabel: "Blur", onActivate: () => { xmtp.setInputFocused(false); } });
      } else {
        nextHints.push({ key: "I/Enter", fullLabel: "Focus Input", onActivate: () => { xmtp.setInputFocused(true); } });
        nextHints.push({ key: "Esc", fullLabel: "Close Chat", onActivate: closeXmtpChat });
      }
    } else if (userSearchOpen()) {
      nextHints.push({ key: "Enter", fullLabel: "Search" });
      nextHints.push({ key: "Esc", fullLabel: "Close Search", onActivate: () => { toggleUserSearch(); } });
    } else if (accountStatsOpen()) {
      nextHints.push({ key: "Esc", fullLabel: "Close Account" });
      nextHints.push({ key: "W", fullLabel: "Wallet", onActivate: () => { setWalletModalOpen(true); } });
      nextHints.push({ key: "U", fullLabel: "Refresh Stats", onActivate: () => void refreshWalletBalance() });
    } else if (orderFormOpen()) {
      nextHints.push({
        key: "Tab",
        fullLabel: "Field",
        onActivate: () => { setOrderFormFocusField(orderFormFocusField() === "price" ? "shares" : "price"); },
      });
      nextHints.push({ key: "T", fullLabel: "Type" });
      nextHints.push({ key: "P", fullLabel: "PostOnly", onActivate: () => { setOrderFormPostOnly((value) => !value); } });
      nextHints.push({ key: "Enter", fullLabel: "Submit" });
    } else if (orderHistoryOpen()) {
      nextHints.push({ key: "Tab", fullLabel: "Open/Trade" });
      nextHints.push({ key: "C", fullLabel: "Cancel" });
      nextHints.push({ key: "A", fullLabel: "Cancel All" });
    } else if (alertsState.panelOpen) {
      nextHints.push({ key: "A", fullLabel: "Add Alert" });
      nextHints.push({ key: "D", fullLabel: "Delete" });
      nextHints.push({ key: "S", fullLabel: "Sound" });
    } else if (settingsPanelOpen()) {
      nextHints.push({ key: "Tab", fullLabel: "Next Tab" });
      nextHints.push({ key: "←→", fullLabel: "Tab" });
      nextHints.push({ key: "T", fullLabel: "Theme" });
      nextHints.push({ key: "Enter", fullLabel: "Select" });
    } else if (searchPanelOpen()) {
      nextHints.push({ key: "↑↓", fullLabel: "Navigate" });
      nextHints.push({ key: "Enter", fullLabel: "Open Market", onActivate: () => void openCurrentSearchSelection() });
      nextHints.push({ key: "Tab", fullLabel: "Category", onActivate: cycleSearchCategory });
      nextHints.push({ key: "Esc", fullLabel: "Close", onActivate: closeSearchPanel });
    } else {
      nextHints.push({ key: "O", fullLabel: "Buy", onActivate: () => openOrderForm("BUY") });
      nextHints.push({ key: "S", fullLabel: "Sell", onActivate: () => openOrderForm("SELL") });
      nextHints.push({ key: "H", fullLabel: "Orders", onActivate: openOrderHistory });
      nextHints.push({ key: "P", fullLabel: "Portfolio", onActivate: togglePortfolio });
      nextHints.push({ key: "Z", fullLabel: "Alerts", onActivate: () => { setAlertsState("panelOpen", true); } });
      nextHints.push({ key: "Ctrl+X", fullLabel: "User Profile", onActivate: () => { setProfilePanelOpen((open) => !open); } });
      nextHints.push({ key: "Ctrl+Y", fullLabel: "User Search", onActivate: toggleUserSearch });
      nextHints.push({ key: "E", fullLabel: "Settings", onActivate: toggleSettings });
    }

    return nextHints;
  });

  const visibleHints = createMemo(() => {
    const cols = Math.max(24, columns());
    const maxLen = Math.max(20, cols - 3);
    const selectedHints: KeyHint[] = [];
    let usedLen = 0;

    for (const hint of hints()) {
      const chunk = `[${hint.key}] ${hint.fullLabel}`;
      if (usedLen + chunk.length + 2 > maxLen) break;
      selectedHints.push(hint);
      usedLen += chunk.length + 2;
    }

    return selectedHints;
  });

  const dataAge = createMemo(() => {
    if (!appState.lastRefresh) return null;
    return Date.now() - appState.lastRefresh.getTime();
  });

  const activeFilterCount = createMemo(() => {
    let count = 0;
    if (watchlistState.filterActive) count += 1;
    if (appState.sortBy !== "volume") count += 1;
    return count;
  });

  const positionSummary = createMemo(() => {
    const pos = positionsState.positions;
    if (pos.length === 0) return "";
    const totalPnl = pos.reduce((sum, p) => sum + p.cashPnl, 0);
    const arrow = totalPnl >= 0 ? "▲" : "▼";
    const sign = totalPnl >= 0 ? "+" : "";
    return ` │ Pos:${pos.length} │ P&L:${arrow}${sign}$${totalPnl.toFixed(0)}`;
  });

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={theme.backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
    >
      <For each={visibleHints()}>
        {(hint, index) => {
          const chunk = `[${hint.key}] ${hint.fullLabel}`;
          const clickable = typeof hint.onActivate === "function";

          return (
            <box
              marginRight={index() === visibleHints().length - 1 ? 0 : 2}
              onMouseDown={clickable ? () => void hint.onActivate?.() : undefined}
            >
              <text content={chunk} fg={clickable ? theme.text : theme.textMuted} />
            </box>
          );
        }}
      </For>
      <box flexGrow={1} />
      <Show when={dataAge() !== null && dataAge()! > 60_000}>
        <text content={`⚠ ${Math.floor(dataAge()! / 60_000)}m+ OLD  `} fg={theme.warning} />
      </Show>
      <Show when={activeFilterCount() > 0}>
        <text content={`[${activeFilterCount()} filters]  `} fg={theme.accent} />
      </Show>
      <text content={positionSummary()} fg={theme.success} />
    </box>
  );
}
