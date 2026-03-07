/**
 * Assistant runtime - prompt layering, tool wrapping, approvals, and streaming.
 */

import { streamText, tool as createAiTool, zodSchema } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { z } from "zod";
import {
  assistantMode,
  type AssistantApprovalRequest,
  type AssistantMode,
  type ChatMessage,
  clearPendingApproval,
  pendingApproval,
  setAssistantGuardReason,
  setPendingApproval,
  type ToolCall,
  walletState,
  getActiveAIProvider,
} from "../state";
import { getEnabledSkillsSystemPrompt } from "../api/skills";
import { skills } from "../state";
import { createAgentContext, formatTUIContextForPrompt, getTUIContext } from "./context";
import { executeTool, getTool, getToolsForMode, prepareToolApproval } from "./tools";
import type { AgentContext, ToolDefinition } from "./tool";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const APPROVAL_TTL_MS = 60_000;

export type ReasoningStep = "thinking" | "acting" | "observing" | "refining" | "answering";

export interface ReasoningState {
  currentStep: ReasoningStep;
  thought: string;
  toolCalls: ToolCall[];
  observations: string[];
  isComplete: boolean;
}

export type RuntimeToolCallCallback = (tool: {
  id: string;
  name: string;
  args: unknown;
  category?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  requiresConfirmation?: boolean;
  startedAt: number;
}) => void;

export type RuntimeToolResultCallback = (tool: {
  id: string;
  name: string;
  result: unknown;
  completedAt: number;
}) => void;

export interface AssistantRuntimeCallbacks {
  onChunk?: (chunk: string) => void;
  onToolCall?: RuntimeToolCallCallback;
  onToolResult?: RuntimeToolResultCallback;
  onToolError?: (tool: { id: string; name: string; error: string; completedAt: number }) => void;
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildApprovalContextHash(ctx: AgentContext, toolName: string, args: Record<string, unknown>): string {
  return simpleHash(JSON.stringify({
    toolName,
    args,
    selectedMarketId: ctx.tuiContext.selectedMarketId,
    selectedTokenId: ctx.tuiContext.selectedTokenId,
    walletAddress: ctx.tuiContext.walletAddress,
    funderAddress: ctx.tuiContext.funderAddress,
    assistantMode: ctx.tuiContext.assistantMode,
  }));
}

function resolveEffectiveAssistantMode(requestedMode: AssistantMode): { mode: AssistantMode; guardReason: string | null } {
  if (requestedMode === "trader") {
    if (!walletState.connected) {
      return {
        mode: "safe",
        guardReason: "Trader mode downgraded to safe because no wallet is connected.",
      };
    }

    if (!walletState.apiKey || !walletState.apiSecret || !walletState.apiPassphrase) {
      return {
        mode: "safe",
        guardReason: "Trader mode downgraded to safe because Polymarket API credentials are not ready.",
      };
    }
  }

  if (requestedMode === "operator" && !walletState.connected) {
    return {
      mode: "safe",
      guardReason: "Operator mode downgraded to safe because no wallet is connected.",
    };
  }

  return {
    mode: requestedMode,
    guardReason: requestedMode === "safe" ? "Safe mode is active: no market-moving actions are available." : null,
  };
}

function buildToolPolicyBlock(mode: AssistantMode, toolDefs: ToolDefinition<z.ZodType>[]): string {
  const grouped = new Map<string, string[]>();
  for (const toolDef of toolDefs) {
    const bucket = grouped.get(toolDef.category) ?? [];
    const suffixParts: string[] = [];
    if (toolDef.requiresConfirmation) suffixParts.push("approval");
    if (toolDef.requiresWallet) suffixParts.push("wallet");
    if (toolDef.executesTrade) suffixParts.push("trade");
    bucket.push(`${toolDef.name}${suffixParts.length > 0 ? ` [${suffixParts.join(",")}]` : ""}`);
    grouped.set(toolDef.category, bucket);
  }

  const lines = ["## Available Tools"];
  for (const [category, names] of grouped.entries()) {
    lines.push(`- ${category}: ${names.join(", ")}`);
  }

  lines.push("## Execution Rules");
  lines.push("- Never guess a token ID, order ID, or market when data is ambiguous.");
  lines.push("- Before any trade, fetch a fresh live book or order preview.");
  lines.push("- Use preview_order or prepare_order before proposing execution.");
  lines.push("- Any mutating execution tool requires explicit in-app approval and will not execute immediately.");
  lines.push("- Treat last-trade price 0.5 as a no-trade sentinel when liquidity data is absent.");
  lines.push("- MATCHED is not final settlement; user order and trade updates can still change status.");
  if (mode === "safe") {
    lines.push("- You are in safe mode: do not ask to execute trades or cancels. Stay read-only.");
  }

  return lines.join("\n");
}

function buildModePolicy(mode: AssistantMode): string {
  switch (mode) {
    case "scout":
      return [
        "## Mode Policy: Scout",
        "- Focus on discovery: categories, series, events, trending markets, and live opportunities.",
        "- Stay read-only and prioritize breadth over execution.",
      ].join("\n");
    case "analyst":
      return [
        "## Mode Policy: Analyst",
        "- Focus on analysis, price structure, liquidity, and thesis quality.",
        "- Build clear trade ideas, but do not rush execution.",
      ].join("\n");
    case "trader":
      return [
        "## Mode Policy: Trader",
        "- You may prepare trades and request approval for execution when the user clearly wants to trade.",
        "- Always evaluate sizing, spread, depth, freshness, and inventory before proposing a live action.",
      ].join("\n");
    case "operator":
      return [
        "## Mode Policy: Operator",
        "- Focus on managing balances, positions, open orders, and cleanup actions.",
        "- Prefer account hygiene and state reconciliation over new risk taking.",
      ].join("\n");
    case "safe":
    default:
      return [
        "## Mode Policy: Safe",
        "- Read-only fallback mode.",
        "- Do not attempt any tool that moves markets or changes account state.",
      ].join("\n");
  }
}

export function buildSystemPrompt(mode: AssistantMode, toolDefs: ToolDefinition<z.ZodType>[]): string {
  const tuiContext = getTUIContext();
  const skillsPrompt = getEnabledSkillsSystemPrompt(skills());
  const contextBlock = formatTUIContextForPrompt(tuiContext);

  return [
    "You are the in-app Polymarket trading assistant inside a Bloomberg-style terminal UI.",
    "You help the user discover markets, analyze pricing and liquidity, inspect portfolio risk, and prepare execution on real Polymarket APIs.",
    "",
    "## Core Trading Rules",
    "- Always operate on real Polymarket semantics: Gamma for market metadata, CLOB for books, prices, orders, cancels, and user state.",
    "- Use fresh book data for trade decisions. If quotes are stale or missing, stop and explain why.",
    "- Respect tick size, minimum order size, post-only crossing rules, wallet balance, reserved collateral, and sell inventory.",
    "- Never pretend a trade executed. Only report exchange-confirmed results returned by tools.",
    "- Keep responses concise, concrete, and operational.",
    "",
    buildModePolicy(mode),
    "",
    buildToolPolicyBlock(mode, toolDefs),
    "",
    "## Current Workspace Context",
    contextBlock,
    skillsPrompt,
    "",
    "Respond in the same language as the user.",
  ].filter(Boolean).join("\n");
}

function resolveAssistantModel():
  | { model: unknown; providerName: string; providerModelId: string }
  | { error: string } {
  const provider = getActiveAIProvider();
  if (!provider) {
    return { error: "No AI provider configured. Open Settings > Providers and configure one." };
  }

  const apiKey = (provider.apiKey ?? "").trim();
  if (!apiKey) {
    return { error: `Provider \"${provider.name}\" has no API key configured.` };
  }

  const modelId = provider.model.trim() || DEFAULT_MODEL;
  const baseUrl = provider.baseUrl.trim();

  if (provider.kind === "anthropic") {
    const anthropic = createAnthropic({ apiKey, baseURL: baseUrl });
    return {
      model: anthropic(modelId),
      providerName: provider.name,
      providerModelId: modelId,
    };
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
    headers: provider.kind === "openrouter"
      ? {
          "HTTP-Referer": "https://polymarket-tui.local",
          "X-Title": "Polymarket Bloomberg TUI",
        }
      : undefined,
  });

  return {
    model: openai(modelId),
    providerName: provider.name,
    providerModelId: modelId,
  };
}

function mapHistory(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function createApprovalRequest(
  toolName: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
  prepared: Awaited<ReturnType<typeof prepareToolApproval>>,
  toolDef: ToolDefinition<z.ZodType>,
): AssistantApprovalRequest {
  const createdAt = Date.now();
  return {
    id: `approval-${createdAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    toolName,
    title: prepared.title,
    summary: prepared.summary,
    args,
    createdAt,
    expiresAt: createdAt + APPROVAL_TTL_MS,
    status: "pending",
    riskLevel: prepared.riskLevel,
    requiresWallet: Boolean(toolDef.requiresWallet),
    executesTrade: Boolean(toolDef.executesTrade),
    warnings: prepared.warnings,
    contextHash: buildApprovalContextHash(ctx, toolName, args),
    preview: prepared.preview,
  };
}

function buildToolCallRecord(
  id: string,
  toolDef: ToolDefinition<z.ZodType>,
  args: Record<string, unknown>,
  result: unknown,
): ToolCall {
  return {
    id,
    name: toolDef.name,
    arguments: args,
    result,
    category: toolDef.category,
    riskLevel: toolDef.riskLevel,
    requiresConfirmation: toolDef.requiresConfirmation,
  };
}

export async function runAssistantStream(
  messages: ChatMessage[],
  sessionID: string,
  callbacks: AssistantRuntimeCallbacks = {},
): Promise<{ response: string; toolCalls: ToolCall[]; tokensUsed: number; effectiveMode: AssistantMode }> {
  const resolvedModel = resolveAssistantModel();
  if ("error" in resolvedModel) {
    return {
      response: resolvedModel.error,
      toolCalls: [],
      tokensUsed: 0,
      effectiveMode: "safe",
    };
  }

  const requestedMode = assistantMode();
  const { mode, guardReason } = resolveEffectiveAssistantMode(requestedMode);
  setAssistantGuardReason(guardReason);

  const toolDefs = getToolsForMode(mode);
  const systemPrompt = buildSystemPrompt(mode, toolDefs);
  const trackedToolCalls: ToolCall[] = [];

  const wrappedTools: Record<string, unknown> = {};
  const buildAiTool = createAiTool as (...args: any[]) => unknown;
  for (const toolDef of toolDefs) {
    wrappedTools[toolDef.name] = buildAiTool({
      description: toolDef.description,
      parameters: zodSchema(toolDef.parameters),
      execute: async (rawArgs: unknown) => {
        const args = rawArgs as Record<string, unknown>;
        const callId = `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const startedAt = Date.now();
        const ctx = createAgentContext(sessionID, callId);

        callbacks.onToolCall?.({
          id: callId,
          name: toolDef.name,
          args,
          category: toolDef.category,
          riskLevel: toolDef.riskLevel,
          requiresConfirmation: toolDef.requiresConfirmation,
          startedAt,
        });

        try {
          let result: unknown;

          if (toolDef.requiresConfirmation && ctx.approvalMode !== "approved") {
            const prepared = await prepareToolApproval(toolDef.name, args, ctx);
            const approval = createApprovalRequest(toolDef.name, args, ctx, prepared, toolDef);
            setPendingApproval(approval);
            result = {
              success: false,
              message: "Approval required before executing this action.",
              requiresConfirmation: true,
              approval,
              data: prepared.preview,
            };
          } else {
            result = await executeTool(toolDef.name, args, ctx);
          }

          const completedAt = Date.now();
          callbacks.onToolResult?.({ id: callId, name: toolDef.name, result, completedAt });
          trackedToolCalls.push(buildToolCallRecord(callId, toolDef, args, result));
          return result;
        } catch (error) {
          const completedAt = Date.now();
          const errorMessage = error instanceof Error ? error.message : "Tool execution failed";
          callbacks.onToolError?.({ id: callId, name: toolDef.name, error: errorMessage, completedAt });
          const result = { success: false, error: errorMessage };
          trackedToolCalls.push(buildToolCallRecord(callId, toolDef, args, result));
          throw error;
        }
      },
    }) as unknown;
  }

  const result = streamText({
    model: resolvedModel.model as never,
    system: systemPrompt,
    messages: mapHistory(messages),
    tools: wrappedTools as never,
    maxSteps: 12,
    temperature: 0.35,
    onError: (error) => {
      console.error("Assistant stream error:", error);
    },
  });

  let response = "";
  for await (const chunk of result.textStream) {
    response += chunk;
    callbacks.onChunk?.(chunk);
  }

  let tokensUsed = 0;
  try {
    const usage = await result.usage;
    tokensUsed = usage.totalTokens ?? 0;
  } catch {
    // usage is optional across providers
  }

  return {
    response,
    toolCalls: trackedToolCalls,
    tokensUsed,
    effectiveMode: mode,
  };
}

function summarizeToolResult(toolName: string, result: unknown): string {
  const record = typeof result === "object" && result !== null ? result as Record<string, unknown> : null;
  if (record?.success === false && typeof record.error === "string") {
    return `Execution failed for ${toolName}: ${record.error}`;
  }

  if (record?.requiresConfirmation === true) {
    const approval = record.approval as AssistantApprovalRequest | undefined;
    return approval
      ? `${approval.title}: ${approval.summary}`
      : `Approval required for ${toolName}.`;
  }

  if (toolName === "place_order") {
    const data = record?.data as Record<string, unknown> | undefined;
    if (data?.orderId) {
      return `Trade executed. Order ${String(data.orderId)} is now ${String(data.status ?? "submitted")}.`;
    }
  }

  if (toolName.startsWith("cancel_")) {
    const data = record?.data as Record<string, unknown> | undefined;
    if (typeof record?.message === "string") return record.message;
    if (typeof data?.cancelled === "number") {
      return `Cancel action completed. ${data.cancelled} order(s) affected.`;
    }
  }

  if (typeof record?.message === "string") {
    return record.message;
  }

  return `Executed ${toolName}.`;
}

export async function executeApprovedAssistantAction(
  approval: AssistantApprovalRequest,
  sessionID: string,
  callbacks: AssistantRuntimeCallbacks = {},
): Promise<{ response: string; toolCall: ToolCall | null; result: unknown }> {
  const toolDef = getTool(approval.toolName);
  if (!toolDef) {
    return {
      response: `Unknown approved tool: ${approval.toolName}`,
      toolCall: null,
      result: { success: false, error: `Unknown tool: ${approval.toolName}` },
    };
  }

  const ctx = createAgentContext(sessionID, approval.id);
  const currentHash = buildApprovalContextHash(ctx, approval.toolName, approval.args);
  if (currentHash !== approval.contextHash) {
    const result = {
      success: false,
      error: "Approval expired because the trading context changed. Refresh the preview and approve again.",
    };
    return {
      response: "Approval expired because market or account context drifted. Please request a fresh preview.",
      toolCall: buildToolCallRecord(approval.id, toolDef, approval.args, result),
      result,
    };
  }

  clearPendingApproval();

  callbacks.onToolCall?.({
    id: approval.id,
    name: toolDef.name,
    args: approval.args,
    category: toolDef.category,
    riskLevel: toolDef.riskLevel,
    requiresConfirmation: toolDef.requiresConfirmation,
    startedAt: Date.now(),
  });

  const approvedContext = { ...ctx, approvalMode: "approved" as const };
  const result = await executeTool(toolDef.name, approval.args, approvedContext);
  callbacks.onToolResult?.({
    id: approval.id,
    name: toolDef.name,
    result,
    completedAt: Date.now(),
  });

  return {
    response: summarizeToolResult(toolDef.name, result),
    toolCall: buildToolCallRecord(approval.id, toolDef, approval.args, result),
    result,
  };
}

export function createReasoningState(): ReasoningState {
  return {
    currentStep: "thinking",
    thought: "",
    toolCalls: [],
    observations: [],
    isComplete: false,
  };
}

export function updateReasoningState(state: ReasoningState, update: Partial<ReasoningState>): ReasoningState {
  return { ...state, ...update };
}

export function getPendingApprovalIfLive(): AssistantApprovalRequest | null {
  const approval = pendingApproval();
  if (!approval) return null;
  if (approval.expiresAt <= Date.now()) {
    clearPendingApproval();
    return null;
  }
  return approval;
}
