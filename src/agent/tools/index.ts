/**
 * Agent Tools - Registry of all available tools
 */

import * as market from "./market";
import * as portfolio from "./portfolio";
import * as order from "./order";
import * as discovery from "./discovery";
import * as navigation from "./navigation";
import * as ui from "./ui";
import * as bash from "./bash";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";
import type { z } from "zod";

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
  ...bash.tools,
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
  ...bash.executors,
};

/**
 * Get tool by name
 */
export function getTool(name: string): ToolDefinition<z.ZodType> | undefined {
  return allTools.find((t) => t.name === name);
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

// Re-export types
export type { ToolDefinition, ToolResult, AgentContext } from "../tool";
