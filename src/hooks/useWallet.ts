/**
 * SolidJS reactive hook for wallet state management
 */

import { createSignal } from "solid-js";
import {
  WalletState,
  loadWalletConfig,
  connectFromPrivateKey,
  disconnectWallet,
  fetchUsdcBalance,
  fetchOrCreateApiCredentials,
  truncateAddress,
} from "../auth/wallet";
import { setWalletState, walletState } from "../state";
import { fetchUserPositions } from "./usePositions";

/**
 * Initialize wallet from persisted config on startup
 */
export async function initializeWallet(): Promise<void> {
  const config = loadWalletConfig();
  if (!config?.address || !config?.privateKey) return;

  setWalletState("address", config.address);
  setWalletState("connected", true);
  setWalletState("loading", true);
  setWalletState("error", null);

  try {
    const [balance, creds] = await Promise.all([
      fetchUsdcBalance(config.address),
      fetchOrCreateApiCredentials(config.privateKey as `0x${string}`),
    ]);

    setWalletState("balance", balance);
    if (creds) {
      setWalletState("apiKey", creds.apiKey);
      setWalletState("apiSecret", creds.apiSecret);
      setWalletState("apiPassphrase", creds.apiPassphrase);
    }
  } catch (err) {
    setWalletState("error", err instanceof Error ? err.message : "Failed to load wallet");
  } finally {
    setWalletState("loading", false);
  }

  fetchUserPositions();
}

/**
 * Connect wallet from a private key string (entered by user in TUI)
 */
export async function connectWallet(privateKey: string): Promise<void> {
  setWalletState("loading", true);
  setWalletState("error", null);

  try {
    const config = connectFromPrivateKey(privateKey);
    setWalletState("address", config.address);
    setWalletState("connected", true);

    const [balance, creds] = await Promise.all([
      fetchUsdcBalance(config.address),
      fetchOrCreateApiCredentials(config.privateKey as `0x${string}`),
    ]);

    setWalletState("balance", balance);
    if (creds) {
      setWalletState("apiKey", creds.apiKey);
      setWalletState("apiSecret", creds.apiSecret);
      setWalletState("apiPassphrase", creds.apiPassphrase);
    }
    fetchUserPositions();
  } catch (err) {
    setWalletState("error", err instanceof Error ? err.message : "Invalid private key");
    setWalletState("connected", false);
    setWalletState("address", null);
  } finally {
    setWalletState("loading", false);
  }
}

/**
 * Disconnect wallet and clear state
 */
export function disconnectWalletHook(): void {
  disconnectWallet();
  setWalletState("address", null);
  setWalletState("connected", false);
  setWalletState("balance", 0);
  setWalletState("apiKey", undefined);
  setWalletState("apiSecret", undefined);
  setWalletState("apiPassphrase", undefined);
  setWalletState("error", null);
}

/**
 * Refresh balance for currently connected wallet
 */
export async function refreshWalletBalance(): Promise<void> {
  if (!walletState.address) return;
  try {
    const balance = await fetchUsdcBalance(walletState.address);
    setWalletState("balance", balance);
  } catch {
    // silent fail on refresh
  }
}

/**
 * Get display-friendly wallet label
 */
export function getWalletLabel(): string {
  if (!walletState.connected || !walletState.address) return "No Wallet";
  return truncateAddress(walletState.address);
}
