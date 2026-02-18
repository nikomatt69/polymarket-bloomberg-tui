/**
 * Portfolio Tool - User positions, balance, and portfolio management
 */

import { z } from "zod";
import { walletState } from "../../state";
import { positionsState, fetchUserPositions } from "../../hooks/usePositions";
import { fetchOpenOrders, fetchTradeHistory } from "../../api/orders";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const GetPortfolioSchema = z.object({});
export const GetBalanceSchema = z.object({});
export const GetPositionsDetailsSchema = z.object({});
export const GetTradeHistorySchema = z.object({});
export const GetOpenOrdersSchema = z.object({});

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS = {
  get_portfolio: {
    description: "Get the user's current positions and portfolio summary",
    instructions: `Use this when:
- User asks to see their portfolio
- User wants to check their current positions
- Opening the portfolio panel

Requires wallet connection.`,
    example: `get_portfolio({})`,
  },

  get_balance: {
    description: "Get the user's USDC wallet balance",
    instructions: `Use this when:
- User asks for their balance
- Before placing an order to check available funds
- User wants to know their trading power

Requires wallet connection.`,
    example: `get_balance({})`,
  },

  get_positions_details: {
    description: "Get detailed positions with PnL calculations",
    instructions: `Use this when:
- User wants detailed position info
- Checking profit/loss on current positions
- Analyzing trading performance

Shows: size, avg price, current price, PnL, PnL %.`,
    example: `get_positions_details({})`,
  },

  get_trade_history: {
    description: "Get the user's trade history (filled/executed trades)",
    instructions: `Use this when:
- User asks for their trade history
- Reviewing past trades
- Analyzing trading patterns

Requires wallet connection.`,
    example: `get_trade_history({})`,
  },

  get_open_orders: {
    description: "Get all currently open orders (not yet filled or cancelled)",
    instructions: `Use this when:
- User asks to see open orders
- Before placing new orders to avoid overtrading
- Checking pending orders

Requires wallet connection.`,
    example: `get_open_orders({})`,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getPositionsDetails(): {
  positions: Array<{
    tokenId: string;
    outcomeTitle: string;
    marketTitle: string;
    size: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  }>;
  totalPnL: number;
} {
  const positions = positionsState.positions || [];
  let totalPnL = 0;

  const detailed = positions.map((pos) => {
    const size = pos.size || 0;
    const avgPrice = pos.avgPrice || 0;
    const currentPrice = pos.curPrice || avgPrice;
    const pnl = pos.cashPnl || 0;
    const pnlPercent = pos.percentPnl || 0;

    totalPnL += pnl;

    return {
      tokenId: pos.asset,
      outcomeTitle: pos.outcome || "Unknown",
      marketTitle: pos.title || "Unknown",
      size,
      avgPrice,
      currentPrice,
      pnl,
      pnlPercent,
    };
  });

  return { positions: detailed, totalPnL };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

export async function getPortfolioTool(_args: z.infer<typeof GetPortfolioSchema>, ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Use open_wallet_modal first." };
  }

  await fetchUserPositions();
  const details = getPositionsDetails();

  return {
    success: true,
    data: {
      positionsCount: details.positions.length,
      totalPnL: details.totalPnL,
      positions: details.positions,
      summary: {
        totalValue: details.positions.reduce((sum, p) => sum + p.size * p.currentPrice, 0),
        totalCost: details.positions.reduce((sum, p) => sum + p.size * p.avgPrice, 0),
        winningPositions: details.positions.filter((p) => p.pnl > 0).length,
        losingPositions: details.positions.filter((p) => p.pnl < 0).length,
      },
    },
  };
}

export async function getBalanceTool(_args: z.infer<typeof GetBalanceSchema>, ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Use open_wallet_modal first." };
  }

  return {
    success: true,
    data: {
      balance: walletState.balance,
      address: walletState.address,
    },
  };
}

export async function getPositionsDetailsTool(_args: z.infer<typeof GetPositionsDetailsSchema>, ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Use open_wallet_modal first." };
  }

  await fetchUserPositions();
  const details = getPositionsDetails();

  return {
    success: true,
    data: {
      count: details.positions.length,
      totalPnL: details.totalPnL,
      positions: details.positions,
    },
  };
}

export async function getTradeHistoryTool(_args: z.infer<typeof GetTradeHistorySchema>, ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Use open_wallet_modal first." };
  }

  const trades = await fetchTradeHistory();

  return {
    success: true,
    data: {
      count: trades.length,
      trades: trades.map((t) => ({
        orderId: t.orderId,
        tokenId: t.tokenId,
        side: t.side,
        price: t.price,
        size: t.originalSize,
        status: t.status,
        timestamp: new Date(t.createdAt).toISOString(),
        marketTitle: t.marketTitle,
        outcomeTitle: t.outcomeTitle,
      })),
    },
  };
}

export async function getOpenOrdersTool(_args: z.infer<typeof GetOpenOrdersSchema>, ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Use open_wallet_modal first." };
  }

  const orders = await fetchOpenOrders();

  return {
    success: true,
    data: {
      count: orders.length,
      orders: orders.map((o) => ({
        orderId: o.orderId,
        tokenId: o.tokenId,
        side: o.side,
        price: o.price,
        size: o.originalSize,
        filled: o.sizeMatched,
        remaining: o.sizeRemaining,
        status: o.status,
        createdAt: new Date(o.createdAt).toISOString(),
        marketTitle: o.marketTitle,
        outcomeTitle: o.outcomeTitle,
      })),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "portfolio.get_portfolio",
    name: "get_portfolio",
    category: "portfolio",
    description: PROMPTS.get_portfolio.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_portfolio.example],
    requiresWallet: true,
    executesTrade: false,
  },
  {
    id: "portfolio.get_balance",
    name: "get_balance",
    category: "portfolio",
    description: PROMPTS.get_balance.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_balance.example],
    requiresWallet: true,
    executesTrade: false,
  },
  {
    id: "portfolio.get_positions_details",
    name: "get_positions_details",
    category: "portfolio",
    description: PROMPTS.get_positions_details.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_positions_details.example],
    requiresWallet: true,
    executesTrade: false,
  },
  {
    id: "portfolio.get_trade_history",
    name: "get_trade_history",
    category: "portfolio",
    description: PROMPTS.get_trade_history.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_trade_history.example],
    requiresWallet: true,
    executesTrade: false,
  },
  {
    id: "portfolio.get_open_orders",
    name: "get_open_orders",
    category: "portfolio",
    description: PROMPTS.get_open_orders.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.get_open_orders.example],
    requiresWallet: true,
    executesTrade: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Execute Map
// ─────────────────────────────────────────────────────────────────────────────

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  get_portfolio: async (args, ctx) => getPortfolioTool(args as z.infer<typeof GetPortfolioSchema>, ctx),
  get_balance: async (args, ctx) => getBalanceTool(args as z.infer<typeof GetBalanceSchema>, ctx),
  get_positions_details: async (args, ctx) => getPositionsDetailsTool(args as z.infer<typeof GetPositionsDetailsSchema>, ctx),
  get_trade_history: async (args, ctx) => getTradeHistoryTool(args as z.infer<typeof GetTradeHistorySchema>, ctx),
  get_open_orders: async (args, ctx) => getOpenOrdersTool(args as z.infer<typeof GetOpenOrdersSchema>, ctx),
};
