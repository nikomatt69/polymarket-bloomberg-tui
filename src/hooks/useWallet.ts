/**
 * SolidJS reactive hook for wallet state management
 */

import {
  loadWalletConfig,
  connectFromPrivateKey,
  disconnectWallet,
  fetchUsdcBalance,
  fetchOrCreateApiCredentials,
  persistFunderAddress,
  truncateAddress,
  derivePolymarketProxyWallet,
  derivePolymarketSafeWallet,
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
 * Auto-derive and set funder address using CREATE2 proxy wallet derivation.
 * Picks the address (proxy or safe) that holds USDC; defaults to proxy if both are empty.
 */
async function autoSetFunderAddress(eoaAddress: string): Promise<string> {
  const proxyAddr = derivePolymarketProxyWallet(eoaAddress);
  const safeAddr  = derivePolymarketSafeWallet(eoaAddress);

  const [proxyBal, safeBal] = await Promise.all([
    fetchUsdcBalance(proxyAddr).catch(() => 0),
    fetchUsdcBalance(safeAddr).catch(() => 0),
  ]);

  const resolved = safeBal > 0 && safeBal >= proxyBal ? safeAddr : proxyAddr;
  persistFunderAddress(resolved);
  setWalletState("funderAddress", resolved);
  return resolved;
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
  if (config.funderAddress) setWalletState("funderAddress", config.funderAddress);

  // Auto-derive funder address if not already set
  if (!config.funderAddress) {
    try {
      await autoSetFunderAddress(config.address);
    } catch (err) {
      console.warn("Funder address auto-derivation failed (non-fatal):", err);
    }
  }

  const balanceAddress = walletState.funderAddress ?? config.address;
  try {
    const balance = await fetchUsdcBalance(balanceAddress);
    setWalletState("balance", balance);
  } catch (err) {
    console.warn("Balance fetch failed on init (non-fatal):", err);
    setWalletState("balance", 0);
  }

  try {
    const creds = await fetchOrCreateApiCredentials(config.privateKey as `0x${string}`);
    if (creds) {
      setWalletState("apiKey", creds.apiKey);
      setWalletState("apiSecret", creds.apiSecret);
      setWalletState("apiPassphrase", creds.apiPassphrase);
    }
  } catch (err) {
    console.warn("API credentials fetch failed on init (non-fatal):", err);
  }

  setWalletState("loading", false);

  fetchUserPositions();
}

/**
 * Connect wallet from a private key string (entered by user in TUI)
 */
export async function connectWallet(privateKey: string): Promise<void> {
  setWalletState("loading", true);
  setWalletState("error", null);

  let config;
  try {
    config = connectFromPrivateKey(privateKey);
  } catch (err) {
    setWalletState("error", formatWalletError(err));
    setWalletState("connected", false);
    setWalletState("address", null);
    setWalletState("loading", false);
    console.error("Wallet connection error:", err);
    return;
  }

  // Key is valid — mark as connected immediately
  setWalletState("address", config.address);
  setWalletState("connected", true);
  setWalletState("loading", false);
  if (config.funderAddress) setWalletState("funderAddress", config.funderAddress);

  // Auto-derive funder address if not already set
  if (!config.funderAddress) {
    try {
      await autoSetFunderAddress(config.address);
    } catch (err) {
      console.warn("Funder address auto-derivation failed (non-fatal):", err);
    }
  }

  // Balance and API creds are best-effort: failures don't disconnect the wallet
  // Use funder/proxy address for balance (funds live there, not in EOA)
  const balanceAddress = walletState.funderAddress ?? config.address;
  try {
    const balance = await fetchUsdcBalance(balanceAddress);
    setWalletState("balance", balance);
  } catch (err) {
    console.warn("Balance fetch failed (non-fatal):", err);
    setWalletState("balance", 0);
  }

  try {
    const creds = await fetchOrCreateApiCredentials(config.privateKey as `0x${string}`);
    if (creds) {
      setWalletState("apiKey", creds.apiKey);
      setWalletState("apiSecret", creds.apiSecret);
      setWalletState("apiPassphrase", creds.apiPassphrase);
    }
  } catch (err) {
    console.warn("API credentials fetch failed (non-fatal):", err);
  }

  fetchUserPositions();
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
  setWalletState("funderAddress", undefined);
  setWalletState("error", null);
}

/**
 * Refresh balance for currently connected wallet
 */
export async function refreshWalletBalance(): Promise<void> {
  if (!walletState.address) return;
  const balanceAddress = walletState.funderAddress ?? walletState.address;
  try {
    const balance = await fetchUsdcBalance(balanceAddress);
    setWalletState("balance", balance);
  } catch (err) {
    const errorMessage = formatWalletError(err);
    setWalletState("error", `Failed to refresh balance: ${errorMessage}`);
    console.error("Balance refresh error:", err);
  }
}

/**
 * Save and apply a Polymarket proxy wallet (funder) address
 */
export function saveFunderAddress(address: string): void {
  const trimmed = address.trim();
  if (!trimmed) {
    persistFunderAddress("");
    setWalletState("funderAddress", undefined);
    return;
  }
  // Validate basic format before saving
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    setWalletState("error", `Invalid address format: must be 0x + 40 hex chars`);
    return;
  }
  persistFunderAddress(trimmed);
  setWalletState("funderAddress", trimmed);
  setWalletState("error", null);
}

/**
 * Get display-friendly wallet label
 */
export function getWalletLabel(): string {
  if (!walletState.connected || !walletState.address) return "No Wallet";
  return truncateAddress(walletState.address);
}
