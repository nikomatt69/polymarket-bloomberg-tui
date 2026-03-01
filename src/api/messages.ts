/**
 * Messaging API - handles direct messages and global chat
 */

import {
  DirectMessage,
  GlobalMessage,
  Conversation,
  messages,
  setMessages,
  setMessagesLoading,
  globalChatMessages,
  setGlobalChatMessages,
  conversations,
  setConversations,
  setUnreadMessagesCount,
  setUnreadGlobalCount,
  walletState,
  unreadMessagesCount,
  unreadGlobalCount,
} from "../state";
import { join } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";

const GLOBAL_CHAT_STORAGE_KEY = "globalChat";
const DIRECT_MESSAGES_STORAGE_KEY = "directMessages";

function getMessagesStoragePath(key: string): string {
  const configDir = join(homedir(), ".polymarket-tui");
  try {
    mkdirSync(configDir, { recursive: true });
  } catch {
    // Directory might already exist
  }
  return join(configDir, `${key}.json`);
}

interface StoredDirectMessages {
  messages: Array<{
    id: string;
    senderId: string;
    senderName?: string;
    recipientId: string;
    recipientName?: string;
    content: string;
    timestamp: string;
    read: boolean;
  }>;
}

interface StoredGlobalMessages {
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: string;
  }>;
}

function loadStoredDirectMessages(): DirectMessage[] {
  try {
    const path = getMessagesStoragePath(DIRECT_MESSAGES_STORAGE_KEY);
    const data = readFileSync(path, "utf-8");
    const parsed: StoredDirectMessages = JSON.parse(data);
    return parsed.messages.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveStoredDirectMessages(msgs: DirectMessage[]): void {
  try {
    const path = getMessagesStoragePath(DIRECT_MESSAGES_STORAGE_KEY);
    const data: StoredDirectMessages = {
      messages: msgs.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
    };
    writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error("Failed to save direct messages:", error);
  }
}

function loadStoredGlobalMessages(): GlobalMessage[] {
  try {
    const path = getMessagesStoragePath(GLOBAL_CHAT_STORAGE_KEY);
    const data = readFileSync(path, "utf-8");
    const parsed: StoredGlobalMessages = JSON.parse(data);
    return parsed.messages.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveStoredGlobalMessages(msgs: GlobalMessage[]): void {
  try {
    const path = getMessagesStoragePath(GLOBAL_CHAT_STORAGE_KEY);
    const data: StoredGlobalMessages = {
      messages: msgs.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
    };
    writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error("Failed to save global messages:", error);
  }
}

export function initializeMessages(): void {
  const directMsgs = loadStoredDirectMessages();
  setMessages(directMsgs);
  updateUnreadCount(directMsgs);

  const globalMsgs = loadStoredGlobalMessages();
  setGlobalChatMessages(globalMsgs);
}

function updateUnreadCount(msgs: DirectMessage[]): void {
  const currentUserId = walletState.address?.toLowerCase() || "";
  const unread = msgs.filter(
    (m) => m.recipientId.toLowerCase() === currentUserId && !m.read
  ).length;
  setUnreadMessagesCount(unread);
}

export function loadDirectMessages(): void {
  setMessagesLoading(true);
  const stored = loadStoredDirectMessages();
  setMessages(stored);
  updateUnreadCount(stored);
  buildConversations(stored);
  setMessagesLoading(false);
}

export function sendDirectMessage(
  recipientId: string,
  recipientName: string,
  content: string
): DirectMessage {
  const senderId = walletState.address || "";
  const senderName = walletState.username || shortAddress(senderId);

  const newMessage: DirectMessage = {
    id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    senderId,
    senderName,
    recipientId,
    recipientName,
    content,
    timestamp: new Date(),
    read: false,
  };

  const updated = [...messages(), newMessage];
  setMessages(updated);
  saveStoredDirectMessages(updated);
  buildConversations(updated);

  return newMessage;
}

export function markMessageAsRead(messageId: string): void {
  const updated = messages().map((m) =>
    m.id === messageId ? { ...m, read: true } : m
  );
  setMessages(updated);
  saveStoredDirectMessages(updated);
  updateUnreadCount(updated);
}

export function markConversationAsRead(participantId: string): void {
  const currentUserId = walletState.address?.toLowerCase() || "";
  const updated = messages().map((m) =>
    m.senderId.toLowerCase() === participantId.toLowerCase() &&
    m.recipientId.toLowerCase() === currentUserId
      ? { ...m, read: true }
      : m
  );
  setMessages(updated);
  saveStoredDirectMessages(updated);
  updateUnreadCount(updated);
  buildConversations(updated);
}

function buildConversations(msgs: DirectMessage[]): void {
  const currentUserId = walletState.address?.toLowerCase() || "";
  const convMap = new Map<string, Conversation>();

  for (const msg of msgs) {
    const otherId =
      msg.senderId.toLowerCase() === currentUserId
        ? msg.recipientId.toLowerCase()
        : msg.senderId.toLowerCase();
    const otherName =
      msg.senderId.toLowerCase() === currentUserId
        ? msg.recipientName || shortAddress(msg.recipientId)
        : msg.senderName || shortAddress(msg.senderId);

    const existing = convMap.get(otherId);
    const msgTime = new Date(msg.timestamp).getTime();

    if (!existing || msgTime > new Date(existing.lastMessageTime).getTime()) {
      const unreadCount = msgs.filter(
        (m) =>
          m.senderId.toLowerCase() === otherId &&
          m.recipientId.toLowerCase() === currentUserId &&
          !m.read
      ).length;

      convMap.set(otherId, {
        participantId: otherId,
        participantName: otherName,
        lastMessage: msg.content.slice(0, 50) + (msg.content.length > 50 ? "..." : ""),
        lastMessageTime: msg.timestamp,
        unreadCount,
      });
    }
  }

  const sorted = Array.from(convMap.values()).sort(
    (a, b) =>
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );
  setConversations(sorted);
}

export function loadGlobalMessages(): void {
  const stored = loadStoredGlobalMessages();
  setGlobalChatMessages(stored);
}

export function sendGlobalMessage(content: string): GlobalMessage {
  const senderId = walletState.address || "";
  const senderName = walletState.username || shortAddress(senderId);

  const newMessage: GlobalMessage = {
    id: `gm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    senderId,
    senderName,
    content,
    timestamp: new Date(),
  };

  const updated = [...globalChatMessages(), newMessage];
  setGlobalChatMessages(updated);
  saveStoredGlobalMessages(updated);

  return newMessage;
}

export function clearGlobalChat(): void {
  setGlobalChatMessages([]);
  saveStoredGlobalMessages([]);
}

function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getDirectMessagesWithUser(participantId: string): DirectMessage[] {
  const currentUserId = walletState.address?.toLowerCase() || "";
  return messages()
    .filter(
      (m) =>
        (m.senderId.toLowerCase() === currentUserId &&
          m.recipientId.toLowerCase() === participantId.toLowerCase()) ||
        (m.recipientId.toLowerCase() === currentUserId &&
          m.senderId.toLowerCase() === participantId.toLowerCase())
    )
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

export function getTotalUnreadCount(): number {
  return unreadMessagesCount() + unreadGlobalCount();
}

export function markGlobalAsRead(): void {
  setUnreadGlobalCount(0);
}
