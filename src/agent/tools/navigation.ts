/**
 * Navigation Tool - TUI navigation and view control
 */

import { z } from "zod";
import {
  navigateToIndex,
  setSortBy,
  setTimeframe,
  getSelectedMarket,
  appState,
} from "../../state";
import { manualRefresh } from "../../hooks/useMarketData";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const NavigateToMarketSchema = z.object({
  index: z.number().describe("The index number in the market list"),
});

export const SetTimeframeSchema = z.object({
  timeframe: z.enum(["1h", "4h", "1d", "5d", "1w", "1M", "all"]).describe("Timeframe"),
});

export const SetSortBySchema = z.object({
  sort: z.enum(["volume", "change", "name"]).describe("Sort method"),
});

export const RefreshMarketsSchema = z.object({});

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS = {
  navigate_to_market: {
    description: "Navigate to a market by index in the list",
    instructions: `Use this when:
- User wants to jump to a specific market
- After showing market list, let user pick by number

Index is 0-based position in current filtered/sorted list.`,
    example: `navigate_to_market({ index: 5 })`,
  },

  set_timeframe: {
    description: "Set the chart timeframe",
    instructions: `Use this when:
- User wants to change chart timeframe
- Options: 1d, 5d, 7d, all

Changes the price history chart view.`,
    example: `set_timeframe({ timeframe: "1d" })`,
  },

  set_sort_by: {
    description: "Set the market sort method",
    instructions: `Use this when:
- User wants to change sort order
- Options: volume, change, name

Changes how markets are sorted in the list.`,
    example: `set_sort_by({ sort: "volume" })`,
  },

  refresh_markets: {
    description: "Refresh the market data",
    instructions: `Use this when:
- User asks to refresh
- Data seems stale
- After placing orders`,
    example: `refresh_markets({})`,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

export async function navigateToMarketTool(args: z.infer<typeof NavigateToMarketSchema>, ctx: AgentContext): Promise<ToolResult> {
  const { index } = args;

  // Get filtered markets count
  const filteredCount = appState.markets.length;

  if (index < 0 || index >= filteredCount) {
    return { success: false, error: `Invalid index. Must be between 0 and ${filteredCount - 1}` };
  }

  navigateToIndex(index);
  const market = getSelectedMarket();

  return {
    success: true,
    data: {
      message: `Navigated to: ${market?.title || "market"}`,
      index,
      marketId: market?.id,
      marketTitle: market?.title,
    },
  };
}

export async function setTimeframeTool(args: z.infer<typeof SetTimeframeSchema>, ctx: AgentContext): Promise<ToolResult> {
  setTimeframe(args.timeframe);

  return {
    success: true,
    data: {
      message: `Timeframe set to ${args.timeframe}`,
      timeframe: args.timeframe,
    },
  };
}

export async function setSortByTool(args: z.infer<typeof SetSortBySchema>, ctx: AgentContext): Promise<ToolResult> {
  setSortBy(args.sort);

  return {
    success: true,
    data: {
      message: `Sorted by ${args.sort}`,
      sort: args.sort,
    },
  };
}

export async function refreshMarketsTool(_args: z.infer<typeof RefreshMarketsSchema>, ctx: AgentContext): Promise<ToolResult> {
  manualRefresh();

  return {
    success: true,
    data: {
      message: "Refreshing markets...",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "navigation.navigate_to_market",
    name: "navigate_to_market",
    category: "navigation",
    description: PROMPTS.navigate_to_market.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.navigate_to_market.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "navigation.set_timeframe",
    name: "set_timeframe",
    category: "navigation",
    description: PROMPTS.set_timeframe.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.set_timeframe.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "navigation.set_sort_by",
    name: "set_sort_by",
    category: "navigation",
    description: PROMPTS.set_sort_by.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.set_sort_by.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "navigation.refresh_markets",
    name: "refresh_markets",
    category: "navigation",
    description: PROMPTS.refresh_markets.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.refresh_markets.example],
    requiresWallet: false,
    executesTrade: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Execute Map
// ─────────────────────────────────────────────────────────────────────────────

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  navigate_to_market: async (args, ctx) => navigateToMarketTool(args as z.infer<typeof NavigateToMarketSchema>, ctx),
  set_timeframe: async (args, ctx) => setTimeframeTool(args as z.infer<typeof SetTimeframeSchema>, ctx),
  set_sort_by: async (args, ctx) => setSortByTool(args as z.infer<typeof SetSortBySchema>, ctx),
  refresh_markets: async (args, ctx) => refreshMarketsTool(args as z.infer<typeof RefreshMarketsSchema>, ctx),
};
