/**
 * Root application component
 * Orchestrates state, effects, and keyboard input via OpenTUI hooks
 */

import { createEffect, onCleanup } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { KeyEvent } from "@opentui/core";
import { Layout } from "./components/layout";
import {
  initializeState,
  savePersistedState,
  navigateNext,
  navigatePrev,
  setSortBy,
  setTimeframe,
  appState,
  walletModalOpen,
  setWalletModalOpen,
  walletModalMode,
  setWalletModalMode,
  walletModalInput,
  setWalletModalInput,
  orderFormOpen,
  setOrderFormOpen,
  orderFormFocusField,
  setOrderFormFocusField,
  orderFormSide,
  setOrderFormSide,
  orderFormTokenId,
  setOrderFormTokenId,
  setOrderFormMarketTitle,
  setOrderFormOutcomeTitle,
  setOrderFormCurrentPrice,
  setOrderFormPriceInput,
  setOrderFormSharesInput,
  orderFormPostOnly,
  setOrderFormPostOnly,
  orderFormPriceInput,
  orderFormSharesInput,
  orderFormType,
  setOrderFormType,
  orderHistoryOpen,
  setOrderHistoryOpen,
  orderHistorySelectedIdx,
  setOrderHistorySelectedIdx,
  orderHistoryTradeSelectedIdx,
  setOrderHistoryTradeSelectedIdx,
  orderHistorySection,
  setOrderHistorySection,
  portfolioOpen,
  setPortfolioOpen,
  orderBookPanelOpen,
  setOrderBookPanelOpen,
  indicatorsPanelOpen,
  setIndicatorsPanelOpen,
  sentimentPanelOpen,
  setSentimentPanelOpen,
  comparisonPanelOpen,
  setComparisonPanelOpen,
  comparisonSelectMode,
  setComparisonSelectMode,
  setComparisonSelectedMarketId,
  watchlistPanelOpen,
  setWatchlistPanelOpen,
  accountStatsOpen,
  setAccountStatsOpen,
  getSelectedMarket,
  getFilteredMarkets,
  highlightedIndex,
  navigateToIndex,

} from "./state";
import { useMarketsFetch, useRefreshInterval, manualRefresh } from "./hooks/useMarketData";
import { initializeWallet, connectWallet, disconnectWalletHook } from "./hooks/useWallet";
import {
  submitOrder,
  cancelOrderById,
  refreshOrders,
  ordersState,
  cycleOrderHistoryStatusFilter,
  cycleOrderHistoryWindowFilter,
  cycleOrderHistorySideFilter,
  setOrderHistoryStatusFilter,
  toggleOrderHistorySelectedMarketOnly,
  startOrderHistorySearch,
  stopOrderHistorySearch,
  clearOrderHistorySearch,
  appendOrderHistorySearch,
  backspaceOrderHistorySearch,
  getFilteredOpenOrders,
  getFilteredTradeHistory,
  getReplayCandidateOrderBySection,
  exportOrderHistoryCsv,
  cancelAllOpenOrders,
  cancelSelectedMarketOpenOrders,
} from "./hooks/useOrders";
import { fetchUserPositions } from "./hooks/usePositions";
import { loadAlerts, setAlertsState, alertsState, addAlert, dismissAlert, deleteAlert } from "./hooks/useAlerts";
import { loadSentiment as refreshSentiment } from "./components/sentiment-panel";
import {
  setSelectedIndicator,
  selectedIndicator,
  smaPeriod,
  setSmaPeriod,
  rsiPeriod,
  setRsiPeriod,
} from "./components/indicators-panel";
import { loadWatchlist, toggleWatchlist, toggleWatchlistFilter } from "./hooks/useWatchlist";
import { ThemeProvider, useTheme } from "./context/theme";
import {
  settingsPanelOpen,
  setSettingsPanelOpen,
  settingsPanelTab,
  aiProviderState,
  settingsSelectedProviderId,
  setSettingsSelectedProviderId,
  settingsThemeQuery,
  setSettingsThemeQuery,
  settingsThemeSearchEditing,
  setSettingsThemeSearchEditing,
  setSettingsPanelTab,
  setActiveAIProvider,
  removeAIProvider,
  shortcutsPanelOpen,
  setShortcutsPanelOpen,
  setChatInputFocused,
  searchInputFocused,
  setSearchInputFocused,
} from "./state";
import { refreshWalletBalance } from "./hooks/useWallet";
import { useAssistant } from "./hooks/useAssistant";

function AppContent() {
  initializeState();
  useMarketsFetch();
  useRefreshInterval(30000);
  initializeWallet();
  loadAlerts();
  loadWatchlist();

  const themeCtx = useTheme();
  const { toggleMode, setTheme, reloadThemes } = themeCtx;

  const fuzzyThemeMatches = (query: string, names: string[]): string[] => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) {
      return names;
    }

    const score = (target: string): number | null => {
      const normalized = target.toLowerCase();
      let cursor = 0;
      let lastIdx = -10;
      let points = 0;

      for (const ch of trimmed) {
        const idx = normalized.indexOf(ch, cursor);
        if (idx === -1) return null;

        points += idx <= 1 ? 5 : 1;
        if (idx === lastIdx + 1) {
          points += 7;
        }

        cursor = idx + 1;
        lastIdx = idx;
      }

      points += Math.max(0, 16 - (normalized.length - trimmed.length));
      return points;
    };

    return names
      .map((name) => ({ name, score: score(name) }))
      .filter((entry): entry is { name: string; score: number } => entry.score !== null)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((entry) => entry.name);
  };

  const getThemeCycleList = (): string[] => {
    const query = settingsThemeQuery().trim();
    if (!query) {
      return themeCtx.availableThemes;
    }

    const matches = fuzzyThemeMatches(query, themeCtx.availableThemes);
    return matches.length > 0 ? matches : themeCtx.availableThemes;
  };

  useKeyboard((e: KeyEvent) => {
    // Order form modal intercept
    if (orderFormOpen()) {
      if (e.name === "escape") {
        setOrderFormOpen(false);
        setOrderFormPriceInput("");
        setOrderFormSharesInput("");
        setOrderFormPostOnly(false);
      } else if (e.name === "tab") {
        setOrderFormFocusField(orderFormFocusField() === "price" ? "shares" : "price");
      } else if (e.name === "t") {
        const types: Array<"GTC" | "FOK" | "GTD"> = ["GTC", "FOK", "GTD"];
        const cur = types.indexOf(orderFormType());
        setOrderFormType(types[(cur + 1) % types.length]);
      } else if (e.name === "p") {
        setOrderFormPostOnly(!orderFormPostOnly());
      } else if (e.name === "return") {
        const price = parseFloat(orderFormPriceInput());
        const shares = parseFloat(orderFormSharesInput());
        const isPostOnlyValid = !(orderFormPostOnly() && orderFormType() === "FOK");

        if (!isNaN(price) && price > 0 && price < 1 && !isNaN(shares) && shares > 0 && isPostOnlyValid) {
          const market = getSelectedMarket();
          submitOrder({
            tokenId: orderFormTokenId(),
            side: orderFormSide(),
            price,
            shares,
            type: orderFormType(),
            postOnly: orderFormPostOnly(),
            marketTitle: market?.title,
            outcomeTitle: market?.outcomes[0]?.title,
          }).then((result) => {
            if (result) {
              setOrderFormOpen(false);
              setOrderFormPriceInput("");
              setOrderFormSharesInput("");
              setOrderFormPostOnly(false);
            }
          });
        }
      }
      return;
    }

    // Order history modal intercept
    if (orderHistoryOpen()) {
      const selectedMarket = getSelectedMarket();
      const selectedTokenIds = selectedMarket ? selectedMarket.outcomes.map((outcome) => outcome.id) : [];
      const filteredOpenOrders = getFilteredOpenOrders(selectedTokenIds);
      const filteredTrades = getFilteredTradeHistory(selectedTokenIds);
      const activeSection = orderHistorySection();
      const activeCount = activeSection === "open" ? filteredOpenOrders.length : filteredTrades.length;

      const resetHistoryCursor = () => {
        setOrderHistorySelectedIdx(0);
        setOrderHistoryTradeSelectedIdx(0);
      };

      if (ordersState.historySearchEditing) {
        if (e.name === "escape" || e.name === "return") {
          stopOrderHistorySearch();
        } else if (e.name === "backspace") {
          backspaceOrderHistorySearch();
          if (activeSection === "open") {
            setOrderHistorySelectedIdx(0);
          } else {
            setOrderHistoryTradeSelectedIdx(0);
          }
        } else if (e.sequence && e.sequence.length === 1 && e.sequence >= " ") {
          appendOrderHistorySearch(e.sequence);
          if (activeSection === "open") {
            setOrderHistorySelectedIdx(0);
          } else {
            setOrderHistoryTradeSelectedIdx(0);
          }
        }
        return;
      }

      if (e.name === "escape") {
        stopOrderHistorySearch();
        setOrderHistoryOpen(false);
        resetHistoryCursor();
        setOrderHistorySection("open");
      } else if (e.name === "tab") {
        const nextSection = activeSection === "open" ? "trades" : "open";
        setOrderHistorySection(nextSection);
      } else if (e.name === "up" || e.name === "k") {
        if (activeSection === "open") {
          setOrderHistorySelectedIdx((i) => Math.max(0, i - 1));
        } else {
          setOrderHistoryTradeSelectedIdx((i) => Math.max(0, i - 1));
        }
      } else if (e.name === "down" || e.name === "j") {
        if (activeSection === "open") {
          setOrderHistorySelectedIdx((i) => Math.min(Math.max(0, activeCount - 1), i + 1));
        } else {
          setOrderHistoryTradeSelectedIdx((i) => Math.min(Math.max(0, activeCount - 1), i + 1));
        }
      } else if (e.name === "c") {
        if (activeSection === "open") {
          const order = filteredOpenOrders[orderHistorySelectedIdx()];
          if (order && (order.status === "LIVE" || order.status === "DELAYED" || order.status === "UNMATCHED")) {
            cancelOrderById(order.orderId);
          }
        }
      } else if (e.name === "a") {
        void cancelAllOpenOrders();
      } else if (e.name === "y") {
        void cancelSelectedMarketOpenOrders(selectedTokenIds);
      } else if (e.name === "v") {
        cycleOrderHistoryStatusFilter();
        resetHistoryCursor();
      } else if (e.name === "b") {
        cycleOrderHistorySideFilter();
        resetHistoryCursor();
      } else if (e.name === "g") {
        cycleOrderHistoryWindowFilter();
        resetHistoryCursor();
      } else if (e.name === "m") {
        toggleOrderHistorySelectedMarketOnly();
        resetHistoryCursor();
      } else if (e.name === "1") {
        setOrderHistoryStatusFilter("ALL");
        resetHistoryCursor();
      } else if (e.name === "2") {
        setOrderHistoryStatusFilter("LIVE");
        resetHistoryCursor();
      } else if (e.name === "3") {
        setOrderHistoryStatusFilter("MATCHED");
        resetHistoryCursor();
      } else if (e.name === "4") {
        setOrderHistoryStatusFilter("FILLED");
        resetHistoryCursor();
      } else if (e.name === "5") {
        setOrderHistoryStatusFilter("CANCELLED");
        resetHistoryCursor();
      } else if (e.name === "6") {
        setOrderHistoryStatusFilter("DELAYED");
        resetHistoryCursor();
      } else if (e.name === "7") {
        setOrderHistoryStatusFilter("UNMATCHED");
        resetHistoryCursor();
      } else if (e.name === "x") {
        clearOrderHistorySearch();
        resetHistoryCursor();
      } else if (e.name === "e") {
        try {
          exportOrderHistoryCsv(selectedTokenIds);
        } catch {
          // ignore export errors; panel keeps working
        }
      } else if (e.name === "d") {
        const replayOrder = getReplayCandidateOrderBySection(
          activeSection,
          selectedTokenIds,
          orderHistorySelectedIdx(),
          orderHistoryTradeSelectedIdx(),
        );
        if (replayOrder) {
          setOrderFormSide(replayOrder.side);
          setOrderFormType("GTC");
          setOrderFormPostOnly(Boolean(replayOrder.postOnly));
          setOrderFormTokenId(replayOrder.tokenId);
          setOrderFormMarketTitle(replayOrder.marketTitle ?? selectedMarket?.title ?? "Replay Order");
          setOrderFormOutcomeTitle(replayOrder.outcomeTitle ?? replayOrder.tokenId.slice(0, 12));
          setOrderFormCurrentPrice(replayOrder.price);
          setOrderFormPriceInput(replayOrder.price.toFixed(4));
          setOrderFormSharesInput(replayOrder.originalSize.toFixed(2));
          setOrderFormFocusField("shares");
          setOrderHistoryOpen(false);
          setOrderFormOpen(true);
        }
      } else if (e.sequence === "/" || e.name === "slash") {
        startOrderHistorySearch();
      }
      return;
    }

    // Order book panel intercept
    if (orderBookPanelOpen()) {
      if (e.name === "escape") {
        setOrderBookPanelOpen(false);
      }
      return;
    }

    // Indicators panel intercept
    if (indicatorsPanelOpen()) {
      if (e.name === "escape") {
        setIndicatorsPanelOpen(false);
      } else if (e.name === "1") {
        setSelectedIndicator("sma");
      } else if (e.name === "2") {
        setSelectedIndicator("rsi");
      } else if (e.name === "3") {
        setSelectedIndicator("macd");
      } else if (e.name === "4") {
        setSelectedIndicator("bollinger");
      } else if (e.sequence === "+" || e.sequence === "=") {
        if (selectedIndicator() === "rsi") {
          setRsiPeriod(Math.min(50, rsiPeriod() + 1));
        } else {
          setSmaPeriod(Math.min(60, smaPeriod() + 1));
        }
      } else if (e.sequence === "-") {
        if (selectedIndicator() === "rsi") {
          setRsiPeriod(Math.max(5, rsiPeriod() - 1));
        } else {
          setSmaPeriod(Math.max(5, smaPeriod() - 1));
        }
      }
      return;
    }

    // Sentiment panel intercept
    if (sentimentPanelOpen()) {
      if (e.name === "escape") {
        setSentimentPanelOpen(false);
      } else if (e.name === "r") {
        const market = getSelectedMarket();
        if (market) refreshSentiment(market.id);
      }
      return;
    }

    // Comparison panel intercept
    if (comparisonPanelOpen()) {
      if (comparisonSelectMode()) {
        if (e.name === "escape") {
          setComparisonSelectMode(false);
          setComparisonPanelOpen(false);
        } else if (e.name === "up" || e.name === "k") {
          navigatePrev();
        } else if (e.name === "down" || e.name === "j") {
          navigateNext();
        } else if (e.name === "return") {
          const markets = getFilteredMarkets();
          const selected = markets[highlightedIndex()];
          if (selected) {
            setComparisonSelectedMarketId(selected.id);
            setComparisonSelectMode(false);
          }
        }
      } else {
        if (e.name === "escape") {
          setComparisonPanelOpen(false);
          setComparisonSelectedMarketId(null);
        } else if (e.name === "c") {
          setComparisonSelectMode(true);
        }
      }
      return;
    }

    // Watchlist panel intercept
    if (watchlistPanelOpen()) {
      if (e.name === "escape") {
        setWatchlistPanelOpen(false);
      }
      return;
    }

    // Shortcuts panel intercept
    if (shortcutsPanelOpen()) {
      if (e.name === "escape" || e.name === "k") {
        setShortcutsPanelOpen(false);
      }
      return;
    }

    // Account stats panel intercept
    if (accountStatsOpen()) {
      if (e.name === "escape") {
        setAccountStatsOpen(false);
      }
      return;
    }

    // Settings panel intercept
    if (settingsPanelOpen()) {
      const TABS = ["theme", "providers", "account", "display", "keys"] as const;
      if (e.name === "escape") {
        setSettingsPanelOpen(false);
        setSettingsThemeSearchEditing(false);
      } else if (e.name === "tab" || e.name === "right") {
        const idx = TABS.indexOf(settingsPanelTab());
        setSettingsPanelTab(TABS[(idx + 1) % TABS.length]);
        setSettingsThemeSearchEditing(false);
      } else if (e.name === "left") {
        const idx = TABS.indexOf(settingsPanelTab());
        setSettingsPanelTab(TABS[(idx - 1 + TABS.length) % TABS.length]);
        setSettingsThemeSearchEditing(false);
      } else if (settingsPanelTab() === "theme") {
        if (settingsThemeSearchEditing()) {
          if (e.name === "escape") {
            setSettingsThemeSearchEditing(false);
          } else if (e.name === "return") {
            const matches = getThemeCycleList();
            if (matches.length > 0) {
              setTheme(matches[0]!);
            }
            setSettingsThemeSearchEditing(false);
          } else if (e.name === "backspace") {
            setSettingsThemeQuery(settingsThemeQuery().slice(0, -1));
          } else if (e.sequence && e.sequence.length === 1 && e.sequence >= " ") {
            setSettingsThemeQuery((settingsThemeQuery() + e.sequence).slice(0, 32));
          }
          return;
        }

        if (e.name === "return" || e.name === "t") {
          toggleMode();
        } else if (e.name === "n" || e.name === "j" || e.name === "down") {
          const names = getThemeCycleList();
          if (names.length > 0) {
            const idx = names.indexOf(themeCtx.themeName);
            const currentIdx = idx >= 0 ? idx : 0;
            setTheme(names[(currentIdx + 1) % names.length]!);
          }
        } else if (e.name === "p" || e.name === "k" || e.name === "up") {
          const names = getThemeCycleList();
          if (names.length > 0) {
            const idx = names.indexOf(themeCtx.themeName);
            const currentIdx = idx >= 0 ? idx : 0;
            setTheme(names[(currentIdx - 1 + names.length) % names.length]!);
          }
        } else if (e.name === "r") {
          reloadThemes();
        } else if (e.sequence === "/" || e.name === "slash") {
          setSettingsThemeSearchEditing(true);
        } else if (e.name === "x") {
          setSettingsThemeQuery("");
        }
      } else if (settingsPanelTab() === "providers") {
        // Providers tab uses direct input fields and mouse actions.
        // Keep key handling neutral here so typing API keys/model ids never triggers shortcuts.
      } else if (settingsPanelTab() === "account") {
        if (e.name === "d") disconnectWalletHook();
        else if (e.name === "r") void refreshWalletBalance();
        else if (e.name === "w") { setSettingsPanelOpen(false); setWalletModalOpen(true); }
      } else if (settingsPanelTab() === "display") {
        if (e.name === "f") toggleWatchlistFilter();
        else if (e.name === "ctrl+k") {
          const sorts = ["volume", "change", "name"] as const;
          const i = sorts.indexOf(appState.sortBy as typeof sorts[number]);
          setSortBy(sorts[(i + 1) % 3]);
        }
      }
      return;
    }

    // Alerts panel intercept — ALL sub-keys handled here (no useKeyboard in component)
    if (alertsState.panelOpen) {
      if (alertsState.adding) {
        const focusOrder: Array<"condition" | "threshold" | "cooldown" | "debounce"> = [
          "condition",
          "threshold",
          "cooldown",
          "debounce",
        ];

        const adjustAddField = (delta: number) => {
          if (alertsState.addFocus === "cooldown") {
            const current = Number.parseInt(alertsState.addCooldownMinutes || "0", 10);
            const safeCurrent = Number.isFinite(current) ? current : 0;
            const next = Math.max(0, Math.min(1_440, safeCurrent + delta));
            setAlertsState("addCooldownMinutes", String(next));
          } else if (alertsState.addFocus === "debounce") {
            const next = Math.max(1, Math.min(10, alertsState.addDebouncePasses + delta));
            setAlertsState("addDebouncePasses", next);
          }
        };

        if (e.name === "escape") {
          setAlertsState("adding", false);
          setAlertsState("addThreshold", "");
          setAlertsState("addError", "");
        } else if (e.name === "tab") {
          const idx = focusOrder.indexOf(alertsState.addFocus);
          setAlertsState("addFocus", focusOrder[(idx + 1) % focusOrder.length]);
        } else if (e.name === "c" && alertsState.addFocus === "condition") {
          setAlertsState("addCondition", alertsState.addCondition === "above" ? "below" : "above");
        } else if (e.name === "m") {
          const metrics: Array<"price" | "change24h" | "volume24h" | "liquidity"> = [
            "price",
            "change24h",
            "volume24h",
            "liquidity",
          ];
          const currentIdx = metrics.indexOf(alertsState.addMetric);
          setAlertsState("addMetric", metrics[(currentIdx + 1) % metrics.length]);
        } else if (e.sequence === "+" || e.sequence === "=" || e.name === "right") {
          adjustAddField(1);
        } else if (e.sequence === "-" || e.name === "left") {
          adjustAddField(-1);
        } else if (e.name === "return") {
          const metric = alertsState.addMetric;
          const val = parseFloat(alertsState.addThreshold);
          const cooldownMinutes = Number.parseInt(alertsState.addCooldownMinutes, 10);
          const debouncePasses = alertsState.addDebouncePasses;
          const invalid =
            Number.isNaN(val)
            || (metric === "price" && (val <= 0 || val >= 1))
            || ((metric === "volume24h" || metric === "liquidity") && val <= 0);
          const cooldownInvalid = Number.isNaN(cooldownMinutes) || cooldownMinutes < 0 || cooldownMinutes > 1_440;
          const debounceInvalid = debouncePasses < 1 || debouncePasses > 10;

          if (invalid) {
            const message =
              metric === "price"
                ? "Price threshold must be between 0 and 1"
                : metric === "change24h"
                  ? "Change threshold must be a number"
                  : "Threshold must be greater than 0";
            setAlertsState("addError", message);
          } else if (cooldownInvalid) {
            setAlertsState("addError", "Cooldown must be between 0 and 1440 minutes");
          } else if (debounceInvalid) {
            setAlertsState("addError", "Debounce must be between 1 and 10 refresh passes");
          } else {
            const market = getSelectedMarket();
            if (!market || market.outcomes.length === 0) {
              setAlertsState("addError", "No market selected");
            } else {
              const outcome = market.outcomes[0];
              addAlert(
                market.id,
                market.title,
                outcome.id,
                outcome.title,
                metric,
                alertsState.addCondition,
                val,
                cooldownMinutes,
                debouncePasses,
              );
              setAlertsState("adding", false);
              setAlertsState("addThreshold", "");
              setAlertsState("addCooldownMinutes", "5");
              setAlertsState("addDebouncePasses", 1);
              setAlertsState("addError", "");
            }
          }
        } else if (alertsState.addFocus === "threshold" && e.name !== "tab") {
          if (e.name === "backspace") {
            setAlertsState("addThreshold", alertsState.addThreshold.slice(0, -1));
          } else if (e.sequence && e.sequence.length === 1 && e.sequence >= " ") {
            setAlertsState("addThreshold", alertsState.addThreshold + e.sequence);
          }
        } else if (alertsState.addFocus === "cooldown") {
          if (e.name === "backspace") {
            setAlertsState("addCooldownMinutes", alertsState.addCooldownMinutes.slice(0, -1));
          } else if (e.sequence && /[0-9]/.test(e.sequence)) {
            setAlertsState("addCooldownMinutes", `${alertsState.addCooldownMinutes}${e.sequence}`.slice(0, 4));
          }
        } else if (alertsState.addFocus === "debounce") {
          if (e.name === "backspace") {
            setAlertsState("addDebouncePasses", 1);
          } else if (e.sequence && /[0-9]/.test(e.sequence)) {
            const parsed = Number.parseInt(e.sequence, 10);
            if (Number.isFinite(parsed)) {
              setAlertsState("addDebouncePasses", Math.max(1, Math.min(10, parsed)));
            }
          }
        }
      } else {
        if (e.name === "escape") {
          setAlertsState("panelOpen", false);
        } else if (e.name === "a") {
          setAlertsState("adding", true);
          setAlertsState("addMetric", "price");
          setAlertsState("addFocus", "threshold");
          setAlertsState("addThreshold", "");
          setAlertsState("addCooldownMinutes", "5");
          setAlertsState("addDebouncePasses", 1);
          setAlertsState("addError", "");
        } else if (e.name === "d") {
          const visible = alertsState.alerts.filter((a) => a.status !== "dismissed");
          const alert = visible[alertsState.selectedIdx];
          if (alert) {
            deleteAlert(alert.id);
            setAlertsState("selectedIdx", Math.max(0, alertsState.selectedIdx - 1));
          }
        } else if (e.name === "x") {
          const visible = alertsState.alerts.filter((a) => a.status !== "dismissed");
          const alert = visible[alertsState.selectedIdx];
          if (alert) dismissAlert(alert.id);
        } else if (e.name === "up" || e.name === "k") {
          setAlertsState("selectedIdx", Math.max(0, alertsState.selectedIdx - 1));
        } else if (e.name === "down" || e.name === "j") {
          const visible = alertsState.alerts.filter((a) => a.status !== "dismissed");
          const maxIdx = Math.max(0, visible.length - 1);
          setAlertsState("selectedIdx", Math.min(maxIdx, alertsState.selectedIdx + 1));
        }
      }
      return;
    }

    // Wallet modal intercept
    if (walletModalOpen()) {
      if (e.name === "escape") {
        if (walletModalMode() === "enter") {
          setWalletModalMode("view");
          setWalletModalInput("");
        } else {
          setWalletModalOpen(false);
        }
      } else if (e.name === "c" && walletModalMode() === "view") {
        setWalletModalMode("enter");
      } else if (e.name === "return" && walletModalMode() === "enter") {
        const key = walletModalInput().trim();
        if (key) {
          setWalletModalMode("view");
          setWalletModalInput("");
          connectWallet(key);
        }
      } else if (e.name === "d" && walletModalMode() === "view") {
        disconnectWalletHook();
      }
      return;
    }



    // Search input intercept: while typing in search, block global shortcuts.
    if (searchInputFocused()) {
      if (e.name === "escape" || e.name === "return") {
        setSearchInputFocused(false);
      }
      return;
    }

    // Chat input intercept - handle when chat is focused
    const { focused, input, setInput, submitPrompt, blurInput } = useAssistant();
    if (focused()) {
      if (e.name === "escape") {
        blurInput();
      } else if (e.name === "return") {
        submitPrompt();
        blurInput();
      } else if (e.name === "backspace") {
        setInput(input().slice(0, -1));
      } else if (e.sequence && e.sequence.length === 1 && e.sequence >= " ") {
        setInput(input() + e.sequence);
      }
      return;
    }

    // Safety guard: if any overlay/panel is open, never dispatch main shortcuts.
    const anyOverlayOpen =
      orderFormOpen()
      || orderHistoryOpen()
      || orderBookPanelOpen()
      || indicatorsPanelOpen()
      || sentimentPanelOpen()
      || comparisonPanelOpen()
      || watchlistPanelOpen()
      || accountStatsOpen()
      || settingsPanelOpen()
      || shortcutsPanelOpen()
      || alertsState.panelOpen
      || walletModalOpen();

    if (anyOverlayOpen) {
      return;
    }

    switch (e.name) {
      case "slash":
        // / — focus search input
        setSearchInputFocused(true);
        break;
      case "return":
        // Enter to focus chat input
        setChatInputFocused(true);
        break;
      case "up":
        navigatePrev();
        break;
      case "down":
        navigateNext();
        break;
      case "r":
        manualRefresh();
        break;
      case "w":
        // w — wallet modal (same as original)
        setWalletModalOpen(true);
        break;
      case "p": {
        // p — toggle portfolio panel
        const nextOpen = !portfolioOpen();
        setPortfolioOpen(nextOpen);
        if (nextOpen) fetchUserPositions();
        break;
      }
      case "o": {
        // o — open buy order
        const market = getSelectedMarket();
        if (market && market.outcomes.length > 0) {
          const outcome = market.outcomes[0];
          setOrderFormSide("BUY");
          setOrderFormTokenId(outcome.id);
          setOrderFormMarketTitle(market.title);
          setOrderFormOutcomeTitle(outcome.title);
          setOrderFormCurrentPrice(outcome.price);
          setOrderFormPriceInput(outcome.price.toFixed(4));
          setOrderFormSharesInput("");
          setOrderFormPostOnly(false);
          setOrderFormFocusField("shares");
          setOrderFormOpen(true);
        }
        break;
      }
      case "s": {
        // s — open sell order
        const market = getSelectedMarket();
        if (market && market.outcomes.length > 0) {
          const outcome = market.outcomes[0];
          setOrderFormSide("SELL");
          setOrderFormTokenId(outcome.id);
          setOrderFormMarketTitle(market.title);
          setOrderFormOutcomeTitle(outcome.title);
          setOrderFormCurrentPrice(outcome.price);
          setOrderFormPriceInput(outcome.price.toFixed(4));
          setOrderFormSharesInput("");
          setOrderFormPostOnly(false);
          setOrderFormFocusField("shares");
          setOrderFormOpen(true);
        }
        break;
      }
      case "h":
        // h — open order history
        refreshOrders();
        stopOrderHistorySearch();
        setOrderHistorySelectedIdx(0);
        setOrderHistoryTradeSelectedIdx(0);
        setOrderHistorySection("open");
        setOrderHistoryOpen(true);
        break;
      case "z":
        // z — open price alerts panel
        setAlertsState("panelOpen", true);
        break;
      case "f":
        // f — toggle watchlist filter
        toggleWatchlistFilter();
        break;
      case "x": {
        // x — toggle watchlist for selected market
        const wMarket = getSelectedMarket();
        if (wMarket) toggleWatchlist(wMarket.id);
        break;
      }
      case "d":
        // d — toggle live order book depth panel
        setOrderBookPanelOpen(!orderBookPanelOpen());
        break;
      case "i":
        // i — toggle indicators panel
        setIndicatorsPanelOpen(!indicatorsPanelOpen());
        break;
      case "m":
        // m — toggle sentiment analysis panel
        setSentimentPanelOpen(!sentimentPanelOpen());
        break;
      case "c":
        // c — open comparison panel in select mode
        setComparisonPanelOpen(true);
        setComparisonSelectMode(true);
        break;
      case "l":
        // l — toggle watchlist panel
        setWatchlistPanelOpen(!watchlistPanelOpen());
        break;
      case "u": {
        // u — toggle account stats panel
        const nextOpen = !accountStatsOpen();
        setAccountStatsOpen(nextOpen);
        if (nextOpen) {
          fetchUserPositions();
          refreshOrders();
        }
        break;
      }
      case "k":
        if (e.ctrl) {
          const nextSort =
            appState.sortBy === "volume"
              ? "change"
              : appState.sortBy === "change"
                ? "name"
                : "volume";
          setSortBy(nextSort);
        } else {
          // k — toggle shortcuts panel
          setShortcutsPanelOpen(!shortcutsPanelOpen());
        }
        break;
      case "1":
        setTimeframe("1d");
        break;
      case "5":
        setTimeframe("5d");
        break;
      case "7":
        setTimeframe("7d");
        break;
      case "a":
        setTimeframe("all");
        break;
      case "e":
        // e — toggle settings panel
        setSettingsPanelOpen(!settingsPanelOpen());
        setSettingsThemeSearchEditing(false);
        break;
      case "q":
        savePersistedState();
        process.exit(0);
        break;
    }
  });

  const handleExit = () => {
    savePersistedState();
    process.exit(0);
  };
  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);
  onCleanup(() => {
    process.removeListener("SIGINT", handleExit);
    process.removeListener("SIGTERM", handleExit);
  });

  return (
    <Layout />
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
