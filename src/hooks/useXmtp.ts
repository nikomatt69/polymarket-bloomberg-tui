import {
  walletState,
  xmtpConnected,
  setXmtpConnected,
  xmtpConnecting,
  setXmtpConnecting,
  xmtpStatus,
  setXmtpStatus,
  xmtpConversations,
  setXmtpConversations,
  xmtpCurrentConversationId,
  setXmtpCurrentConversationId,
  xmtpMessages,
  setXmtpMessages,
  xmtpInputValue,
  setXmtpInputValue,
  xmtpInputFocused,
  setXmtpInputFocused,
  xmtpError,
  setXmtpError,
  xmtpInputHistory,
  setXmtpInputHistory,
  xmtpInputHistoryIdx,
  setXmtpInputHistoryIdx,
  xmtpNewConversationInput,
  setXmtpNewConversationInput,
  xmtpShowNewConversation,
  setXmtpShowNewConversation,
} from "../state";
import {
  initXmtpClient,
  listConversations,
  loadConversationMessages,
  sendMessage as xmtpSendMessage,
  createConversation,
  streamAllMessages,
  disconnectXmtp,
  onXmtpStatus,
  getXmtpClient,
} from "../api/xmtp";
import { loadWalletConfig } from "../auth/wallet";
import type { XmtpConversation, XmtpMessage } from "../state";

let messageStreamCleanup: (() => void) | null = null;
let statusBridgeInitialized = false;

function ensureStatusBridge(): void {
  if (statusBridgeInitialized) return;
  onXmtpStatus((status) => {
    setXmtpStatus(status);
  });
  statusBridgeInitialized = true;
}

export function useXmtp() {
  ensureStatusBridge();

  const conversations = xmtpConversations;
  const setConversations = setXmtpConversations;
  const messages = xmtpMessages;
  const setMessages = setXmtpMessages;
  const currentConversationId = xmtpCurrentConversationId;
  const setCurrentConversationId = setXmtpCurrentConversationId;
  const connected = xmtpConnected;
  const setConnected = setXmtpConnected;
  const connecting = xmtpConnecting;
  const setConnecting = setXmtpConnecting;
  const status = xmtpStatus;
  const setStatus = setXmtpStatus;
  const error = xmtpError;
  const setError = setXmtpError;
  const inputValue = xmtpInputValue;
  const setInputValue = setXmtpInputValue;
  const inputFocused = xmtpInputFocused;
  const setInputFocused = setXmtpInputFocused;
  const inputHistory = xmtpInputHistory;
  const setInputHistory = setXmtpInputHistory;
  const inputHistoryIdx = xmtpInputHistoryIdx;
  const setInputHistoryIdx = setXmtpInputHistoryIdx;
  const showNewConversation = xmtpShowNewConversation;
  const setShowNewConversation = setXmtpShowNewConversation;
  const newConversationInput = xmtpNewConversationInput;
  const setNewConversationInput = setXmtpNewConversationInput;

  const getPrivateKey = (): string | null => {
    const config = loadWalletConfig();
    return config?.privateKey || null;
  };

  const getAddress = (): string | null => {
    return walletState.address;
  };

  const getOwnInboxId = (): string | null => {
    return getXmtpClient()?.inboxId?.toLowerCase() ?? null;
  };

  const isOwnMessage = (senderId: string | null | undefined): boolean => {
    const normalizedSender = senderId?.toLowerCase?.() ?? "";
    if (!normalizedSender) return false;
    return normalizedSender === (getOwnInboxId() ?? "") || normalizedSender === (getAddress()?.toLowerCase() ?? "");
  };

  const connect = async () => {
    if (xmtpConnecting() || xmtpConnected()) return;

    const config = loadWalletConfig();
    const privateKey = config?.privateKey ?? null;
    if (!privateKey) {
      setError("No Polymarket wallet connected");
      return;
    }

    setConnecting(true);
    setError(null);
    setStatus("Preparing XMTP session...");

    try {
      await initXmtpClient(privateKey);

      // Start streaming messages
      const client = await import("../api/xmtp").then((m) => m.getXmtpClient());
      if (client) {
        messageStreamCleanup = await streamAllMessages(
          client,
          (msg) => {
            const ownMessage = isOwnMessage(msg.senderAddress);

            // Add incoming message to appropriate conversation
            if (msg.conversationId === xmtpCurrentConversationId()) {
              setMessages((prev) => {
                if (prev.some((existing) => existing.id === msg.id)) {
                  return prev.map((existing) =>
                    existing.id === msg.id
                      ? { ...existing, status: "delivered" as const, timestamp: msg.timestamp }
                      : existing,
                  );
                }

                if (ownMessage) {
                  for (let index = prev.length - 1; index >= 0; index -= 1) {
                    const existing = prev[index];
                    const sameContent = existing.content.trim() === msg.content.trim();
                    const recent = Math.abs(existing.timestamp.getTime() - msg.timestamp.getTime()) < 120000;
                    const pendingState = existing.status === "sending" || existing.status === "sent";
                    if (pendingState && sameContent && isOwnMessage(existing.senderAddress) && recent) {
                      return prev.map((candidate, candidateIndex) =>
                        candidateIndex === index
                          ? {
                              ...candidate,
                              id: msg.id,
                              senderAddress: msg.senderAddress,
                              timestamp: msg.timestamp,
                              status: "delivered" as const,
                            }
                          : candidate,
                      );
                    }
                  }
                }

                return [
                  ...prev,
                  {
                    id: msg.id,
                    conversationId: msg.conversationId,
                    senderAddress: msg.senderAddress,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    status: "delivered" as const,
                  },
                ];
              });
            }

            // Update conversation's last message
            setConversations((prev) =>
              prev.map((c) =>
                c.id === msg.conversationId
                  ? {
                    ...c,
                    lastMessage: {
                      content: msg.content,
                      timestamp: msg.timestamp,
                      isFromMe: ownMessage,
                    },
                  }
                  : c
              )
            );
          },
          (err) => {
            console.error("XMTP stream error:", err);
            setError(err.message);
          }
        );
      }

      setConnected(true);
      await refreshConversations();
    } catch (err) {
      console.error("XMTP connect error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setStatus(null);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (messageStreamCleanup) {
      messageStreamCleanup();
      messageStreamCleanup = null;
    }
    await disconnectXmtp();
    setConnected(false);
    setStatus(null);
    setConversations([]);
    setMessages([]);
    setCurrentConversationId(null);
  };

  const refreshConversations = async () => {
    try {
      const client = await import("../api/xmtp").then((m) => m.getXmtpClient());
      if (!client) return;

      const convos = await listConversations(client);
      const mapped: XmtpConversation[] = convos.map((c) => ({
        id: c.id,
        peerAddress: c.peerAddress,
        peerInboxId: c.peerInboxId,
        name: c.name,
        createdAt: c.createdAt,
        unreadCount: 0,
      }));

      // Sort by last message time
      mapped.sort((a, b) => {
        const aTime = a.lastMessage?.timestamp?.getTime() || 0;
        const bTime = b.lastMessage?.timestamp?.getTime() || 0;
        return bTime - aTime;
      });

      setConversations(mapped);
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    }
  };

  const selectConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setMessages([]);
    setInputValue("");

    try {
      const client = await import("../api/xmtp").then((m) => m.getXmtpClient());
      if (!client) return;

      const msgs = await loadConversationMessages(client, conversationId);
      const mapped: XmtpMessage[] = msgs.map((m) => ({
        id: m.id,
        conversationId: conversationId,
        senderAddress: m.senderAddress,
        content: m.content || "",
        timestamp: m.timestamp,
        status: m.status,
      }));

      // Mark as read
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );

      setMessages(mapped);
    } catch (err) {
      console.error("Failed to load messages:", err);
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  };

  const sendMessage = async (content: string) => {
    const conversationId = currentConversationId();
    if (!conversationId || !content.trim()) return;

    const address = getAddress();
    const ownInboxId = getOwnInboxId();

    // Add optimistic message
    const tempId = `temp-${Date.now()}`;
    const newMsg: XmtpMessage = {
      id: tempId,
      conversationId,
      senderAddress: ownInboxId || address || "",
      content: content.trim(),
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, newMsg]);

    // Add to history
    setInputHistory((prev) => [content, ...prev.slice(0, 49)]);
    setInputHistoryIdx(-1);
    setInputValue("");

    try {
      const client = await import("../api/xmtp").then((m) => m.getXmtpClient());
      if (!client) throw new Error("Client not connected");

      await xmtpSendMessage(client, conversationId, content.trim());

      // Update message status
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "sent" as const } : m))
      );

      // Update conversation last message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
              ...c,
              lastMessage: {
                content: content.trim(),
                timestamp: new Date(),
                isFromMe: true,
              },
            }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      // Mark as failed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed" as const } : m))
      );
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const startNewConversation = async (peerAddress: string) => {
    if (!connected()) {
      setError("No wallet connected");
      return;
    }

    try {
      const client = await import("../api/xmtp").then((m) => m.getXmtpClient());
      if (!client) throw new Error("Client not connected");

      const conversationId = await createConversation(client, peerAddress);
      await refreshConversations();
      await selectConversation(conversationId);
      setShowNewConversation(false);
      setNewConversationInput("");
    } catch (err) {
      console.error("Failed to create conversation:", err);
      setError(err instanceof Error ? err.message : "Failed to create conversation");
    }
  };

  const navigateHistoryUp = () => {
    const history = inputHistory();
    if (history.length === 0) return;

    const currentIdx = inputHistoryIdx();
    const newIdx = currentIdx < history.length - 1 ? currentIdx + 1 : currentIdx;
    setInputHistoryIdx(newIdx);
    setInputValue(history[newIdx] || "");
  };

  const navigateHistoryDown = () => {
    const history = inputHistory();
    if (history.length === 0) return;

    const currentIdx = inputHistoryIdx();
    const newIdx = currentIdx > 0 ? currentIdx - 1 : -1;
    setInputHistoryIdx(newIdx);
    setInputValue(newIdx >= 0 ? history[newIdx] : "");
  };

  return {
    // State
    conversations: xmtpConversations,
    messages: xmtpMessages,
    currentConversationId: xmtpCurrentConversationId,
    connected: xmtpConnected,
    connecting: xmtpConnecting,
    status: xmtpStatus,
    error: xmtpError,
    inputValue: xmtpInputValue,
    setInputValue,
    inputFocused: xmtpInputFocused,
    setInputFocused,
    inputHistory: xmtpInputHistory,
    showNewConversation: xmtpShowNewConversation,
    setShowNewConversation,
    newConversationInput: xmtpNewConversationInput,
    setNewConversationInput,

    // Actions
    connect,
    disconnect,
    refreshConversations,
    selectConversation,
    sendMessage,
    startNewConversation,
    navigateHistoryUp,
      navigateHistoryDown,

      // Helpers
      getAddress,
      getOwnInboxId,
      isOwnMessage,
    };
}
