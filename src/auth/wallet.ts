import { createPublicClient, http, formatUnits, getAddress, getCreate2Address, encodePacked, encodeAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { createHmac } from "crypto";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── Polymarket Proxy Wallet Derivation (from builder-relayer-client) ─────────

const PROXY_FACTORY_POLYGON = "0xaB45c5A4B0c941a2F231C04C3f49182e1A254052";
const SAFE_FACTORY_POLYGON  = "0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b";
const PROXY_INIT_CODE_HASH  = "0xd21df8dc65880a8606f09fe0ce3df9b8869287ab0b058be05aa9e8af6330a00b";
const SAFE_INIT_CODE_HASH   = "0x2bce2127ff07fb632d16c8347c4ebf501f4841168bed00d9e6ef715ddb6fcecf";

export function derivePolymarketProxyWallet(eoaAddress: string): string {
  return getCreate2Address({
    bytecodeHash: PROXY_INIT_CODE_HASH as `0x${string}`,
    from: PROXY_FACTORY_POLYGON as `0x${string}`,
    salt: keccak256(encodePacked(["address"], [eoaAddress as `0x${string}`])),
  });
}

export function derivePolymarketSafeWallet(eoaAddress: string): string {
  return getCreate2Address({
    bytecodeHash: SAFE_INIT_CODE_HASH as `0x${string}`,
    from: SAFE_FACTORY_POLYGON as `0x${string}`,
    salt: keccak256(encodeAbiParameters([{ name: "owner", type: "address" }], [eoaAddress as `0x${string}`])),
  });
}

const CLOB_API_BASE = "https://clob.polymarket.com";
// Polymarket uses native USDC on Polygon (Circle-issued)
// Also check bridged USDC.e as fallback
const USDC_NATIVE   = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // native USDC
const USDC_BRIDGED  = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e (bridged)
const POLYGON_RPCS  = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://rpc.ankr.com/polygon",
  "https://polygon-rpc.com",
];
const CLOB_AUTH_MESSAGE = "This message attests that I control the given wallet";
const DEFAULT_TIMEOUT = 15000;
const SERVER_TIME_CACHE_TTL_MS = 30_000;

let serverTimeCache: { value: number; fetchedAt: number } | null = null;

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
  funderAddress?: string; // Polymarket proxy wallet (maker for CLOB orders)
  authNonce?: number;
}

export interface WalletState {
  address: string | null;
  connected: boolean;
  balance: number;
  funderBalance: number; // Balance of the founder/proxy wallet
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

export function persistFunderAddress(funderAddress: string): void {
  const config = loadWalletConfig();
  if (!config) return;
  saveWalletConfig({ ...config, funderAddress });
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

export function persistApiCredentialsForFunder(funderAddress: string, creds: ApiCredentials): void {
  const config = loadWalletConfig();
  if (!config) return;

  const funderCredentialsKey = `funderApiKey_${funderAddress.toLowerCase()}`;
  const funderSecretKey = `funderApiSecret_${funderAddress.toLowerCase()}`;
  const funderPassphraseKey = `funderApiPassphrase_${funderAddress.toLowerCase()}`;

  saveWalletConfig({
    ...config,
    [funderCredentialsKey]: creds.apiKey,
    [funderSecretKey]: creds.apiSecret,
    [funderPassphraseKey]: creds.apiPassphrase,
  } as unknown as WalletConfig);
}

function getFunderNonceKey(funderAddress: string): string {
  return `funderAuthNonce_${funderAddress.toLowerCase()}`;
}

export function loadAuthNonce(funderAddress?: string): number {
  const config = loadWalletConfig();
  if (!config) return 0;

  if (funderAddress) {
    const rawValue = (config as unknown as Record<string, unknown>)[getFunderNonceKey(funderAddress)];
    return typeof rawValue === "number" && Number.isInteger(rawValue) && rawValue >= 0 ? rawValue : 0;
  }

  return typeof config.authNonce === "number" && Number.isInteger(config.authNonce) && config.authNonce >= 0
    ? config.authNonce
    : 0;
}

export function persistAuthNonce(nonce: number, funderAddress?: string): void {
  const config = loadWalletConfig();
  if (!config) return;

  const normalizedNonce = Number.isInteger(nonce) && nonce >= 0 ? nonce : 0;
  if (funderAddress) {
    saveWalletConfig({
      ...config,
      [getFunderNonceKey(funderAddress)]: normalizedNonce,
    } as unknown as WalletConfig);
    return;
  }

  saveWalletConfig({
    ...config,
    authNonce: normalizedNonce,
  });
}

export function loadApiCredentialsForFunder(funderAddress: string): ApiCredentials | null {
  const config = loadWalletConfig();
  if (!config) return null;

  const funderCredentialsKey = `funderApiKey_${funderAddress.toLowerCase()}`;
  const funderSecretKey = `funderApiSecret_${funderAddress.toLowerCase()}`;
  const funderPassphraseKey = `funderApiPassphrase_${funderAddress.toLowerCase()}`;

  const apiKey = (config as unknown as Record<string, unknown>)[funderCredentialsKey] as string | undefined;
  const apiSecret = (config as unknown as Record<string, unknown>)[funderSecretKey] as string | undefined;
  const apiPassphrase = (config as unknown as Record<string, unknown>)[funderPassphraseKey] as string | undefined;

  if (!apiKey || !apiSecret || !apiPassphrase) return null;
  return { apiKey, apiSecret, apiPassphrase };
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
export async function fetchWithTimeout(
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

export function parseApiCredentials(payload: unknown): ApiCredentials | null {
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
  const ts = timestamp ?? await getClobServerTimestamp();

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
  args: { method: string; requestPath: string; body?: string; address?: string },
  timestamp?: number,
): Promise<Record<string, string>> {
  const account = privateKeyToAccount(privateKey);
  const ts = timestamp ?? await getClobServerTimestamp();
  const address = args.address ? getAddress(args.address) : account.address;

  const signature = buildClobL2Signature(
    creds.apiSecret,
    ts,
    args.method,
    args.requestPath,
    args.body,
  );

  return {
    POLY_ADDRESS: address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: String(ts),
    POLY_API_KEY: creds.apiKey,
    POLY_PASSPHRASE: creds.apiPassphrase,
  };
}

export async function getClobServerTimestamp(forceRefresh: boolean = false): Promise<number> {
  const now = Date.now();
  if (!forceRefresh && serverTimeCache && now - serverTimeCache.fetchedAt < SERVER_TIME_CACHE_TTL_MS) {
    return serverTimeCache.value;
  }

  try {
    const response = await fetchWithTimeout(`${CLOB_API_BASE}/time`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new NetworkError(`Failed to fetch CLOB server time: HTTP ${response.status}`, response.status);
    }

    const payload = await response.json();
    const value = typeof payload === "number" ? payload : Number.parseInt(String(payload), 10);
    if (!Number.isFinite(value)) {
      throw new WalletError("Invalid CLOB server time response");
    }

    const normalizedValue = Math.floor(value);
    serverTimeCache = { value: normalizedValue, fetchedAt: now };
    return normalizedValue;
  } catch (error) {
    if (serverTimeCache) {
      return serverTimeCache.value;
    }
    if (error instanceof WalletError || error instanceof NetworkError || error instanceof ConnectionTimeoutError) {
      throw error;
    }
    throw new NetworkError("Failed to synchronize with CLOB server time");
  }
}

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function readUsdcFromRpc(rpcUrl: string, address: string): Promise<number> {
  const client = createPublicClient({
    chain: polygon,
    transport: http(rpcUrl, { timeout: DEFAULT_TIMEOUT }),
  });

  // Fetch both native USDC and bridged USDC.e, return the sum
  const [native, bridged] = await Promise.allSettled([
    client.readContract({
      address: USDC_NATIVE as `0x${string}`,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    }),
    client.readContract({
      address: USDC_BRIDGED as `0x${string}`,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    }),
  ]);

  const nativeAmt  = native.status  === "fulfilled" ? parseFloat(formatUnits(native.value,  6)) : 0;
  const bridgedAmt = bridged.status === "fulfilled" ? parseFloat(formatUnits(bridged.value, 6)) : 0;
  return nativeAmt + bridgedAmt;
}

export async function fetchUsdcBalance(address: string): Promise<number> {
  // Try each RPC in order until one succeeds
  for (const rpc of POLYGON_RPCS) {
    try {
      const balance = await readUsdcFromRpc(rpc, address);
      if (balance >= 0) return balance;
    } catch (err) {
      console.warn(`RPC ${rpc} failed:`, err);
    }
  }

  // All RPCs failed — try CLOB fallback
  try {
    return await fetchClobBalance(address);
  } catch {
    return 0;
  }
}

async function fetchClobBalance(address: string): Promise<number> {
  // Try CLOB /user endpoint
  try {
    const response = await fetchWithTimeout(
      `${CLOB_API_BASE}/user?userAddress=${encodeURIComponent(address)}`
    );
    if (response.ok) {
      const data = (await response.json()) as { balance?: string | number; usdcBalance?: string | number };
      const raw = data.usdcBalance ?? data.balance;
      if (raw != null) return parseFloat(String(raw));
    }
  } catch {
    // fall through
  }
  // Final fallback: return 0 so the wallet still connects
  return 0;
}

export async function fetchOrCreateApiCredentials(privateKey: `0x${string}`): Promise<ApiCredentials | null> {
  const stored = getStoredApiCredentials();
  if (stored) return stored;

  try {
    const nonce = loadAuthNonce();
    const l1Headers = await getClobAuthHeaders(privateKey, nonce);

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
        persistAuthNonce(nonce);
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

    persistAuthNonce(nonce);
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
