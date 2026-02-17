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
} from "./state";
import { useMarketsFetch, useRefreshInterval, manualRefresh } from "./hooks/useMarketData";
import { initializeWallet, connectWallet, disconnectWalletHook } from "./hooks/useWallet";
import { ThemeProvider } from "./context/theme";

export function App() {
  initializeState();
  useMarketsFetch();
  useRefreshInterval(30000);
  initializeWallet();

  useKeyboard((e: KeyEvent) => {
    // When wallet modal is open, handle its keys only (block all other navigation)
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
        setWalletModalOpen(true);
        break;
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
