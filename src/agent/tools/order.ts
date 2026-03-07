/**
 * Order tools - preview, prepare, execute, and cancel trading actions.
 */

import { z } from "zod";
import { walletState } from "../../state";
import {
  cancelAllOpenOrders,
  cancelOrderById,
  cancelSelectedMarketOpenOrders,
  ordersState,

  previewOrderDraft,
  type OrderDraftPreview,
  submitOrder,

} from "../../hooks/useOrders";
import type { ToolDefinition, ToolResult, ToolRiskLevel } from "../tool";
import type { AgentContext } from "../tool";

const BaseOrderSchema = z.object({
  tokenId: z.string().min(1).describe("The token or outcome ID to trade"),
  side: z.enum(["BUY", "SELL"]).describe("Buy or sell"),
  price: z.number().positive().describe("Limit price from 0.01 to 0.99"),
  shares: z.number().positive().describe("Number of shares to trade"),
  marketTitle: z.string().optional().describe("Optional market title for display"),
  outcomeTitle: z.string().optional().describe("Optional outcome title for display"),
  postOnly: z.boolean().optional().default(false).describe("Whether the order must rest on the book"),
  type: z.enum(["GTC", "FOK", "GTD", "FAK"]).optional().default("GTC").describe("Order time in force"),
  negRisk: z.boolean().optional().describe("Use the neg risk exchange when applicable"),
});

export const PreviewOrderSchema = BaseOrderSchema;
export const PrepareOrderSchema = BaseOrderSchema;
export const PlaceOrderSchema = BaseOrderSchema;

export const CancelOrderSchema = z.object({
  orderId: z.string().min(1).describe("The Polymarket order ID to cancel"),
});

export const CancelAllOrdersSchema = z.object({});

export const CancelMarketOrdersSchema = z.object({
  assetIds: z.array(z.string().min(1)).optional().describe("Token IDs to cancel for the selected market"),
});

function approvalSummaryFromPreview(preview: OrderDraftPreview): string {
  const outcome = preview.outcomeTitle ?? preview.quote.lastTradePrice ?? "selected outcome";
  return `${preview.side} ${preview.shares.toFixed(2)} @ ${preview.price.toFixed(4)} (${preview.notional.toFixed(2)} USDC) on ${preview.marketTitle ?? outcome}`;
}

function approvalRiskFromPreview(preview: OrderDraftPreview): ToolRiskLevel {
  if (!preview.valid) return "critical";
  if (preview.warnings.length >= 2) return "high";
  if (preview.warnings.length === 1) return "medium";
  return "high";
}

function lookupOrderForCancel(orderId: string) {
  return ordersState.openOrders.find((order) => order.orderId === orderId) ?? null;
}

function resolveMarketCancelAssetIds(args: z.infer<typeof CancelMarketOrdersSchema>, ctx: AgentContext): string[] {
  const explicit = Array.isArray(args.assetIds) ? args.assetIds.filter(Boolean) : [];
  if (explicit.length > 0) {
    return Array.from(new Set(explicit));
  }

  const selected = ctx.tuiContext.selectedMarket;
  if (!selected) return [];
  return Array.from(new Set(selected.outcomes.map((outcome) => outcome.id).filter(Boolean)));
}

function invalidWalletResult(): ToolResult {
  return { success: false, error: "Wallet not connected. Open the wallet modal first." };
}

export async function previewOrderTool(args: z.infer<typeof PreviewOrderSchema>, _ctx: AgentContext): Promise<ToolResult> {
  const preview = await previewOrderDraft(args);
  return {
    success: preview.valid,
    data: preview,
    error: preview.valid ? undefined : preview.errors.join(" "),
  };
}

export async function prepareOrderTool(args: z.infer<typeof PrepareOrderSchema>, _ctx: AgentContext): Promise<ToolResult> {
  const preview = await previewOrderDraft(args);
  return {
    success: preview.valid,
    message: preview.valid ? "Order is valid and ready for approval." : "Order is not ready for approval.",
    data: preview,
    error: preview.valid ? undefined : preview.errors.join(" "),
  };
}

export async function placeOrderTool(args: z.infer<typeof PlaceOrderSchema>, _ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return invalidWalletResult();
  }

  const preview = await previewOrderDraft(args);
  if (!preview.valid) {
    return {
      success: false,
      data: preview,
      error: preview.errors.join(" "),
    };
  }

  const placed = await submitOrder({
    ...args,
    negRisk: args.negRisk ?? preview.quote.negRisk,
  });

  if (!placed) {
    return {
      success: false,
      data: preview,
      error: ordersState.error ?? "Order placement failed.",
    };
  }

  return {
    success: true,
    message: `Placed ${placed.side} order ${placed.orderId}`,
    data: {
      orderId: placed.orderId,
      tokenId: placed.tokenId,
      side: placed.side,
      price: placed.price,
      size: placed.originalSize,
      status: placed.status,
      marketTitle: placed.marketTitle,
      outcomeTitle: placed.outcomeTitle,
      preview,
    },
  };
}

export async function cancelOrderTool(args: z.infer<typeof CancelOrderSchema>, _ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return invalidWalletResult();
  }

  const ok = await cancelOrderById(args.orderId);
  if (!ok) {
    return {
      success: false,
      error: ordersState.error ?? `Failed to cancel order ${args.orderId}.`,
    };
  }

  return {
    success: true,
    message: `Cancelled order ${args.orderId}`,
    data: {
      orderId: args.orderId,
    },
  };
}

export async function cancelAllOrdersTool(_args: z.infer<typeof CancelAllOrdersSchema>, _ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return invalidWalletResult();
  }

  const cancelled = await cancelAllOpenOrders();
  if (cancelled === 0 && ordersState.error) {
    return {
      success: false,
      error: ordersState.error,
    };
  }

  return {
    success: true,
    message: `Cancelled ${cancelled} open order${cancelled === 1 ? "" : "s"}.`,
    data: {
      cancelled,
    },
  };
}

export async function cancelMarketOrdersTool(args: z.infer<typeof CancelMarketOrdersSchema>, ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return invalidWalletResult();
  }

  const assetIds = resolveMarketCancelAssetIds(args, ctx);
  if (assetIds.length === 0) {
    return {
      success: false,
      error: "No asset IDs were provided and no selected market is available.",
    };
  }

  const cancelled = await cancelSelectedMarketOpenOrders(assetIds);
  if (cancelled === 0 && ordersState.error) {
    return {
      success: false,
      error: ordersState.error,
    };
  }

  return {
    success: true,
    message: `Cancelled ${cancelled} open order${cancelled === 1 ? "" : "s"} for the selected market.`,
    data: {
      cancelled,
      assetIds,
    },
  };
}

export async function buildOrderToolApproval(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: AgentContext,
): Promise<{
  title: string;
  summary: string;
  warnings: string[];
  preview?: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
}> {
  switch (name) {
    case "place_order": {
      const args = PlaceOrderSchema.parse(rawArgs);
      const preview = await previewOrderDraft(args);
      return {
        title: "Approve trade",
        summary: approvalSummaryFromPreview(preview),
        warnings: preview.errors.length > 0 ? [...preview.errors, ...preview.warnings] : preview.warnings,
        preview: preview as unknown as Record<string, unknown>,
        riskLevel: approvalRiskFromPreview(preview),
      };
    }

    case "cancel_order": {
      const args = CancelOrderSchema.parse(rawArgs);
      const order = lookupOrderForCancel(args.orderId);
      return {
        title: "Approve order cancel",
        summary: order
          ? `Cancel ${order.side} ${order.originalSize.toFixed(2)} @ ${order.price.toFixed(4)} on ${order.marketTitle ?? order.tokenId}`
          : `Cancel order ${args.orderId}`,
        warnings: ["Cancels can race with late fills or already-finalized orders."],
        preview: order ? { order } : { orderId: args.orderId },
        riskLevel: "high",
      };
    }

    case "cancel_all_orders": {
      const liveOrders = ordersState.openOrders.filter((order) => (
        order.status === "LIVE" || order.status === "UNMATCHED" || order.status === "DELAYED"
      ));
      return {
        title: "Approve cancel all",
        summary: `Cancel ${liveOrders.length} currently open orders across the account.`,
        warnings: ["This affects every live order in the account, not just the selected market."],
        preview: {
          openOrders: liveOrders.map((order) => ({
            orderId: order.orderId,
            side: order.side,
            price: order.price,
            sizeRemaining: order.sizeRemaining,
            marketTitle: order.marketTitle,
          })),
        },
        riskLevel: "high",
      };
    }

    case "cancel_market_orders": {
      const args = CancelMarketOrdersSchema.parse(rawArgs);
      const assetIds = resolveMarketCancelAssetIds(args, ctx);
      return {
        title: "Approve cancel selected market orders",
        summary: `Cancel open orders for ${assetIds.length} outcome token${assetIds.length === 1 ? "" : "s"} in the selected market.`,
        warnings: ["Orders may already be partially matched by the time the cancel reaches the exchange."],
        preview: { assetIds },
        riskLevel: "high",
      };
    }

    default:
      return {
        title: "Approve action",
        summary: `Approve tool ${name}`,
        warnings: [],
        preview: rawArgs,
        riskLevel: "medium",
      };
  }
}

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "order.preview_order",
    name: "preview_order",
    category: "execution_prep",
    description: "Validate a proposed order against live Polymarket book constraints without sending it.",
    parameters: PreviewOrderSchema,
    examples: ["preview_order({ tokenId: \"1001\", side: \"BUY\", price: 0.54, shares: 25 })"],
    riskLevel: "medium",
    readOnly: true,
    requiresWallet: false,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["analyst", "trader", "operator", "safe"],
  },
  {
    id: "order.prepare_order",
    name: "prepare_order",
    category: "execution_prep",
    description: "Prepare an order for approval by validating balance, inventory, tick size, liquidity, and freshness.",
    parameters: PrepareOrderSchema,
    examples: ["prepare_order({ tokenId: \"1001\", side: \"SELL\", price: 0.61, shares: 10 })"],
    riskLevel: "medium",
    readOnly: true,
    requiresWallet: false,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["trader", "operator", "safe"],
  },
  {
    id: "order.place_order",
    name: "place_order",
    category: "execution",
    description: "Send a real Polymarket order after approval.",
    parameters: PlaceOrderSchema,
    examples: ["place_order({ tokenId: \"1001\", side: \"BUY\", price: 0.54, shares: 25 })"],
    riskLevel: "critical",
    readOnly: false,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: true,
    executesTrade: true,
    mutatesUi: false,
    enabledModes: ["trader"],
  },
  {
    id: "order.cancel_order",
    name: "cancel_order",
    category: "execution",
    description: "Cancel one live order after approval.",
    parameters: CancelOrderSchema,
    examples: ["cancel_order({ orderId: \"0xabc\" })"],
    riskLevel: "high",
    readOnly: false,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: true,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["trader", "operator"],
  },
  {
    id: "order.cancel_all_orders",
    name: "cancel_all_orders",
    category: "execution",
    description: "Cancel all currently open orders after approval.",
    parameters: CancelAllOrdersSchema,
    examples: ["cancel_all_orders({})"],
    riskLevel: "high",
    readOnly: false,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: true,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["trader", "operator"],
  },
  {
    id: "order.cancel_market_orders",
    name: "cancel_market_orders",
    category: "execution",
    description: "Cancel all open orders for the selected market after approval.",
    parameters: CancelMarketOrdersSchema,
    examples: ["cancel_market_orders({ assetIds: [\"1001\", \"1002\"] })"],
    riskLevel: "high",
    readOnly: false,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: true,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["trader", "operator"],
  },
];

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  preview_order: async (args, ctx) => previewOrderTool(PreviewOrderSchema.parse(args), ctx),
  prepare_order: async (args, ctx) => prepareOrderTool(PrepareOrderSchema.parse(args), ctx),
  place_order: async (args, ctx) => placeOrderTool(PlaceOrderSchema.parse(args), ctx),
  cancel_order: async (args, ctx) => cancelOrderTool(CancelOrderSchema.parse(args), ctx),
  cancel_all_orders: async (args, ctx) => cancelAllOrdersTool(CancelAllOrdersSchema.parse(args), ctx),
  cancel_market_orders: async (args, ctx) => cancelMarketOrdersTool(CancelMarketOrdersSchema.parse(args), ctx),
};
