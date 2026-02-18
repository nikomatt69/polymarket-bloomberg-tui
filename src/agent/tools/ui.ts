/**
 * UI Tool - TUI panels and user interface controls
 */

import { z } from "zod";
import {
  setWalletModalOpen,
  setPortfolioOpen,
  setOrderFormOpen,
  setOrderFormSide,
  setOrderFormTokenId,
  setOrderFormMarketTitle,
  setOrderFormOutcomeTitle,
  setOrderFormCurrentPrice,
  setOrderFormPriceInput,
  setOrderFormSharesInput,
  setOrderFormPostOnly,
  setOrderFormFocusField,
} from "../../state";
import { alertsState } from "../../hooks/useAlerts";
import type { PriceAlert } from "../../types/alerts";
import { toggleWatchlist, watchlistState } from "../../hooks/useWatchlist";
import { loadAlerts } from "../../hooks/useAlerts";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const OpenWalletModalSchema = z.object({});
export const OpenPortfolioSchema = z.object({});
export const OpenOrderFormSchema = z.object({
  tokenId: z.string().describe("The token/outcome ID"),
  marketTitle: z.string().describe("The market title"),
  outcomeTitle: z.string().describe("The outcome title"),
  price: z.number().describe("Current price of the outcome"),
  side: z.enum(["BUY", "SELL"]).describe("Buy or Sell"),
});
export const GetWatchlistSchema = z.object({});
export const AddWatchlistSchema = z.object({
  marketId: z.string().describe("The market ID to add"),
});
export const RemoveWatchlistSchema = z.object({
  marketId: z.string().describe("The market ID to remove"),
});
export const GetAlertsSchema = z.object({});

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS = {
  open_wallet_modal: {
    description: "Open the wallet connection modal",
    instructions: `Use this when:
- User asks to connect wallet
- User wants to see wallet info
- Wallet not connected and action requires it`,
    example: `open_wallet_modal({})`,
  },

  open_portfolio: {
    description: "Open the portfolio panel",
    instructions: `Use this when:
- User asks to see portfolio
- User wants to view positions
- User asks for "my positions"`,
    example: `open_portfolio({})`,
  },

  open_order_form: {
    description: "Open the order form for a specific outcome",
    instructions: `Use this when:
- User wants to place an order
- User confirms they want to trade
- Shows order form in TUI for user to confirm`,
    example: `open_order_form({ tokenId: "abc", marketTitle: "Test", outcomeTitle: "Yes", price: 0.65, side: "BUY" })`,
  },

  get_watchlist: {
    description: "Get the user's watchlist",
    instructions: `Use this when:
- User asks for watchlist
- Checking which markets are watched`,
    example: `get_watchlist({})`,
  },

  add_watchlist: {
    description: "Add a market to the user's watchlist",
    instructions: `Use this when:
- User wants to add market to watchlist
- User asks to "track" a market`,
    example: `add_watchlist({ marketId: "abc123" })`,
  },

  remove_watchlist: {
    description: "Remove a market from the user's watchlist",
    instructions: `Use this when:
- User wants to remove from watchlist
- User asks to "untrack" a market`,
    example: `remove_watchlist({ marketId: "abc123" })`,
  },

  get_alerts: {
    description: "Get the user's price alerts",
    instructions: `Use this when:
- User asks for alerts
- Checking active price alerts`,
    example: `get_alerts({})`,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

export async function openWalletModalTool(_args: z.infer<typeof OpenWalletModalSchema>, ctx: AgentContext): Promise<ToolResult> {
  setWalletModalOpen(true);

  return {
    success: true,
    data: {
      message: "Wallet modal opened",
    },
  };
}

export async function openPortfolioTool(_args: z.infer<typeof OpenPortfolioSchema>, ctx: AgentContext): Promise<ToolResult> {
  setPortfolioOpen(true);

  return {
    success: true,
    data: {
      message: "Portfolio panel opened",
    },
  };
}

export async function openOrderFormTool(args: z.infer<typeof OpenOrderFormSchema>, ctx: AgentContext): Promise<ToolResult> {
  const { tokenId, marketTitle, outcomeTitle, price, side } = args;

  setOrderFormSide(side);
  setOrderFormTokenId(tokenId);
  setOrderFormMarketTitle(marketTitle);
  setOrderFormOutcomeTitle(outcomeTitle);
  setOrderFormCurrentPrice(price);
  setOrderFormPriceInput(price.toFixed(4));
  setOrderFormSharesInput("");
  setOrderFormPostOnly(false);
  setOrderFormFocusField("shares");
  setOrderFormOpen(true);

  return {
    success: true,
    data: {
      message: `Order form opened for ${side} ${outcomeTitle} @ ${price}`,
    },
  };
}

export async function getWatchlistTool(_args: z.infer<typeof GetWatchlistSchema>, ctx: AgentContext): Promise<ToolResult> {
  return {
    success: true,
    data: {
      marketIds: watchlistState.marketIds,
      count: watchlistState.marketIds.length,
      filterActive: watchlistState.filterActive,
    },
  };
}

export async function addWatchlistTool(args: z.infer<typeof AddWatchlistSchema>, ctx: AgentContext): Promise<ToolResult> {
  const { marketId } = args;

  if (watchlistState.marketIds.includes(marketId)) {
    return { success: false, error: "Market already in watchlist" };
  }

  toggleWatchlist(marketId);

  return {
    success: true,
    data: {
      message: `Added ${marketId} to watchlist`,
      marketId,
    },
  };
}

export async function removeWatchlistTool(args: z.infer<typeof RemoveWatchlistSchema>, ctx: AgentContext): Promise<ToolResult> {
  const { marketId } = args;

  if (!watchlistState.marketIds.includes(marketId)) {
    return { success: false, error: "Market not in watchlist" };
  }

  toggleWatchlist(marketId);

  return {
    success: true,
    data: {
      message: `Removed ${marketId} from watchlist`,
      marketId,
    },
  };
}

export async function getAlertsTool(_args: z.infer<typeof GetAlertsSchema>, ctx: AgentContext): Promise<ToolResult> {
  loadAlerts();

  return {
    success: true,
    data: {
      count: alertsState.alerts.length,
      alerts: alertsState.alerts.map((a: PriceAlert) => ({
        id: a.id,
        marketTitle: a.marketTitle,
        outcomeTitle: a.outcomeTitle,
        condition: a.condition,
        metric: a.metric,
        threshold: a.threshold,
        status: a.status,
      })),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "ui.open_wallet_modal",
    name: "open_wallet_modal",
    category: "ui",
    description: PROMPTS.open_wallet_modal.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.open_wallet_modal.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "ui.open_portfolio",
    name: "open_portfolio",
    category: "ui",
    description: PROMPTS.open_portfolio.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.open_portfolio.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "ui.open_order_form",
    name: "open_order_form",
    category: "ui",
    description: PROMPTS.open_order_form.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.open_order_form.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "ui.get_watchlist",
    name: "get_watchlist",
    category: "ui",
    description: PROMPTS.get_watchlist.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_watchlist.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "ui.add_watchlist",
    name: "add_watchlist",
    category: "ui",
    description: PROMPTS.add_watchlist.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.add_watchlist.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "ui.remove_watchlist",
    name: "remove_watchlist",
    category: "ui",
    description: PROMPTS.remove_watchlist.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.remove_watchlist.example],
    requiresWallet: false,
    executesTrade: false,
  },
  {
    id: "ui.get_alerts",
    name: "get_alerts",
    category: "alert",
    description: PROMPTS.get_alerts.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_alerts.example],
    requiresWallet: false,
    executesTrade: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Execute Map
// ─────────────────────────────────────────────────────────────────────────────

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  open_wallet_modal: async (args, ctx) => openWalletModalTool(args as z.infer<typeof OpenWalletModalSchema>, ctx),
  open_portfolio: async (args, ctx) => openPortfolioTool(args as z.infer<typeof OpenPortfolioSchema>, ctx),
  open_order_form: async (args, ctx) => openOrderFormTool(args as z.infer<typeof OpenOrderFormSchema>, ctx),
  get_watchlist: async (args, ctx) => getWatchlistTool(args as z.infer<typeof GetWatchlistSchema>, ctx),
  add_watchlist: async (args, ctx) => addWatchlistTool(args as z.infer<typeof AddWatchlistSchema>, ctx),
  remove_watchlist: async (args, ctx) => removeWatchlistTool(args as z.infer<typeof RemoveWatchlistSchema>, ctx),
  get_alerts: async (args, ctx) => getAlertsTool(args as z.infer<typeof GetAlertsSchema>, ctx),
};
