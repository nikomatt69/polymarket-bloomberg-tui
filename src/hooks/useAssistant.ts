/**
 * Assistant hook — manages AI chat state, streaming, sessions, and slash commands.
 * All signals are module-level (from state.ts) so this hook is safe to call
 * multiple times (e.g. inside keyboard handlers) without creating duplicate state.
 */

import {
  assistantMode,
  type AssistantMode,
  chatMessages,
  setChatMessages,
  chatLoading,
  setChatLoading,
  chatInputValue,
  setChatInputValue,
  chatInputFocused,
  setChatInputFocused,
  getTradingBalance,
  ChatMessage,
  streamingMessage,
  setStreamingMessage,
  streamingTools,
  setStreamingTools,
  inputHistory,
  setInputHistory,
  inputHistoryIdx,
  setInputHistoryIdx,
  currentSessionId,
  setCurrentSessionId,
  sessionTokens,
  setSessionTokens,
  getActiveAIProvider,
  pendingApproval,
  clearPendingApproval,
  setPendingApproval,
  setAssistantMode,
  setEnterpriseRunPhase,
  setEnterpriseToolSelectedId,
  clearEnterpriseToolUiState,
} from "../state";
import { sendMessageToAssistantStream } from "../api/assistant";
import {
  initSession,
  listSessions,
  saveSession,
  loadSession,
  SessionRecord,
} from "../api/sessions";
import { executeApprovedAssistantAction, getPendingApprovalIfLive } from "../agent/reasoning";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// ─── Session management ───────────────────────────────────────────────────────

let sessionInitialized = false;

function ensureSession(): void {
  if (sessionInitialized) return;
  sessionInitialized = true;

  try {
    const sessions = listSessions();
    const latest = sessions[0];
    if (latest && Date.now() - latest.updatedAt < 3_600_000) {
      // Restore last session if < 1 hour old
      setChatMessages(
        latest.messages.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp instanceof Date ? m.timestamp : (m.timestamp as unknown as string)),
        })),
      );
      setCurrentSessionId(latest.id);
      setSessionTokens(latest.metadata.tokensUsed);
      if (latest.metadata.assistantMode) {
        setAssistantMode(latest.metadata.assistantMode);
      }
      if (latest.metadata.pendingApproval && latest.metadata.pendingApproval.expiresAt > Date.now()) {
        setPendingApproval(latest.metadata.pendingApproval);
      } else {
        clearPendingApproval();
      }
    } else {
      const newSession = initSession();
      setCurrentSessionId(newSession.id);
    }
  } catch {
    // ignore persistence errors
    const newSession = initSession();
    setCurrentSessionId(newSession.id);
  }
}

function doSaveSession(): void {
  const id = currentSessionId();
  if (!id) return;
  const messages = chatMessages();
  const provider = getActiveAIProvider();
  const record: SessionRecord = {
    id,
    createdAt: parseInt(id.replace("sess-", ""), 36) || Date.now(),
    updatedAt: Date.now(),
    messages,
    metadata: {
      provider: provider?.name ?? "",
      model: provider?.model ?? "",
      tokensUsed: sessionTokens(),
      assistantMode: assistantMode(),
      pendingApproval: pendingApproval(),
    },
  };
  saveSession(record);
}

// ─── Slash command handler ────────────────────────────────────────────────────

function handleSlashCommand(cmd: string, args: string): boolean {
  switch (cmd) {
    case "/clear": {
      setChatMessages([]);
      const newSession = initSession();
      setCurrentSessionId(newSession.id);
      setSessionTokens(0);
      setStreamingMessage("");
      setStreamingTools([]);
      clearPendingApproval();
      setEnterpriseRunPhase("idle");
      clearEnterpriseToolUiState();
      setChatMessages([
        {
          id: generateId(),
          role: "assistant",
          content: "Session cleared. Starting fresh.",
          timestamp: new Date(),
        },
      ]);
      return true;
    }

    case "/help": {
      const helpContent = [
        "Available commands:",
        "  /clear         — Clear chat and start a new session",
        "  /help          — Show this help",
        "  /model         — Show current AI model/provider",
        "  /mode          — Show or change assistant mode",
        "  /approve       — Approve pending assistant action",
        "  /reject        — Reject pending assistant action",
        "  /sessions      — List recent sessions",
        "  /session <id>  — Load a previous session by ID",
        "  /save          — Force-save current session",
        "  /context       — Show injected context (market, wallet)",
      ].join("\n");
      setChatMessages([
        ...chatMessages(),
        { id: generateId(), role: "assistant", content: helpContent, timestamp: new Date() },
      ]);
      return true;
    }

    case "/model": {
      const provider = getActiveAIProvider();
      setChatMessages([
        ...chatMessages(),
        {
          id: generateId(),
          role: "assistant",
          content: `Current model: ${provider?.model ?? "unknown"}\nProvider: ${provider?.name ?? "none configured"}`,
          timestamp: new Date(),
        },
      ]);
      return true;
    }

    case "/mode": {
      const nextMode = args.trim().toLowerCase();
      if (!nextMode) {
        setChatMessages([
          ...chatMessages(),
          {
            id: generateId(),
            role: "assistant",
            content: `Current assistant mode: ${assistantMode()}`,
            timestamp: new Date(),
          },
        ]);
        return true;
      }

      if (!["scout", "analyst", "trader", "operator", "safe"].includes(nextMode)) {
        setChatMessages([
          ...chatMessages(),
          {
            id: generateId(),
            role: "assistant",
            content: "Usage: /mode <scout|analyst|trader|operator|safe>",
            timestamp: new Date(),
          },
        ]);
        return true;
      }

      setAssistantMode(nextMode as AssistantMode);
      setChatMessages([
        ...chatMessages(),
        {
          id: generateId(),
          role: "assistant",
          content: `Assistant mode set to ${nextMode}.`,
          timestamp: new Date(),
        },
      ]);
      return true;
    }

    case "/sessions": {
      const sessions = listSessions();
      const content =
        sessions.length === 0
          ? "No saved sessions found."
          : [
              "Recent sessions:",
              ...sessions.slice(0, 10).map(
                (s, i) =>
                  `  ${i + 1}. ${s.id}  (${new Date(s.updatedAt).toLocaleString()})  ${s.messages.length} msgs  ${s.metadata.tokensUsed}tok`,
              ),
            ].join("\n");
      setChatMessages([
        ...chatMessages(),
        { id: generateId(), role: "assistant", content, timestamp: new Date() },
      ]);
      return true;
    }

    case "/session": {
      if (!args) {
        setChatMessages([
          ...chatMessages(),
          {
            id: generateId(),
            role: "assistant",
            content: "Usage: /session <id>",
            timestamp: new Date(),
          },
        ]);
        return true;
      }
      const record = loadSession(args.trim());
      if (!record) {
        setChatMessages([
          ...chatMessages(),
          {
            id: generateId(),
            role: "assistant",
            content: `Session not found: ${args.trim()}`,
            timestamp: new Date(),
          },
        ]);
        return true;
      }
      setChatMessages(
        record.messages.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp instanceof Date ? m.timestamp : (m.timestamp as unknown as string)),
        })),
      );
      setCurrentSessionId(record.id);
      setSessionTokens(record.metadata.tokensUsed);
      if (record.metadata.assistantMode) {
        setAssistantMode(record.metadata.assistantMode);
      }
      if (record.metadata.pendingApproval && record.metadata.pendingApproval.expiresAt > Date.now()) {
        setPendingApproval(record.metadata.pendingApproval);
      } else {
        clearPendingApproval();
      }
      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: `Loaded session: ${record.id} (${record.messages.length} messages)`,
          timestamp: new Date(),
        },
      ]);
      return true;
    }

    case "/save": {
      doSaveSession();
      setChatMessages([
        ...chatMessages(),
        {
          id: generateId(),
          role: "assistant",
          content: `Session saved: ${currentSessionId()}`,
          timestamp: new Date(),
        },
      ]);
      return true;
    }

    case "/context": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { appState, walletState, getSelectedMarket } = require("../state") as typeof import("../state");
      const market = getSelectedMarket();
      const content = [
        "Current context injected into AI:",
        `  Market: ${market?.title ?? "none"}`,
        `  Price: ${market?.outcomes[0]?.price.toFixed(2) ?? "N/A"}`,
        `  Change 24h: ${market?.change24h?.toFixed(2) ?? "N/A"}%`,
        `  Wallet: ${walletState.connected ? (walletState.address ?? "connected") : "not connected"}`,
        `  Balance: $${getTradingBalance().toFixed(2)}`,
        `  Markets loaded: ${appState.markets.length}`,
      ].join("\n");
      setChatMessages([
        ...chatMessages(),
        { id: generateId(), role: "assistant", content, timestamp: new Date() },
      ]);
      return true;
    }

    default: {
      setChatMessages([
        ...chatMessages(),
        {
          id: generateId(),
          role: "assistant",
          content: `Unknown command: ${cmd}. Type /help for available commands.`,
          timestamp: new Date(),
        },
      ]);
      return true;
    }
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useAssistant() {
  // Ensure session is initialized on first call
  ensureSession();

  const handleStreamChunk = (chunk: string) => {
    setStreamingMessage((prev) => prev + chunk);
    setEnterpriseRunPhase("streaming_text");
  };

  const handleToolCall = (tool: {
    id: string;
    name: string;
    args: unknown;
    category?: string;
    riskLevel?: "low" | "medium" | "high" | "critical";
    requiresConfirmation?: boolean;
    startedAt: number;
  }) => {
    setStreamingTools((prev) => [
      ...prev,
      {
        id: tool.id,
        name: tool.name,
        args: tool.args,
        category: tool.category,
        riskLevel: tool.riskLevel,
        requiresConfirmation: tool.requiresConfirmation,
        startedAt: tool.startedAt,
        status: "calling",
      },
    ]);
    setEnterpriseRunPhase("tool_calling");
    if (!tool.id) return;
    setEnterpriseToolSelectedId((prev) => prev || tool.id);
  };

  const handleToolResult = (tool: {
    id: string;
    name: string;
    result: unknown;
    completedAt: number;
  }) => {
    const record = typeof tool.result === "object" && tool.result !== null
      ? tool.result as Record<string, unknown>
      : null;

    setStreamingTools((prev) =>
      prev.map((entry) =>
        entry.id === tool.id
          ? { ...entry, status: "done", result: tool.result, completedAt: tool.completedAt }
          : entry,
      ),
    );

    setEnterpriseRunPhase(record?.requiresConfirmation === true ? "awaiting_approval" : "tool_done");
  };

  const handleToolError = (tool: {
    id: string;
    name: string;
    error: string;
    completedAt: number;
  }) => {
    setStreamingTools((prev) =>
      prev.map((entry) =>
        entry.id === tool.id
          ? {
              ...entry,
              status: "error",
              error: tool.error,
              result: { success: false, error: tool.error },
              completedAt: tool.completedAt,
            }
          : entry,
      ),
    );
    setEnterpriseRunPhase("tool_error");
  };

  const approvePendingAction = async (): Promise<boolean> => {
    const approval = getPendingApprovalIfLive();
    if (!approval || chatLoading()) {
      return false;
    }

    setChatLoading(true);
    setStreamingMessage("");
    setStreamingTools([]);
    setEnterpriseRunPhase("tool_calling");
    clearEnterpriseToolUiState();

    try {
      const { response, toolCall } = await executeApprovedAssistantAction(approval, currentSessionId(), {
        onToolCall: handleToolCall,
        onToolResult: handleToolResult,
        onToolError: handleToolError,
      });

      setEnterpriseRunPhase("finalizing");
      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
          ...(toolCall ? { toolCalls: [toolCall] } : {}),
        },
      ]);
      doSaveSession();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Approval execution failed";
      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: `Error: ${errorMsg}`,
          timestamp: new Date(),
        },
      ]);
      return false;
    } finally {
      setChatLoading(false);
      setStreamingMessage("");
      setStreamingTools([]);
      setEnterpriseRunPhase(getPendingApprovalIfLive() ? "awaiting_approval" : "idle");
      clearEnterpriseToolUiState();
    }
  };

  const rejectPendingAction = (): boolean => {
    const approval = getPendingApprovalIfLive();
    if (!approval) {
      return false;
    }

    clearPendingApproval();
    setEnterpriseRunPhase("idle");
    setChatMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: "assistant",
        content: `Action rejected: ${approval.summary}`,
        timestamp: new Date(),
      },
    ]);
    doSaveSession();
    return true;
  };

  const submitPrompt = async () => {
    const input = chatInputValue().trim();
    if (!input || chatLoading()) return;

    // Push to input history (deduplicated, max 50)
    const hist = inputHistory();
    const newHist = [input, ...hist.filter((h) => h !== input)].slice(0, 50);
    setInputHistory(newHist);
    setInputHistoryIdx(-1);

    // Handle slash commands locally
    if (input.startsWith("/")) {
      const spaceIdx = input.indexOf(" ");
      const cmd = spaceIdx === -1 ? input : input.slice(0, spaceIdx);
      const args = spaceIdx === -1 ? "" : input.slice(spaceIdx + 1).trim();
      setChatInputValue("");
      if (cmd === "/approve") {
        await approvePendingAction();
        return;
      }
      if (cmd === "/reject") {
        rejectPendingAction();
        return;
      }
      handleSlashCommand(cmd, args);
      return;
    }

    if (pendingApproval()) {
      clearPendingApproval();
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInputValue("");
    setChatLoading(true);
    setStreamingMessage("");
    setStreamingTools([]);
    setEnterpriseRunPhase("streaming_text");
    clearEnterpriseToolUiState();

    try {
      const { response, toolCalls, tokensUsed } = await sendMessageToAssistantStream(
        handleStreamChunk,
        handleToolCall,
        handleToolResult,
        handleToolError,
      );

      setEnterpriseRunPhase("finalizing");
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
        toolCalls: toolCalls ?? [],
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
      setSessionTokens((t) => t + (tokensUsed ?? 0));

      // Auto-save every 5 messages
      if (chatMessages().length % 5 === 0) {
        doSaveSession();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setEnterpriseRunPhase("tool_error");
      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: `Error: ${errorMsg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
      setStreamingMessage("");
      setStreamingTools([]);
      setEnterpriseRunPhase(getPendingApprovalIfLive() ? "awaiting_approval" : "idle");
      clearEnterpriseToolUiState();
    }
  };

  const navigateHistoryUp = () => {
    const hist = inputHistory();
    if (hist.length === 0) return;
    const newIdx = Math.min(inputHistoryIdx() + 1, hist.length - 1);
    setInputHistoryIdx(newIdx);
    setChatInputValue(hist[newIdx] ?? "");
  };

  const navigateHistoryDown = () => {
    const newIdx = inputHistoryIdx() - 1;
    if (newIdx < 0) {
      setInputHistoryIdx(-1);
      setChatInputValue("");
    } else {
      setInputHistoryIdx(newIdx);
      setChatInputValue(inputHistory()[newIdx] ?? "");
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    const newSession = initSession();
    setCurrentSessionId(newSession.id);
    setSessionTokens(0);
    setStreamingMessage("");
    setStreamingTools([]);
    clearPendingApproval();
    setEnterpriseRunPhase("idle");
    clearEnterpriseToolUiState();
  };

  const setInput = (value: string) => {
    setChatInputValue(value);
  };

  const focusInput = () => {
    setChatInputFocused(true);
  };

  const blurInput = () => {
    setChatInputFocused(false);
  };

  return {
    messages: chatMessages,
    loading: chatLoading,
    input: chatInputValue,
    setInput,
    focused: chatInputFocused,
    focusInput,
    blurInput,
    submitPrompt,
    approvePendingAction,
    rejectPendingAction,
    clearChat,
    navigateHistoryUp,
    navigateHistoryDown,
    saveSession: doSaveSession,
    mode: assistantMode,
    setMode: setAssistantMode,
    pendingApproval,
    streamingMessage,
    streamingTools,
    sessionId: currentSessionId,
    sessionTokens,
  };
}
