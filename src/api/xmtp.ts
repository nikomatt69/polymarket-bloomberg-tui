import {
  Client,
  ConsentState,
  IdentifierKind,
  Dm,
  Group,
  isText,
  type Identifier,
} from "@xmtp/node-sdk";
import { getRandomValues } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";

const XMTP_ENV = "production";
const XMTP_APP_VERSION = "polymarket-bloomberg-tui/1.0.2";
const XMTP_INIT_TIMEOUT_MS = 60_000;
const XMTP_REQUEST_TIMEOUT_MS = 30_000;

export interface XmtpClientHandle {
  address: string;
  ownerAddress: string;
  signerType: "EOA";
  env: typeof XMTP_ENV;
  mode: "create" | "resume";
  inboxId?: string;
}

interface XmtpConversationRecord {
  id: string;
  peerAddress: string;
  peerInboxId?: string;
  name?: string;
  createdAt: Date;
}

interface XmtpMessageRecord {
  id: string;
  conversationId: string;
  senderAddress: string;
  content: string;
  timestamp: Date;
  status: "sent" | "delivered";
}

interface XmtpSessionMeta {
  walletAddress: string;
  env: typeof XMTP_ENV;
  dbEncryptionKey: string;
  dbPath: string;
  inboxId?: string;
  ownerAddress?: string;
  createdAt: string;
  updatedAt: string;
}

type StreamListener = {
  onMessage: (message: XmtpMessageRecord) => void;
  onError?: (error: Error) => void;
};

type StatusListener = (status: string | null) => void;
type CloseableAsyncStream<T> = AsyncIterable<T> & { return?: () => Promise<unknown> };

let xmtpClient: Client | null = null;
let activeHandle: XmtpClientHandle | null = null;
let activeMessageStream: CloseableAsyncStream<unknown> | null = null;
let lastStatus: string | null = null;

const streamListeners = new Set<StreamListener>();
const statusListeners = new Set<StatusListener>();

function emitStatus(status: string | null): void {
  lastStatus = status;
  for (const listener of statusListeners) {
    listener(status);
  }
}

function getXmtpRootDir(): string {
  const dir = join(homedir(), ".polymarket-tui", "xmtp", XMTP_ENV);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getWalletDir(walletAddress: string): string {
  const dir = join(getXmtpRootDir(), walletAddress.toLowerCase());
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getMetaPath(walletAddress: string): string {
  return join(getWalletDir(walletAddress), "meta.json");
}

function getDbPath(walletAddress: string): string {
  return join(getWalletDir(walletAddress), "client.db3");
}

function loadSessionMeta(walletAddress: string): XmtpSessionMeta | null {
  const metaPath = getMetaPath(walletAddress);
  if (!existsSync(metaPath)) return null;

  try {
    return JSON.parse(readFileSync(metaPath, "utf-8")) as XmtpSessionMeta;
  } catch {
    return null;
  }
}

function saveSessionMeta(meta: XmtpSessionMeta): void {
  writeFileSync(getMetaPath(meta.walletAddress), JSON.stringify(meta, null, 2));
}

function loadOrCreateDbKey(walletAddress: string): Uint8Array {
  const meta = loadSessionMeta(walletAddress);
  const existing = meta?.dbEncryptionKey?.replace(/^0x/, "") ?? "";
  if (/^[0-9a-fA-F]{64}$/.test(existing)) {
    return new Uint8Array(Buffer.from(existing, "hex"));
  }

  const dbKey = getRandomValues(new Uint8Array(32));
  const now = new Date().toISOString();
  saveSessionMeta({
    walletAddress: walletAddress.toLowerCase(),
    env: XMTP_ENV,
    dbEncryptionKey: `0x${Buffer.from(dbKey).toString("hex")}`,
    dbPath: getDbPath(walletAddress),
    createdAt: meta?.createdAt ?? now,
    updatedAt: now,
    inboxId: meta?.inboxId,
    ownerAddress: meta?.ownerAddress,
  });
  return dbKey;
}

function buildIdentifier(walletAddress: string): Identifier {
  return {
    identifier: walletAddress.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  };
}

function signatureToBytes(signature: string): Uint8Array {
  const hex = signature.replace(/^0x/, "");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function createSigner(privateKey: string): {
  type: "EOA";
  getIdentifier: () => Identifier;
  signMessage: (message: string) => Promise<Uint8Array>;
  address: string;
  ownerAddress: string;
} {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return {
    type: "EOA",
    getIdentifier: () => buildIdentifier(account.address),
    signMessage: async (message: string) => signatureToBytes(await account.signMessage({ message })),
    address: account.address.toLowerCase(),
    ownerAddress: account.address,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }) as Promise<T>;
}

function serializeConversation(conversation: Dm | Group): XmtpConversationRecord {
  const isDmConversation = conversation instanceof Dm;
  const isGroupConversation = conversation instanceof Group;
  return {
    id: conversation.id,
    peerAddress: isDmConversation ? (conversation.peerInboxId || "") : conversation.id,
    peerInboxId: isDmConversation ? conversation.peerInboxId : undefined,
    name: isGroupConversation ? conversation.name : undefined,
    createdAt: conversation.createdAt instanceof Date
      ? conversation.createdAt
      : new Date(conversation.createdAt),
  };
}

function serializeMessage(message: unknown): XmtpMessageRecord {
  const typed = message as {
    id: string;
    conversationId: string;
    senderInboxId: string;
    content?: string;
    sentAt: Date | string | number;
  };
  return {
    id: typed.id,
    conversationId: typed.conversationId,
    senderAddress: typed.senderInboxId,
    content: typeof typed.content === "string" ? typed.content : "",
    timestamp: typed.sentAt instanceof Date ? typed.sentAt : new Date(typed.sentAt),
    status: "sent",
  };
}

async function stopActiveMessageStream(): Promise<void> {
  if (!activeMessageStream?.return) {
    activeMessageStream = null;
    return;
  }

  try {
    await activeMessageStream.return();
  } catch {
    // ignore cleanup failures
  }
  activeMessageStream = null;
}

async function ensureMessageStream(): Promise<void> {
  if (activeMessageStream || !xmtpClient) return;

  const stream = await xmtpClient.conversations.streamAllMessages({
    consentStates: [ConsentState.Allowed],
    retryAttempts: 10,
    retryDelay: 20_000,
  });

  activeMessageStream = stream as CloseableAsyncStream<unknown>;

  (async () => {
    try {
      for await (const message of stream as AsyncIterable<unknown>) {
        const typedMessage = message as Parameters<typeof isText>[0];
        if (!isText(typedMessage) || !typedMessage.content) continue;
        const next = {
          ...serializeMessage(typedMessage),
          status: "delivered" as const,
        };
        for (const listener of streamListeners) {
          listener.onMessage(next);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      for (const listener of streamListeners) {
        listener.onError?.(err);
      }
    } finally {
      if (activeMessageStream === stream) {
        activeMessageStream = null;
      }
    }
  })();
}

async function requireClient(): Promise<Client> {
  if (!xmtpClient) {
    throw new Error("XMTP client is not initialized.");
  }
  return xmtpClient;
}

export function onXmtpStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(lastStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export async function initXmtpClient(privateKey: string): Promise<XmtpClientHandle> {
  const signer = createSigner(privateKey);
  const walletAddress = signer.address;
  const existingMeta = loadSessionMeta(walletAddress);
  const dbKey = loadOrCreateDbKey(walletAddress);
  const dbPath = getDbPath(walletAddress);
  const mode: XmtpClientHandle["mode"] = existingMeta && existsSync(dbPath) ? "resume" : "create";

  emitStatus(mode === "resume" ? "Opening existing XMTP session..." : "Registering XMTP session...");

  const client = await withTimeout(
    Client.create(signer, {
      env: XMTP_ENV,
      appVersion: XMTP_APP_VERSION,
      dbEncryptionKey: dbKey,
      dbPath,
    }),
    XMTP_INIT_TIMEOUT_MS,
    "XMTP init",
  );

  xmtpClient = client;
  activeHandle = {
    address: walletAddress,
    ownerAddress: signer.ownerAddress,
    signerType: "EOA",
    env: XMTP_ENV,
    mode,
    inboxId: client.inboxId,
  };

  const now = new Date().toISOString();
  saveSessionMeta({
    walletAddress,
    env: XMTP_ENV,
    dbEncryptionKey: `0x${Buffer.from(dbKey).toString("hex")}`,
    dbPath,
    inboxId: client.inboxId,
    ownerAddress: signer.ownerAddress,
    createdAt: existingMeta?.createdAt ?? now,
    updatedAt: now,
  });

  emitStatus("XMTP ready");
  return activeHandle;
}

export async function listConversations(_client: XmtpClientHandle): Promise<XmtpConversationRecord[]> {
  const client = await requireClient();
  emitStatus("Loading XMTP conversations...");
  try {
    await withTimeout(client.conversations.syncAll([ConsentState.Allowed]), XMTP_REQUEST_TIMEOUT_MS, "XMTP sync");
  } catch {
    // list from local state even if sync is slow or unavailable
  }
  const conversations = await withTimeout(
    client.conversations.list({ consentStates: [ConsentState.Allowed] }),
    XMTP_REQUEST_TIMEOUT_MS,
    "XMTP list conversations",
  );
  emitStatus("XMTP ready");
  return conversations.map(serializeConversation);
}

export async function loadConversationMessages(
  _client: XmtpClientHandle,
  conversationId: string,
): Promise<XmtpMessageRecord[]> {
  const client = await requireClient();
  const conversations = await withTimeout(
    client.conversations.list({ consentStates: [ConsentState.Allowed] }),
    XMTP_REQUEST_TIMEOUT_MS,
    "XMTP resolve conversation",
  );
  const conversation = conversations.find(
    (candidate) => candidate.id === conversationId || candidate.id.includes(conversationId),
  );
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const messages = await withTimeout(conversation.messages(), XMTP_REQUEST_TIMEOUT_MS, "XMTP load messages");
  return messages.map((message) => serializeMessage(message));
}

export async function sendMessage(
  _client: XmtpClientHandle,
  conversationId: string,
  content: string,
): Promise<void> {
  const client = await requireClient();
  const conversations = await withTimeout(
    client.conversations.list({ consentStates: [ConsentState.Allowed] }),
    XMTP_REQUEST_TIMEOUT_MS,
    "XMTP resolve send conversation",
  );
  const conversation = conversations.find((candidate) => candidate.id === conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  await withTimeout(conversation.sendText(content), XMTP_REQUEST_TIMEOUT_MS, "XMTP send message");
}

export async function createConversation(
  _client: XmtpClientHandle,
  peerAddress: string,
): Promise<string> {
  const client = await requireClient();
  const normalizedPeerAddress = peerAddress.trim().toLowerCase();
  if (!normalizedPeerAddress) {
    throw new Error("Missing peer address.");
  }

  const canMessage = await withTimeout(
    client.canMessage([buildIdentifier(normalizedPeerAddress)]),
    XMTP_REQUEST_TIMEOUT_MS,
    "XMTP canMessage",
  );
  const reachable = Array.from(canMessage.values())[0] ?? false;
  if (!reachable) {
    throw new Error("Target address is not registered on XMTP production.");
  }

  const conversation = await withTimeout(
    client.conversations.createDmWithIdentifier(buildIdentifier(normalizedPeerAddress)),
    XMTP_REQUEST_TIMEOUT_MS,
    "XMTP create conversation",
  );
  return conversation.id;
}

export async function streamAllMessages(
  _client: XmtpClientHandle,
  onMessage: (message: XmtpMessageRecord) => void,
  onError?: (error: Error) => void,
): Promise<() => void> {
  streamListeners.add({ onMessage, onError });
  await ensureMessageStream();

  return async () => {
    for (const listener of Array.from(streamListeners)) {
      if (listener.onMessage === onMessage && listener.onError === onError) {
        streamListeners.delete(listener);
      }
    }

    if (streamListeners.size === 0) {
      await stopActiveMessageStream();
    }
  };
}

export function getXmtpClient(): XmtpClientHandle | null {
  return activeHandle;
}

export async function disconnectXmtp(): Promise<void> {
  await stopActiveMessageStream();
  xmtpClient = null;
  activeHandle = null;
  emitStatus(null);
}
