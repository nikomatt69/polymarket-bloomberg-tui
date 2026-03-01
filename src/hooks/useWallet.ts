/**
 * SolidJS reactive hook for wallet state management
 */

import {
  loadWalletConfig,
  connectFromPrivateKey,
  disconnectWallet,
  fetchUsdcBalance,
  fetchOrCreateApiCredentials,
  truncateAddress,
  InvalidPrivateKeyError,
  NetworkError,
  ConnectionTimeoutError,
  WalletError,
} from "../auth/wallet";
import { setWalletState, walletState } from "../state";
import { fetchUserPositions } from "./usePositions";

/**
 * Formats error for display in TUI
 */
function formatWalletError(err: unknown): string {
  if (err instanceof InvalidPrivateKeyError) {
    return err.message;
  }
  if (err instanceof ConnectionTimeoutError) {
    return `${err.message}. Please try again.`;
  }
  if (err instanceof NetworkError) {
    if (err.statusCode === 401) {
      return "Authentication failed. Please check your credentials.";
    }
    if (err.statusCode === 403) {
      return "Access forbidden. Please check your API permissions.";
    }
    if (err.statusCode && err.statusCode >= 500) {
      return "Server error. Please try again later.";
    }
    return err.message;
  }
  if (err instanceof WalletError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred";
}

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
    const errorMessage = formatWalletError(err);
    setWalletState("error", errorMessage);
    console.error("Wallet initialization error:", err);
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
    const errorMessage = formatWalletError(err);
    setWalletState("error", errorMessage);
    setWalletState("connected", false);
    setWalletState("address", null);
    console.error("Wallet connection error:", err);
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
  } catch (err) {
    const errorMessage = formatWalletError(err);
    setWalletState("error", `Failed to refresh balance: ${errorMessage}`);
    console.error("Balance refresh error:", err);
  }
}

/**
 * Get display-friendly wallet label
 */
export function getWalletLabel(): string {
  if (!walletState.connected || !walletState.address) return "No Wallet";
  return truncateAddress(walletState.address);
}
