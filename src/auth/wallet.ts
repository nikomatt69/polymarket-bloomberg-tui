import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { createHmac } from "crypto";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const CLOB_API_BASE = "https://clob.polymarket.com";
const USDC_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const CLOB_AUTH_MESSAGE = "This message attests that I control the given wallet";
const DEFAULT_TIMEOUT = 15000;

// Custom error classes for better error handling
export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}

export class InvalidPrivateKeyError extends WalletError {
  constructor(message: string = "Invalid private key format") {
    super(message);
    this.name = "InvalidPrivateKeyError";
  }
}

export class NetworkError extends WalletError {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "NetworkError";
  }
}

export class ConnectionTimeoutError extends WalletError {
  constructor(message: string = "Connection timed out") {
    super(message);
    this.name = "ConnectionTimeoutError";
  }
}

export interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}

export interface WalletConfig {
  address: string;
  privateKey: string;
  connectedAt: number;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
}

export interface WalletState {
  address: string | null;
  connected: boolean;
  balance: number;
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
    const parsed = JSON.parse(data) as WalletConfig;
    if (!parsed || !parsed.address || !parsed.privateKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWalletConfig(config: WalletConfig): void {
  writeFileSync(getWalletConfigPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearWalletConfig(): void {
  try {
    writeFileSync(getWalletConfigPath(), JSON.stringify({}), { mode: 0o600 });
  } catch {
    // ignore
  }
}

export function persistApiCredentials(creds: ApiCredentials): void {
  const config = loadWalletConfig();
  if (!config) return;

  saveWalletConfig({
    ...config,
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
    apiPassphrase: creds.apiPassphrase,
  });
}

/**
 * Validates and normalizes a private key
 * @throws InvalidPrivateKeyError if the key is invalid
 */
function validatePrivateKey(privateKey: string): `0x${string}` {
  // Check for empty or whitespace
  if (!privateKey || privateKey.trim().length === 0) {
    throw new InvalidPrivateKeyError("Private key cannot be empty");
  }

  // Remove whitespace
  const cleaned = privateKey.trim();

  // Check for valid hex length (64 chars without 0x, 66 with 0x)
  const hexPart = cleaned.startsWith("0x") ? cleaned.slice(2) : cleaned;
  
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new InvalidPrivateKeyError("Private key must be a valid hexadecimal string");
  }

  if (hexPart.length !== 64) {
    throw new InvalidPrivateKeyError(
      `Private key must be 64 characters (${hexPart.length} provided). Did you paste the correct key?`
    );
  }

  // Check for all zeros (technically valid but unlikely to be intentional)
  if (hexPart === "0".repeat(64)) {
    throw new InvalidPrivateKeyError("Private key appears to be all zeros - please provide a valid key");
  }

  return (`0x${hexPart}`) as `0x${string}`;
}

/**
 * Wraps a fetch call with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new ConnectionTimeoutError(`Connection timed out after ${timeoutMs / 1000}s to ${url}`);
      }
      // Network errors (DNS, connection refused, etc.)
      throw new NetworkError(`Network error: ${err.message}. Please check your internet connection.`);
    }
    throw new NetworkError("Unknown network error occurred");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Connect wallet from a private key string
 * @throws InvalidPrivateKeyError if the key is invalid
 */
export function connectFromPrivateKey(privateKey: string): WalletConfig {
  const normalized = validatePrivateKey(privateKey);
  
  try {
    const account = privateKeyToAccount(normalized);
    const config: WalletConfig = {
      address: account.address,
      privateKey: normalized,
      connectedAt: Date.now(),
    };
    saveWalletConfig(config);
    return config;
  } catch (err) {
    if (err instanceof InvalidPrivateKeyError) {
      throw err;
    }
    // Viem throws various errors for invalid keys
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new InvalidPrivateKeyError(`Failed to derive wallet address: ${message}`);
  }
}

function getStoredApiCredentials(): ApiCredentials | null {
  const config = loadWalletConfig();
  if (!config?.apiKey || !config.apiSecret || !config.apiPassphrase) {
    return null;
  }
  return {
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    apiPassphrase: config.apiPassphrase,
  };
}

function parseApiCredentials(payload: unknown): ApiCredentials | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as {
    apiKey?: unknown;
    key?: unknown;
    secret?: unknown;
    passphrase?: unknown;
  };

  const apiKey = typeof candidate.apiKey === "string" ? candidate.apiKey : typeof candidate.key === "string" ? candidate.key : "";
  const apiSecret = typeof candidate.secret === "string" ? candidate.secret : "";
  const apiPassphrase = typeof candidate.passphrase === "string" ? candidate.passphrase : "";

  if (!apiKey || !apiSecret || !apiPassphrase) return null;
  return { apiKey, apiSecret, apiPassphrase };
}

export async function getClobAuthHeaders(
  privateKey: `0x${string}`,
  nonce: number = 0,
  timestamp?: number,
): Promise<Record<string, string>> {
  const account = privateKeyToAccount(privateKey);
  const ts = timestamp ?? Math.floor(Date.now() / 1000);

  const signature = await account.signTypedData({
    domain: {
      name: "ClobAuthDomain",
      version: "1",
      chainId: 137,
    },
    types: {
      ClobAuth: [
        { name: "address", type: "address" },
        { name: "timestamp", type: "string" },
        { name: "nonce", type: "uint256" },
        { name: "message", type: "string" },
      ],
    },
    primaryType: "ClobAuth",
    message: {
      address: account.address,
      timestamp: String(ts),
      nonce: BigInt(nonce),
      message: CLOB_AUTH_MESSAGE,
    },
  });

  return {
    POLY_ADDRESS: account.address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: String(ts),
    POLY_NONCE: String(nonce),
  };
}

function toUrlSafeBase64(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_");
}

export function buildClobL2Signature(
  secret: string,
  timestamp: number,
  method: string,
  requestPath: string,
  body?: string,
): string {
  const normalizedSecret = secret.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "");
  const message = `${timestamp}${method.toUpperCase()}${requestPath}${body ?? ""}`;
  const hmac = createHmac("sha256", Buffer.from(normalizedSecret, "base64"));
  hmac.update(message);
  return toUrlSafeBase64(hmac.digest("base64"));
}

export async function getClobL2Headers(
  privateKey: `0x${string}`,
  creds: ApiCredentials,
  args: { method: string; requestPath: string; body?: string },
  timestamp?: number,
): Promise<Record<string, string>> {
  const account = privateKeyToAccount(privateKey);
  const ts = timestamp ?? Math.floor(Date.now() / 1000);

  const signature = buildClobL2Signature(
    creds.apiSecret,
    ts,
    args.method,
    args.requestPath,
    args.body,
  );

  return {
    POLY_ADDRESS: account.address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: String(ts),
    POLY_API_KEY: creds.apiKey,
    POLY_PASSPHRASE: creds.apiPassphrase,
  };
}

export async function fetchUsdcBalance(address: string): Promise<number> {
  try {
    const client = createPublicClient({
      chain: polygon,
      transport: http("https://polygon-rpc.com", {
        timeout: DEFAULT_TIMEOUT,
      }),
    });

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

    return parseFloat(formatUnits(balance, 6));
  } catch (err) {
    if (err instanceof ConnectionTimeoutError || err instanceof NetworkError) {
      throw err;
    }
    console.warn("Failed to fetch USDC balance from Polygon, falling back to CLOB:", err);
    return fetchClobBalance(address);
  }
}

async function fetchClobBalance(address: string): Promise<number> {
  try {
    const response = await fetchWithTimeout(`${CLOB_API_BASE}/balance?address=${address}`);
    if (!response.ok) {
      throw new NetworkError(
        `Failed to fetch balance: HTTP ${response.status} ${response.statusText}`,
        response.status
      );
    }
    const data = (await response.json()) as { balance?: string | number };
    return parseFloat(String(data.balance ?? "0"));
  } catch (err) {
    if (err instanceof ConnectionTimeoutError || err instanceof NetworkError) {
      throw err;
    }
    throw new NetworkError("Failed to fetch balance from CLOB API");
  }
}

export async function fetchOrCreateApiCredentials(privateKey: `0x${string}`): Promise<ApiCredentials | null> {
  const stored = getStoredApiCredentials();
  if (stored) return stored;

  try {
    const l1Headers = await getClobAuthHeaders(privateKey, 0);

    const deriveResponse = await fetchWithTimeout(`${CLOB_API_BASE}/auth/derive-api-key`, {
      method: "GET",
      headers: {
        ...l1Headers,
        "Content-Type": "application/json",
      },
    });

    if (deriveResponse.ok) {
      const derivedPayload = await deriveResponse.json();
      const derived = parseApiCredentials(derivedPayload);
      if (derived) {
        persistApiCredentials(derived);
        return derived;
      }
    }

    const createResponse = await fetchWithTimeout(`${CLOB_API_BASE}/auth/api-key`, {
      method: "POST",
      headers: {
        ...l1Headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!createResponse.ok) {
      throw new NetworkError(
        `Failed to create API key: HTTP ${createResponse.status} ${createResponse.statusText}`,
        createResponse.status
      );
    }

    const createdPayload = await createResponse.json();
    const created = parseApiCredentials(createdPayload);
    if (!created) {
      throw new WalletError("Invalid API credentials response from server");
    }

    persistApiCredentials(created);
    return created;
  } catch (err) {
    if (err instanceof ConnectionTimeoutError || err instanceof NetworkError || err instanceof WalletError) {
      throw err;
    }
    throw new NetworkError("Failed to fetch or create API credentials");
  }
}

export function disconnectWallet(): void {
  clearWalletConfig();
}

export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
