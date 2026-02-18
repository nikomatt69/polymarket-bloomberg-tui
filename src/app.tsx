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
  setSettingsPanelTab,
  shortcutsPanelOpen,
  setShortcutsPanelOpen,
} from "./state";
import { refreshWalletBalance } from "./hooks/useWallet";

function AppContent() {
  initializeState();
  useMarketsFetch();
  useRefreshInterval(30000);
  initializeWallet();
  loadAlerts();
  loadWatchlist();

  const { toggleMode, cycleTheme, reloadThemes } = useTheme();

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
      const TABS = ["theme", "account", "display", "keys"] as const;
      if (e.name === "escape") {
        setSettingsPanelOpen(false);
      } else if (e.name === "tab" || e.name === "right") {
        const idx = TABS.indexOf(settingsPanelTab());
        setSettingsPanelTab(TABS[(idx + 1) % 4]);
      } else if (e.name === "left") {
        const idx = TABS.indexOf(settingsPanelTab());
        setSettingsPanelTab(TABS[(idx + 3) % 4]);
      } else if (settingsPanelTab() === "theme") {
        if (e.name === "return" || e.name === "t") {
          toggleMode();
        } else if (e.name === "n" || e.name === "j" || e.name === "down") {
          cycleTheme(1);
        } else if (e.name === "p" || e.name === "k" || e.name === "up") {
          cycleTheme(-1);
        } else if (e.name === "r") {
          reloadThemes();
        }
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
        if (e.name === "escape") {
          setAlertsState("adding", false);
          setAlertsState("addThreshold", "");
          setAlertsState("addError", "");
        } else if (e.name === "tab") {
          setAlertsState("addFocus", alertsState.addFocus === "condition" ? "threshold" : "condition");
        } else if (e.name === "c" && alertsState.addFocus === "condition") {
          setAlertsState("addCondition", alertsState.addCondition === "above" ? "below" : "above");
        } else if (e.name === "m" && alertsState.addFocus === "condition") {
          const metrics: Array<"price" | "change24h" | "volume24h" | "liquidity"> = [
            "price",
            "change24h",
            "volume24h",
            "liquidity",
          ];
          const currentIdx = metrics.indexOf(alertsState.addMetric);
          setAlertsState("addMetric", metrics[(currentIdx + 1) % metrics.length]);
        } else if (e.name === "return") {
          const metric = alertsState.addMetric;
          const val = parseFloat(alertsState.addThreshold);
          const invalid =
            Number.isNaN(val)
            || (metric === "price" && (val <= 0 || val >= 1))
            || ((metric === "volume24h" || metric === "liquidity") && val <= 0);

          if (invalid) {
            const message =
              metric === "price"
                ? "Price threshold must be between 0 and 1"
                : metric === "change24h"
                  ? "Change threshold must be a number"
                  : "Threshold must be greater than 0";
            setAlertsState("addError", message);
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
                val
              );
              setAlertsState("adding", false);
              setAlertsState("addThreshold", "");
              setAlertsState("addError", "");
            }
          }
        } else if (e.name !== "tab") {
          // forward printable chars to threshold input
          if (e.name === "backspace") {
            setAlertsState("addThreshold", alertsState.addThreshold.slice(0, -1));
          } else if (e.sequence && e.sequence.length === 1 && e.sequence >= " ") {
            setAlertsState("addThreshold", alertsState.addThreshold + e.sequence);
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
          setAlertsState("selectedIdx", Math.min(visible.length - 1, alertsState.selectedIdx + 1));
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

    switch (e.name) {
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
