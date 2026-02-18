/**
 * Discovery Tool - Market exploration and discovery
 */

import { z } from "zod";
import {
  getCategories,
  getMarketsByCategory,
  getTrendingMarkets,
  getLiveSportsMarkets,
  getActiveEvents,
  getMarketsBySeries,
  getSeries,
  getTags,
  getMarketsByTag,
} from "../../api/polymarket";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const GetCategoriesSchema = z.object({});
export const SearchByCategorySchema = z.object({
  category: z.string().describe("Category to search (e.g., politics, sports, crypto, economics, entertainment)"),
});
export const GetTrendingMarketsSchema = z.object({
  limit: z.number().optional().default(20).describe("Max results"),
});
export const GetSportsMarketsSchema = z.object({});
export const GetLiveEventsSchema = z.object({});
export const GetEventsSchema = z.object({});
export const GetSeriesMarketsSchema = z.object({
  seriesSlug: z.string().describe("Series slug (e.g., nba, nfl, election-2024, crypto)"),
});
export const GetAllSeriesSchema = z.object({});
export const GetAllTagsSchema = z.object({});
export const GetMarketsByTagSchema = z.object({
  tagSlug: z.string().describe("Tag slug to filter markets"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS = {
  get_categories: {
    description: "Get all available market categories",
    instructions: `Use this to explore what types of markets exist:
- politics, sports, crypto, economics, entertainment, science, etc.

Returns list with market counts per category.`,
    example: `get_categories({})`,
  },

  search_by_category: {
    description: "Search markets by category",
    instructions: `Use this when:
- User asks about "sports markets", "crypto markets"
- User wants to browse a specific category

Example: "Show me sports" → search_by_category({ category: "sports" })`,
    example: `search_by_category({ category: "sports" })`,
  },

  get_trending_markets: {
    description: "Get trending/popular markets by volume",
    instructions: `Use this when:
- User asks for "trending", "popular", "hot" markets
- User wants to see what's moving
- Default view for market discovery`,
    example: `get_trending_markets({ limit: 20 })`,
  },

  get_sports_markets: {
    description: "Get live sports markets (NBA, NFL, Soccer, UFC, etc.)",
    instructions: `Use this when:
- User asks about sports
- User wants live/in-play sports markets
- Shows currently active sports events`,
    example: `get_sports_markets({})`,
  },

  get_live_events: {
    description: "Get currently live/in-play events",
    instructions: `Use this when:
- User asks for "live", "in-play" events
- Shows events that are happening right now`,
    example: `get_live_events({})`,
  },

  get_events: {
    description: "Get all active events (live + upcoming)",
    instructions: `Use this when:
- User wants to see all events
- Browsing what's available to trade`,
    example: `get_events({})`,
  },

  get_series_markets: {
    description: "Get markets for a specific series",
    instructions: `Use this when:
- User asks about NBA, NFL, Election markets
- User wants markets for a specific league/series

Series: nba, nfl, nhl, mlb, soccer, election-2024, crypto, etc.`,
    example: `get_series_markets({ seriesSlug: "nba" })`,
  },

  get_all_series: {
    description: "Get all available series (NBA, NFL, Elections, Crypto)",
    instructions: `Use this to see what series are available:
- Sports leagues (NBA, NFL, NHL, MLB)
- Event series (Elections, Crypto)
- Entertainment series`,
    example: `get_all_series({})`,
  },

  get_all_tags: {
    description: "Get all available tags for market categorization",
    instructions: `Use this to explore market tags:
- More granular than categories
- Useful for finding specific topics`,
    example: `get_all_tags({})`,
  },

  get_markets_by_tag: {
    description: "Get markets filtered by a specific tag",
    instructions: `Use this when:
- User wants specific topics
- After getting tags, filter by interesting ones`,
    example: `get_markets_by_tag({ tagSlug: "president" })`,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

export async function getCategoriesTool(_args: z.infer<typeof GetCategoriesSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const categories = await getCategories();
    return {
      success: true,
      data: {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          marketsCount: c.marketsCount,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get categories",
    };
  }
}

export async function searchByCategoryTool(args: z.infer<typeof SearchByCategorySchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const markets = await getMarketsByCategory(args.category, 20);
    return {
      success: true,
      data: {
        category: args.category,
        count: markets.length,
        markets: markets.slice(0, 10).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
          liquidity: m.liquidity,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search by category",
    };
  }
}

export async function getTrendingMarketsTool(args: z.infer<typeof GetTrendingMarketsSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const markets = await getTrendingMarkets(args.limit ?? 20);
    return {
      success: true,
      data: {
        count: markets.length,
        markets: markets.slice(0, 15).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          change24h: m.change24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get trending markets",
    };
  }
}

export async function getSportsMarketsTool(_args: z.infer<typeof GetSportsMarketsSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const markets = await getLiveSportsMarkets();
    return {
      success: true,
      data: {
        count: markets.length,
        markets: markets.slice(0, 15).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          liquidity: m.liquidity,
          outcomes: m.outcomes.slice(0, 2).map((o) => ({
            title: o.title,
            price: o.price.toFixed(2),
          })),
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get sports markets",
    };
  }
}

export async function getLiveEventsTool(_args: z.infer<typeof GetLiveEventsSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const events = await getActiveEvents(30);
    const liveEvents = events.filter((e) => e.status === "live");
    return {
      success: true,
      data: {
        count: liveEvents.length,
        events: liveEvents.slice(0, 15).map((e) => ({
          id: e.id,
          title: e.title,
          seriesName: e.seriesName,
          startDate: e.startDate,
          endDate: e.endDate,
          marketsCount: e.markets.length,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get live events",
    };
  }
}

export async function getEventsTool(_args: z.infer<typeof GetEventsSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const events = await getActiveEvents(50);
    return {
      success: true,
      data: {
        count: events.length,
        events: events.slice(0, 20).map((e) => ({
          id: e.id,
          title: e.title,
          seriesName: e.seriesName,
          status: e.status,
          startDate: e.startDate,
          marketsCount: e.markets.length,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get events",
    };
  }
}

export async function getSeriesMarketsTool(args: z.infer<typeof GetSeriesMarketsSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const markets = await getMarketsBySeries(args.seriesSlug, 20);
    return {
      success: true,
      data: {
        seriesSlug: args.seriesSlug,
        count: markets.length,
        markets: markets.slice(0, 10).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get series markets",
    };
  }
}

export async function getAllSeriesTool(_args: z.infer<typeof GetAllSeriesSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const series = await getSeries();
    return {
      success: true,
      data: {
        count: series.length,
        series: series.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          description: s.description,
          category: s.category,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get series",
    };
  }
}

export async function getAllTagsTool(_args: z.infer<typeof GetAllTagsSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const tags = await getTags();
    return {
      success: true,
      data: {
        count: tags.length,
        tags: tags.slice(0, 50).map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          category: t.category,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get tags",
    };
  }
}

export async function getMarketsByTagTool(args: z.infer<typeof GetMarketsByTagSchema>, ctx: AgentContext): Promise<ToolResult> {
  try {
    const markets = await getMarketsByTag(args.tagSlug, 20);
    return {
      success: true,
      data: {
        tagSlug: args.tagSlug,
        count: markets.length,
        markets: markets.slice(0, 10).map((m) => ({
          id: m.id,
          title: m.title,
          volume24h: m.volume24h,
          price: m.outcomes[0]?.price.toFixed(2) || "N/A",
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get markets by tag",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "discovery.get_categories",
    name: "get_categories",
    category: "discovery",
    description: PROMPTS.get_categories.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_categories.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.search_by_category",
    name: "search_by_category",
    category: "discovery",
    description: PROMPTS.search_by_category.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.search_by_category.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.get_trending_markets",
    name: "get_trending_markets",
    category: "discovery",
    description: PROMPTS.get_trending_markets.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_trending_markets.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.get_sports_markets",
    name: "get_sports_markets",
    category: "discovery",
    description: PROMPTS.get_sports_markets.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_sports_markets.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.get_live_events",
    name: "get_live_events",
    category: "discovery",
    description: PROMPTS.get_live_events.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_live_events.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.get_events",
    name: "get_events",
    category: "discovery",
    description: PROMPTS.get_events.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_events.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.get_series_markets",
    name: "get_series_markets",
    category: "discovery",
    description: PROMPTS.get_series_markets.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_series_markets.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.get_all_series",
    name: "get_all_series",
    category: "discovery",
    description: PROMPTS.get_all_series.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_all_series.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.get_all_tags",
    name: "get_all_tags",
    category: "discovery",
    description: PROMPTS.get_all_tags.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_all_tags.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "discovery.get_markets_by_tag",
    name: "get_markets_by_tag",
    category: "discovery",
    description: PROMPTS.get_markets_by_tag.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_markets_by_tag.example],
    requiresWallet: false,
    executesTrade: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Execute Map
// ─────────────────────────────────────────────────────────────────────────────

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  get_categories: async (args, ctx) => getCategoriesTool(args as z.infer<typeof GetCategoriesSchema>, ctx),
  search_by_category: async (args, ctx) => searchByCategoryTool(args as z.infer<typeof SearchByCategorySchema>, ctx),
  get_trending_markets: async (args, ctx) => getTrendingMarketsTool(args as z.infer<typeof GetTrendingMarketsSchema>, ctx),
  get_sports_markets: async (args, ctx) => getSportsMarketsTool(args as z.infer<typeof GetSportsMarketsSchema>, ctx),
  get_live_events: async (args, ctx) => getLiveEventsTool(args as z.infer<typeof GetLiveEventsSchema>, ctx),
  get_events: async (args, ctx) => getEventsTool(args as z.infer<typeof GetEventsSchema>, ctx),
  get_series_markets: async (args, ctx) => getSeriesMarketsTool(args as z.infer<typeof GetSeriesMarketsSchema>, ctx),
  get_all_series: async (args, ctx) => getAllSeriesTool(args as z.infer<typeof GetAllSeriesSchema>, ctx),
  get_all_tags: async (args, ctx) => getAllTagsTool(args as z.infer<typeof GetAllTagsSchema>, ctx),
  get_markets_by_tag: async (args, ctx) => getMarketsByTagTool(args as z.infer<typeof GetMarketsByTagSchema>, ctx),
};
