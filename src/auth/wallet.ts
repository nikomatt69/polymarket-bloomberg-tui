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

export function connectFromPrivateKey(privateKey: string): WalletConfig {
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
      transport: http("https://polygon-rpc.com"),
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
  } catch {
    return fetchClobBalance(address);
  }
}

async function fetchClobBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/balance?address=${address}`);
    if (!response.ok) return 0;
    const data = (await response.json()) as { balance?: string | number };
    return parseFloat(String(data.balance ?? "0"));
  } catch {
    return 0;
  }
}

export async function fetchOrCreateApiCredentials(privateKey: `0x${string}`): Promise<ApiCredentials | null> {
  const stored = getStoredApiCredentials();
  if (stored) return stored;

  try {
    const l1Headers = await getClobAuthHeaders(privateKey, 0);

    const deriveResponse = await fetch(`${CLOB_API_BASE}/auth/derive-api-key`, {
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

    const createResponse = await fetch(`${CLOB_API_BASE}/auth/api-key`, {
      method: "POST",
      headers: {
        ...l1Headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!createResponse.ok) {
      return null;
    }

    const createdPayload = await createResponse.json();
    const created = parseApiCredentials(createdPayload);
    if (!created) return null;

    persistApiCredentials(created);
    return created;
  } catch {
    return null;
  }
}

export function disconnectWallet(): void {
  clearWalletConfig();
}

export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
