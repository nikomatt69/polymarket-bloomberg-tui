/**
 * Order Tool - Trading and order management
 */

import { z } from "zod";
import { walletState } from "../../state";
import { placeOrder, cancelOrder } from "../../api/orders";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const PlaceOrderSchema = z.object({
  tokenId: z.string().describe("The token/outcome ID to trade"),
  side: z.enum(["BUY", "SELL"]).describe("Buy or Sell"),
  price: z.number().describe("Price per share (e.g., 0.65 for 65%)"),
  shares: z.number().describe("Number of shares to trade"),
  marketTitle: z.string().optional().describe("The market title (optional, for display)"),
  outcomeTitle: z.string().optional().describe("The outcome title (optional, for display)"),
  postOnly: z.boolean().optional().default(false).describe("If true, order only matches if it doesn't cross the spread"),
  type: z.enum(["GTC", "FOK", "GTD"]).optional().default("GTC").describe("Order type"),
});

export const CancelOrderSchema = z.object({
  orderId: z.string().describe("The order ID to cancel"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS = {
  place_order: {
    description: "Place a real order (buy or sell) on Polymarket",
    instructions: `CRITICAL - This executes real trades with real money!

Before placing:
1. Check wallet balance (get_balance)
2. Check order book for liquidity (get_order_book)
3. Calculate position size: max_shares = (balance * 0.05) / price

Never risk more than 5-10% of balance on single trade.

Returns order ID on success.`,
    example: `place_order({ tokenId: "abc123", side: "BUY", price: 0.65, shares: 100 })`,
  },

  cancel_order: {
    description: "Cancel a specific open order by its order ID",
    instructions: `Use this when:
- User wants to cancel an open order
- Order no longer represents desired position

Requires order ID from get_open_orders.`,
    example: `cancel_order({ orderId: "order123" })`,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

export async function placeOrderTool(args: z.infer<typeof PlaceOrderSchema>, ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Use open_wallet_modal first." };
  }

  const { tokenId, side, price, shares, marketTitle, outcomeTitle, postOnly, type } = args;

  if (!tokenId || !side || !price || !shares) {
    return { success: false, error: "Missing required parameters: tokenId, side, price, shares" };
  }

  // Risk check
  const totalCost = price * shares;
  const balancePercent = (totalCost / walletState.balance) * 100;

  if (balancePercent > 10) {
    return {
      success: false,
      error: `Trade would use ${balancePercent.toFixed(1)}% of balance. Max is 10%. Reduce shares to ${Math.floor((walletState.balance * 0.1) / price)}.`,
    };
  }

  try {
    const order = await placeOrder({
      tokenId,
      side,
      price,
      shares,
      type: type ?? "GTC",
      postOnly: postOnly ?? false,
      marketTitle: marketTitle || "",
      outcomeTitle: outcomeTitle || "",
    });

    return {
      success: true,
      data: {
        message: `${side} order placed successfully!`,
        order: {
          orderId: order.orderId,
          side: order.side,
          price: order.price,
          shares: order.originalSize,
          totalCost: order.price * order.originalSize,
          status: order.status,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to place order",
    };
  }
}

export async function cancelOrderTool(args: z.infer<typeof CancelOrderSchema>, ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Use open_wallet_modal first." };
  }

  const { orderId } = args;

  if (!orderId) {
    return { success: false, error: "orderId is required" };
  }

  try {
    await cancelOrder(orderId);
    return {
      success: true,
      data: {
        message: `Order ${orderId} cancelled successfully`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel order",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "order.place_order",
    name: "place_order",
    category: "order",
    description: PROMPTS.place_order.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.place_order.example],
    requiresWallet: true,
    executesTrade: true,
  },
  {
    id: "order.cancel_order",
    name: "cancel_order",
    category: "order",
    description: PROMPTS.cancel_order.description,
    parameters: {} as unknown as z.ZodType,
    examples: [PROMPTS.cancel_order.example],
    requiresWallet: true,
    executesTrade: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Execute Map
// ─────────────────────────────────────────────────────────────────────────────

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  place_order: async (args, ctx) => placeOrderTool(args as z.infer<typeof PlaceOrderSchema>, ctx),
  cancel_order: async (args, ctx) => cancelOrderTool(args as z.infer<typeof CancelOrderSchema>, ctx),
};
