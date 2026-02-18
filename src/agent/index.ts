/**
 * Agent Module - Nikcli-style architecture for Polymarket TUI
 *
 * Provides:
 * - Tool registry with structured definitions
 * - Session management for chat history
 * - TUI context provider
 * - Reasoning loop implementation
 */

// Core exports
export * from "./tool";
export * from "./context";
export * from "./session";
export * from "./reasoning";
export * from "./tools";

// Re-export commonly used types
export type { ToolDefinition, ToolResult, AgentContext, TUIContext, ToolCategory } from "./tool";
export type { SessionMessage, ToolCall, ToolCallResult } from "./session";
export type { ReasoningState, ReasoningStep } from "./reasoning";

// Main functions
export { getTUIContext, formatTUIContextForPrompt, createAgentContext } from "./context";
export { AgentSession } from "./session";
export { runReasoningLoop, buildSystemPrompt, executeToolWithTracking } from "./reasoning";
export { getTool, getExecutor, executeTool, getToolNames, allTools, executors } from "./tools";
