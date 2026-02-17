/**
 * Wallet authentication for Polymarket CLOB API
 * Stores address + private key in ~/.polymarket-tui/config.json
 * Uses L1 ECDSA auth for signed API requests
 */

import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const CLOB_API_BASE = "https://clob.polymarket.com";
const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const USDC_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC on Polygon

export interface WalletConfig {
  address: string;
  privateKey: string; // stored locally, never sent to any server
  connectedAt: number;
}

export interface WalletState {
  address: string | null;
  connected: boolean;
  balance: number; // USDC balance
  username?: string;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  loading: boolean;
  error: string | null;
}

function getConfigDir(): string {
  const dir = join(homedir(), ".polymarket-tui");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getWalletConfigPath(): string {
  return join(getConfigDir(), "wallet.json");
}

export function loadWalletConfig(): WalletConfig | null {
  try {
    const data = readFileSync(getWalletConfigPath(), "utf-8");
    return JSON.parse(data) as WalletConfig;
  } catch {
    return null;
  }
}

export function saveWalletConfig(config: WalletConfig): void {
  writeFileSync(getWalletConfigPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearWalletConfig(): void {
  try {
    const path = getWalletConfigPath();
    writeFileSync(path, JSON.stringify({}), { mode: 0o600 });
  } catch {
    // ignore
  }
}

/**
 * Derive account from private key and persist config
 */
export function connectFromPrivateKey(privateKey: string): WalletConfig {
  // Normalize: ensure 0x prefix
  const normalized = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(normalized);
  const config: WalletConfig = {
    address: account.address,
    privateKey: normalized,
    connectedAt: Date.now(),
  };
  saveWalletConfig(config);
  return config;
}

/**
 * Generate L1 auth headers for CLOB API using ECDSA signature
 * Polymarket CLOB L1 auth: sign timestamp with private key
 */
export async function getClobAuthHeaders(privateKey: `0x${string}`): Promise<Record<string, string>> {
  const account = privateKeyToAccount(privateKey);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = "0";

  // Message format per Polymarket CLOB docs
  const message = `${timestamp}${nonce}`;
  const signature = await account.signMessage({ message });

  return {
    "POLY_ADDRESS": account.address,
    "POLY_SIGNATURE": signature,
    "POLY_TIMESTAMP": timestamp,
    "POLY_NONCE": nonce,
  };
}

/**
 * Fetch USDC balance on Polygon for the given address
 */
export async function fetchUsdcBalance(address: string): Promise<number> {
  try {
    const client = createPublicClient({
      chain: polygon,
      transport: http("https://polygon-rpc.com"),
    });

    // ERC-20 balanceOf ABI
    const balance = await client.readContract({
      address: USDC_CONTRACT as `0x${string}`,
      abi: [
        {
          name: "balanceOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
      ] as const,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    // USDC has 6 decimals
    return parseFloat(formatUnits(balance, 6));
  } catch {
    // Fallback: try CLOB API balance endpoint
    return fetchClobBalance(address);
  }
}

/**
 * Fallback balance fetch via Polymarket CLOB API
 */
async function fetchClobBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/balance?address=${address}`);
    if (!response.ok) return 0;
    const data = await response.json() as { balance?: string | number };
    return parseFloat(String(data.balance ?? "0"));
  } catch {
    return 0;
  }
}

/**
 * Fetch CLOB API credentials (apiKey, secret, passphrase) for an address.
 * Creates them if they don't exist for this address.
 */
export async function fetchOrCreateApiCredentials(
  privateKey: `0x${string}`
): Promise<{ apiKey: string; apiSecret: string; apiPassphrase: string } | null> {
  try {
    const account = privateKeyToAccount(privateKey);
    const headers = await getClobAuthHeaders(privateKey);

    // Try to get existing credentials
    const getResp = await fetch(`${CLOB_API_BASE}/auth/api-key`, {
      headers: { ...headers, "Content-Type": "application/json" },
    });

    if (getResp.ok) {
      const data = await getResp.json() as { apiKey?: string; secret?: string; passphrase?: string };
      if (data.apiKey) {
        return {
          apiKey: data.apiKey,
          apiSecret: data.secret ?? "",
          apiPassphrase: data.passphrase ?? "",
        };
      }
    }

    // Create new credentials
    const createResp = await fetch(`${CLOB_API_BASE}/auth/api-key`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ address: account.address }),
    });

    if (!createResp.ok) return null;
    const created = await createResp.json() as { apiKey?: string; secret?: string; passphrase?: string };
    if (!created.apiKey) return null;

    return {
      apiKey: created.apiKey,
      apiSecret: created.secret ?? "",
      apiPassphrase: created.passphrase ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Disconnect wallet: clear persisted config
 */
export function disconnectWallet(): void {
  clearWalletConfig();
}

/**
 * Truncate address for display: 0x1234...abcd
 */
export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
