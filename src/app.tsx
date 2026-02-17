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
  setOrderFormTokenId,
  setOrderFormMarketTitle,
  setOrderFormOutcomeTitle,
  setOrderFormCurrentPrice,
  setOrderFormPriceInput,
  setOrderFormSharesInput,
  orderFormPriceInput,
  orderFormSharesInput,
  orderHistoryOpen,
  setOrderHistoryOpen,
  portfolioOpen,
  setPortfolioOpen,
  getSelectedMarket,
} from "./state";
import { useMarketsFetch, useRefreshInterval, manualRefresh } from "./hooks/useMarketData";
import { initializeWallet, connectWallet, disconnectWalletHook } from "./hooks/useWallet";
import { submitOrder, refreshOrders } from "./hooks/useOrders";
import { fetchUserPositions } from "./hooks/usePositions";
import { loadAlerts, setAlertsState, alertsState, addAlert, dismissAlert, deleteAlert } from "./hooks/useAlerts";
import { loadWatchlist, toggleWatchlist, toggleWatchlistFilter } from "./hooks/useWatchlist";
import { ThemeProvider } from "./context/theme";

export function App() {
  initializeState();
  useMarketsFetch();
  useRefreshInterval(30000);
  initializeWallet();
  loadAlerts();
  loadWatchlist();

  useKeyboard((e: KeyEvent) => {
    // Order form modal intercept
    if (orderFormOpen()) {
      if (e.name === "escape") {
        setOrderFormOpen(false);
        setOrderFormPriceInput("");
        setOrderFormSharesInput("");
      } else if (e.name === "tab") {
        setOrderFormFocusField(orderFormFocusField() === "price" ? "shares" : "price");
      } else if (e.name === "return") {
        const price = parseFloat(orderFormPriceInput());
        const shares = parseFloat(orderFormSharesInput());
        if (!isNaN(price) && price > 0 && price < 1 && !isNaN(shares) && shares > 0) {
          const market = getSelectedMarket();
          submitOrder({
            tokenId: appState.selectedMarketId ?? "",
            side: orderFormSide(),
            price,
            shares,
            type: "GTC",
            marketTitle: market?.title,
            outcomeTitle: market?.outcomes[0]?.title,
          }).then((result) => {
            if (result) {
              setOrderFormOpen(false);
              setOrderFormPriceInput("");
              setOrderFormSharesInput("");
            }
          });
        }
      }
      return;
    }

    // Order history modal intercept
    if (orderHistoryOpen()) {
      if (e.name === "escape") {
        setOrderHistoryOpen(false);
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
        } else if (e.name === "return") {
          const val = parseFloat(alertsState.addThreshold);
          if (isNaN(val) || val <= 0 || val >= 1) {
            setAlertsState("addError", "Threshold must be between 0 and 1");
          } else {
            const market = getSelectedMarket();
            if (!market || market.outcomes.length === 0) {
              setAlertsState("addError", "No market selected");
            } else {
              const outcome = market.outcomes[0];
              addAlert(market.id, market.title, outcome.title, alertsState.addCondition, val);
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
          setOrderFormFocusField("shares");
          setOrderFormOpen(true);
        }
        break;
      }
      case "h":
        // h — open order history
        refreshOrders();
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
      case "k":
        if (e.ctrl) {
          const nextSort =
            appState.sortBy === "volume"
              ? "change"
              : appState.sortBy === "change"
                ? "name"
                : "volume";
          setSortBy(nextSort);
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
    <ThemeProvider>
      <Layout />
    </ThemeProvider>
  );
}
