/**
 * Portfolio tools - balances, positions, open orders, and trade history.
 */

import { z } from "zod";
import { getTradingBalance, walletState } from "../../state";
import { ordersState } from "../../hooks/useOrders";
import { fetchUserPositions, positionsState } from "../../hooks/usePositions";
import { fetchOpenOrders, fetchTradeHistory } from "../../api/orders";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

export const GetPortfolioSchema = z.object({});
export const GetBalanceSchema = z.object({});
export const GetPositionsDetailsSchema = z.object({});
export const GetTradeHistorySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(25).describe("Maximum trades to return"),
});
export const GetOpenOrdersSchema = z.object({});

function getReservedBuyCollateral(): number {
  return ordersState.openOrders.reduce((total, order) => {
    if (order.side !== "BUY") return total;
    if (!(order.status === "LIVE" || order.status === "UNMATCHED" || order.status === "DELAYED")) return total;
    return total + order.price * Math.max(order.sizeRemaining, 0);
  }, 0);
}

function getPositionsDetails() {
  const positions = positionsState.positions || [];
  let totalPnl = 0;

  const detailed = positions.map((position) => {
    const size = position.size || 0;
    const avgPrice = position.avgPrice || 0;
    const currentPrice = position.curPrice || avgPrice;
    const pnl = position.cashPnl || 0;
    const pnlPercent = position.percentPnl || 0;

    totalPnl += pnl;

    return {
      tokenId: position.asset,
      outcomeTitle: position.outcome || "Unknown",
      marketTitle: position.title || "Unknown",
      size,
      avgPrice,
      currentPrice,
      currentValue: position.currentValue || size * currentPrice,
      pnl,
      pnlPercent,
    };
  });

  return { positions: detailed, totalPnl };
}

export async function getPortfolioTool(_args: z.infer<typeof GetPortfolioSchema>, _ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Open the wallet modal first." };
  }

  await fetchUserPositions();
  const details = getPositionsDetails();
  const reservedCollateral = getReservedBuyCollateral();

  return {
    success: true,
    data: {
      positionsCount: details.positions.length,
      totalPnl: details.totalPnl,
      reservedBuyCollateral: reservedCollateral,
      availableToDeploy: Math.max(0, getTradingBalance() - reservedCollateral),
      positions: details.positions,
    },
  };
}

export async function getBalanceTool(_args: z.infer<typeof GetBalanceSchema>, _ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Open the wallet modal first." };
  }

  const reservedCollateral = getReservedBuyCollateral();

  return {
    success: true,
    data: {
      address: walletState.address,
      funderAddress: walletState.funderAddress ?? null,
      balance: getTradingBalance(),
      reservedBuyCollateral: reservedCollateral,
      availableToDeploy: Math.max(0, getTradingBalance() - reservedCollateral),
    },
  };
}

export async function getPositionsDetailsTool(_args: z.infer<typeof GetPositionsDetailsSchema>, _ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Open the wallet modal first." };
  }

  await fetchUserPositions();
  const details = getPositionsDetails();

  return {
    success: true,
    data: {
      count: details.positions.length,
      totalPnl: details.totalPnl,
      positions: details.positions,
    },
  };
}

export async function getTradeHistoryTool(args: z.infer<typeof GetTradeHistorySchema>, _ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Open the wallet modal first." };
  }

  const trades = await fetchTradeHistory();

  return {
    success: true,
    data: {
      count: trades.length,
      trades: trades.slice(0, args.limit ?? 25).map((trade) => ({
        orderId: trade.orderId,
        tokenId: trade.tokenId,
        side: trade.side,
        price: trade.price,
        size: trade.originalSize,
        status: trade.status,
        createdAt: new Date(trade.createdAt).toISOString(),
        marketTitle: trade.marketTitle,
        outcomeTitle: trade.outcomeTitle,
      })),
    },
  };
}

export async function getOpenOrdersTool(_args: z.infer<typeof GetOpenOrdersSchema>, _ctx: AgentContext): Promise<ToolResult> {
  if (!walletState.connected) {
    return { success: false, error: "Wallet not connected. Open the wallet modal first." };
  }

  const orders = await fetchOpenOrders();

  return {
    success: true,
    data: {
      count: orders.length,
      reservedBuyCollateral: getReservedBuyCollateral(),
      orders: orders.map((order) => ({
        orderId: order.orderId,
        tokenId: order.tokenId,
        side: order.side,
        price: order.price,
        size: order.originalSize,
        sizeMatched: order.sizeMatched,
        sizeRemaining: order.sizeRemaining,
        status: order.status,
        createdAt: new Date(order.createdAt).toISOString(),
        marketTitle: order.marketTitle,
        outcomeTitle: order.outcomeTitle,
      })),
    },
  };
}

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "portfolio.get_portfolio",
    name: "get_portfolio",
    category: "portfolio",
    description: "Load current positions and summarize deployable capital and realized exposure.",
    parameters: GetPortfolioSchema,
    examples: ["get_portfolio({})"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["analyst", "trader", "operator", "safe"],
  },
  {
    id: "portfolio.get_balance",
    name: "get_balance",
    category: "portfolio",
    description: "Show trading balance, reserved collateral, and currently deployable USDC.",
    parameters: GetBalanceSchema,
    examples: ["get_balance({})"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["analyst", "trader", "operator", "safe"],
  },
  {
    id: "portfolio.get_positions_details",
    name: "get_positions_details",
    category: "portfolio",
    description: "Inspect positions with size, basis, current value, and PnL.",
    parameters: GetPositionsDetailsSchema,
    examples: ["get_positions_details({})"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["analyst", "trader", "operator", "safe"],
  },
  {
    id: "portfolio.get_trade_history",
    name: "get_trade_history",
    category: "portfolio",
    description: "Inspect recent confirmed trade history from Polymarket.",
    parameters: GetTradeHistorySchema,
    examples: ["get_trade_history({ limit: 10 })"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["trader", "operator", "safe"],
  },
  {
    id: "portfolio.get_open_orders",
    name: "get_open_orders",
    category: "portfolio",
    description: "Inspect open orders and collateral currently locked by resting bids.",
    parameters: GetOpenOrdersSchema,
    examples: ["get_open_orders({})"],
    riskLevel: "low",
    readOnly: true,
    requiresWallet: true,
    requiresSelectedMarket: false,
    requiresConfirmation: false,
    executesTrade: false,
    mutatesUi: false,
    enabledModes: ["trader", "operator", "safe"],
  },
];

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  get_portfolio: async (args, ctx) => getPortfolioTool(GetPortfolioSchema.parse(args), ctx),
  get_balance: async (args, ctx) => getBalanceTool(GetBalanceSchema.parse(args), ctx),
  get_positions_details: async (args, ctx) => getPositionsDetailsTool(GetPositionsDetailsSchema.parse(args), ctx),
  get_trade_history: async (args, ctx) => getTradeHistoryTool(GetTradeHistorySchema.parse(args), ctx),
  get_open_orders: async (args, ctx) => getOpenOrdersTool(GetOpenOrdersSchema.parse(args), ctx),
};
