/**
 * Agent Session Management - Chat history with tool call tracking
 */

import { createStore } from "solid-js/store";
import type { TUIContext } from "./tool";

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  success?: boolean;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * Message in the chat session
 */
export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolCallResult[];
  timestamp: number;
  reasoning?: string; // For thinking/reasoning display
}

/**
 * Tool result for message
 */
export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  success: boolean;
  error?: string;
}

/**
 * Complete chat session
 */
export interface Session {
  id: string;
  messages: SessionMessage[];
  createdAt: number;
  updatedAt: number;
  tuiContextSnapshots: TUIContext[];
  metadata: {
    model?: string;
    provider?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Store
// ─────────────────────────────────────────────────────────────────────────────

interface SessionStore {
  currentSessionId: string | null;
  sessions: Session[];
  activeSessionIndex: number;
}

const [sessionStore, setSessionStore] = createStore<SessionStore>({
  currentSessionId: null,
  sessions: [],
  activeSessionIndex: -1,
});

// ─────────────────────────────────────────────────────────────────────────────
// ID Generation
// ─────────────────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Operations
// ─────────────────────────────────────────────────────────────────────────────

export namespace AgentSession {
  /**
   * Create a new session
   */
  export function create(metadata?: Session["metadata"]): Session {
    const id = generateId("session");
    const session: Session = {
      id,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tuiContextSnapshots: [],
      metadata: metadata ?? {},
    };

    setSessionStore("sessions", (sessions) => [...sessions, session]);
    setSessionStore("currentSessionId", id);
    setSessionStore("activeSessionIndex", sessionStore.sessions.length - 1);

    return session;
  }

  /**
   * Get current session
   */
  export function getCurrent(): Session | null {
    const idx = sessionStore.activeSessionIndex;
    if (idx < 0 || idx >= sessionStore.sessions.length) return null;
    return sessionStore.sessions[idx] ?? null;
  }

  /**
   * Get session by ID
   */
  export function get(sessionId: string): Session | null {
    return sessionStore.sessions.find((s) => s.id === sessionId) ?? null;
  }

  /**
   * Get or create current session
   */
  export function getOrCreate(): Session {
    const current = getCurrent();
    if (current) return current;
    return create();
  }

  /**
   * Add a message to the current session
   */
  export function addMessage(
    role: SessionMessage["role"],
    content: string,
    options?: {
      toolCalls?: ToolCall[];
      toolResults?: ToolCallResult[];
      reasoning?: string;
    }
  ): SessionMessage {
    const message: SessionMessage = {
      id: generateId("msg"),
      role,
      content,
      timestamp: Date.now(),
      toolCalls: options?.toolCalls,
      toolResults: options?.toolResults,
      reasoning: options?.reasoning,
    };

    const idx = sessionStore.activeSessionIndex;
    if (idx >= 0) {
      setSessionStore("sessions", idx, "messages", (msgs) => [...msgs, message]);
      setSessionStore("sessions", idx, "updatedAt", Date.now());
    }

    return message;
  }

  /**
   * Add user message
   */
  export function addUserMessage(content: string): SessionMessage {
    return addMessage("user", content);
  }

  /**
   * Add assistant message
   */
  export function addAssistantMessage(
    content: string,
    options?: {
      toolCalls?: ToolCall[];
      toolResults?: ToolCallResult[];
      reasoning?: string;
    }
  ): SessionMessage {
    return addMessage("assistant", content, options);
  }

  /**
   * Add tool result
   */
  export function addToolMessage(
    toolCallId: string,
    toolName: string,
    result: unknown,
    success: boolean,
    error?: string
  ): SessionMessage {
    const content = success
      ? `Tool ${toolName} result: ${JSON.stringify(result, null, 2)}`
      : `Tool ${toolName} error: ${error}`;

    return addMessage("tool", content, {
      toolResults: [
        {
          toolCallId,
          toolName,
          result,
          success,
          error,
        },
      ],
    });
  }

  /**
   * Get message history
   */
  export function getHistory(limit?: number): SessionMessage[] {
    const session = getCurrent();
    if (!session) return [];

    const messages = session.messages;
    if (limit && limit > 0) {
      return messages.slice(-limit);
    }
    return messages;
  }

  /**
   * Get all messages for AI (only user and assistant)
   */
  export function getMessagesForAI(): { role: "user" | "assistant"; content: string }[] {
    return getHistory()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));
  }

  /**
   * Save TUI context snapshot
   */
  export function saveTUIContext(context: TUIContext): void {
    const idx = sessionStore.activeSessionIndex;
    if (idx < 0) return;

    setSessionStore("sessions", idx, "tuiContextSnapshots", (snapshots) => [
      ...snapshots,
      { ...context },
    ]);
  }

  /**
   * Get last TUI context snapshot
   */
  export function getLastTUIContext(): TUIContext | null {
    const session = getCurrent();
    if (!session || session.tuiContextSnapshots.length === 0) return null;
    return session.tuiContextSnapshots[session.tuiContextSnapshots.length - 1];
  }

  /**
   * Update message (e.g., with reasoning or tool calls)
   */
  export function updateMessage(
    messageId: string,
    updates: Partial<Pick<SessionMessage, "content" | "toolCalls" | "toolResults" | "reasoning">>
  ): void {
    const idx = sessionStore.activeSessionIndex;
    if (idx < 0) return;

    const msgIndex = sessionStore.sessions[idx].messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    setSessionStore("sessions", idx, "messages", msgIndex, (msg) => ({
      ...msg,
      ...updates,
    }));
  }

  /**
   * Clear current session
   */
  export function clear(): void {
    const idx = sessionStore.activeSessionIndex;
    if (idx < 0) return;

    setSessionStore("sessions", (sessions) => sessions.filter((_, i) => i !== idx));
    setSessionStore("currentSessionId", null);
    setSessionStore("activeSessionIndex", -1);
  }

  /**
   * List all sessions
   */
  export function listAll(): Session[] {
    return [...sessionStore.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get store for reactivity
   */
  export function getStore() {
    return sessionStore;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Call Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function createToolCall(name: string, args: Record<string, unknown>): ToolCall {
  return {
    id: generateId("tool"),
    name,
    arguments: args,
    startedAt: Date.now(),
  };
}

export function completeToolCall(
  toolCall: ToolCall,
  result: unknown,
  success: boolean,
  error?: string
): ToolCall {
  return {
    ...toolCall,
    result,
    success,
    error,
    completedAt: Date.now(),
  };
}
