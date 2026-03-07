/**
 * Agent Tools - Registry of all available tools
 */

import * as market from "./market";
import * as portfolio from "./portfolio";
import * as order from "./order";
import * as discovery from "./discovery";
import * as navigation from "./navigation";
import * as ui from "./ui";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";
import type { z } from "zod";
import type { AssistantMode } from "../../state";

/**
 * Combined tool definitions from all categories
 */
export const allTools: ToolDefinition<z.ZodType>[] = [
  ...market.tools,
  ...portfolio.tools,
  ...order.tools,
  ...discovery.tools,
  ...navigation.tools,
  ...ui.tools,
];

/**
 * Executor functions map
 */
export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  ...market.executors,
  ...portfolio.executors,
  ...order.executors,
  ...discovery.executors,
  ...navigation.executors,
  ...ui.executors,
};

function toolEnabledForMode(tool: ToolDefinition<z.ZodType>, mode: AssistantMode): boolean {
  if (tool.enabledModes && !tool.enabledModes.includes(mode)) {
    return false;
  }

  if (mode === "safe" && tool.executesTrade) {
    return false;
  }

  return true;
}

/**
 * Get tool by name
 */
export function getTool(name: string): ToolDefinition<z.ZodType> | undefined {
  return allTools.find((t) => t.name === name);
}

export function getToolsForMode(mode: AssistantMode): ToolDefinition<z.ZodType>[] {
  return allTools.filter((tool) => toolEnabledForMode(tool, mode));
}

/**
 * Get executor by name
 */
export function getExecutor(name: string): ((args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>) | undefined {
  return executors[name];
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext
): Promise<ToolResult> {
  const executor = executors[name];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  try {
    return await executor(args, ctx);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Tool execution failed",
    };
  }
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return allTools.map((t) => t.name);
}

export async function prepareToolApproval(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<{
  title: string;
  summary: string;
  warnings: string[];
  preview?: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high" | "critical";
}> {
  if (
    name === "place_order"
    || name === "cancel_order"
    || name === "cancel_all_orders"
    || name === "cancel_market_orders"
  ) {
    return order.buildOrderToolApproval(name, args, ctx);
  }

  const tool = getTool(name);
  return {
    title: "Approve action",
    summary: `Approve tool ${name}`,
    warnings: [],
    preview: args,
    riskLevel: tool?.riskLevel ?? "medium",
  };
}

// Re-export types
export type { ToolDefinition, ToolResult, AgentContext } from "../tool";
