/**
 * Enterprise Order Management System (OMS)
 * 
 * Core trading infrastructure with:
 * - Order lifecycle state machine
 * - Position tracking with real-time P&L
 * - Risk engine with configurable limits
 * - Order matching simulation
 * - Performance analytics
 */

import { createStore, produce } from "solid-js/store";
import { createSignal, batch } from "solid-js";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type OrderLifecycleStatus =
  | "PENDING"           // Order created, not yet submitted
  | "SUBMITTED"        // Sent to exchange, awaiting response
  | "ACCEPTED"         // Exchange accepted, in order book
  | "PARTIALLY_FILLED" // Some shares filled
  | "FILLED"           // All shares filled
  | "CANCELLED"        // User cancelled
  | "REJECTED"         // Exchange rejected
  | "EXPIRED"          // Time-in-force expired
  | "FAILED";          // Network/system error

export type OrderType =
  | "MARKET"           // Immediate execution at best price
  | "LIMIT"            // Execute at price or better
  | "STOP"             // Trigger when price crosses threshold
  | "STOP_LIMIT"       // Stop + limit price
  | "TWAP"             // Time-Weighted Average Price
  | "VWAP"             // Volume-Weighted Average Price
  | "ICEBERG"          // Hidden size, reveal gradually
  | "SMART_ROUTE";     // Intelligent order routing

export type TimeInForce = "GTC" | "IOC" | "FOK" | "GTD" | "PO";

export interface OrderEvent {
  orderId: string;
  timestamp: number;
  type: "CREATED" | "SUBMITTED" | "ACCEPTED" | "PARTIAL_FILL" | "FILLED" | "CANCELLED" | "REJECTED" | "EXPIRED";
  details?: Record<string, unknown>;
}

export interface OrderCore {
  orderId: string;
  clientOrderId: string;
  marketId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  type: OrderType;
  timeInForce: TimeInForce;
  price: number;
  size: number;
  filledSize: number;
  remainingSize: number;
  avgFillPrice: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  status: OrderLifecycleStatus;
  fills: Fill[];
  events: OrderEvent[];
}

export interface Fill {
  fillId: string;
  timestamp: number;
  price: number;
  size: number;
  fee: number;
  liquidity: "MAKER" | "TAKER";
}

export interface Position {
  tokenId: string;
  marketId: string;
  outcome: string;
  marketTitle: string;
  
  // Size tracking
  grossSize: number;        // Total shares (positive = long, negative = short)
  netSize: number;          // Net position after all fills
  
  // Cost tracking
  avgEntryPrice: number;    // Weighted average entry price
  totalCost: number;        // Total cost basis
  realizedPnL: number;      // Realized P&L from closed positions
  
  // Current state
  currentPrice: number;     // Mark-to-market price
  marketValue: number;      // Current market value
  unrealizedPnL: number;    // Unrealized P&L
  totalPnL: number;         // Total P&L (realized + unrealized)
  
  // Position metadata
  entryTimestamp: number;
  lastUpdateTimestamp: number;
  
  // Risk metrics
  maxAdverseExcursion: number; // Worst price before recovery
  maxFavorableExcursion: number; // Best price achieved
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalPnL: number;
  
  // Position metrics
  positionCount: number;
  longCount: number;
  shortCount: number;
  flatCount: number;
  
  // Risk metrics
  var95: number;            // Value at Risk (95%)
  expectedShortfall: number; // CVaR
  maxDrawdown: number;      // Peak-to-trough
  
  // Performance
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Engine Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RiskLimits {
  // Position limits
  maxPositionSize: number;      // Max shares per position
  maxPositionValue: number;      // Max value per position (USDC)
  maxPositions: number;         // Max number of open positions
  
  // Order limits
  maxOrderSize: number;         // Max order size
  maxOrderValue: number;        // Max order value
  maxOrdersPerMinute: number;    // Order rate limit
  
  // Portfolio limits
  maxPortfolioValue: number;     // Max portfolio exposure
  maxLossPerDay: number;        // Daily loss limit
  maxLossPerWeek: number;       // Weekly loss limit
  
  // Price limits
  maxSlippageBps: number;       // Max acceptable slippage (basis points)
  maxDeviationFromMarket: number; // Max deviation from current price
  
  // Concentration limits
  maxConcentrationPct: number;   // Max % in single position
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  severity: "NONE" | "WARNING" | "BLOCK";
  blockedBy?: keyof RiskLimits;
}

export interface RiskMetrics {
  portfolioVaR: number;
  portfolioDelta: number;
  portfolioGamma: number;
  portfolioTheta: number;
  exposureByCategory: Map<string, number>;
  exposureByMarket: Map<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Risk Limits
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSize: 1_000_000,
  maxPositionValue: 50_000,
  maxPositions: 50,
  maxOrderSize: 500_000,
  maxOrderValue: 25_000,
  maxOrdersPerMinute: 60,
  maxPortfolioValue: 500_000,
  maxLossPerDay: 10_000,
  maxLossPerWeek: 25_000,
  maxSlippageBps: 100, // 1%
  maxDeviationFromMarket: 0.05, // 5%
  maxConcentrationPct: 0.2, // 20%
};

// ─────────────────────────────────────────────────────────────────────────────
// Order ID Generator
// ─────────────────────────────────────────────────────────────────────────────

let orderSequence = 0;
let sessionStart = Date.now();

export function generateOrderId(): string {
  orderSequence++;
  const sessionMs = Date.now() - sessionStart;
  return `ORD-${sessionMs.toString(36).toUpperCase()}-${orderSequence.toString(36).toUpperCase()}`;
}

export function generateClientOrderId(): string {
  return `C${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Lifecycle State Machine
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<OrderLifecycleStatus, OrderLifecycleStatus[]> = {
  PENDING: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["ACCEPTED", "REJECTED", "FAILED", "CANCELLED"],
  ACCEPTED: ["PARTIALLY_FILLED", "FILLED", "CANCELLED", "EXPIRED"],
  PARTIALLY_FILLED: ["PARTIALLY_FILLED", "FILLED", "CANCELLED", "EXPIRED"],
  FILLED: [], // Terminal state
  CANCELLED: [], // Terminal state
  REJECTED: [], // Terminal state
  EXPIRED: [], // Terminal state
  FAILED: [], // Terminal state
};

export function canTransition(from: OrderLifecycleStatus, to: OrderLifecycleStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionOrder(
  order: OrderCore,
  newStatus: OrderLifecycleStatus,
  details?: Record<string, unknown>
): OrderCore {
  if (!canTransition(order.status, newStatus)) {
    console.warn(`Invalid transition: ${order.status} -> ${newStatus}`);
    return order;
  }

  const event: OrderEvent = {
    orderId: order.orderId,
    timestamp: Date.now(),
    type: statusToEventType(newStatus),
    details,
  };

  return {
    ...order,
    status: newStatus,
    updatedAt: Date.now(),
    events: [...order.events, event],
  };
}

function statusToEventType(status: OrderLifecycleStatus): OrderEvent["type"] {
  switch (status) {
    case "PENDING": return "CREATED";
    case "SUBMITTED": return "SUBMITTED";
    case "ACCEPTED": return "ACCEPTED";
    case "PARTIALLY_FILLED": return "PARTIAL_FILL";
    case "FILLED": return "FILLED";
    case "CANCELLED": return "CANCELLED";
    case "REJECTED": return "REJECTED";
    case "EXPIRED": return "EXPIRED";
    case "FAILED": return "REJECTED";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OMS State Store
// ─────────────────────────────────────────────────────────────────────────────

export interface OMSState {
  // Orders
  orders: Map<string, OrderCore>;
  ordersByMarket: Map<string, Set<string>>;
  ordersByToken: Map<string, Set<string>>;
  
  // Positions
  positions: Map<string, Position>;
  
  // Risk
  riskLimits: RiskLimits;
  currentRiskMetrics: RiskMetrics | null;
  
  // Performance tracking
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  
  // Rate limiting
  orderCountMinute: number;
  lastOrderMinuteTs: number;
  
  // Statistics
  totalOrders: number;
  filledOrders: number;
  cancelledOrders: number;
  rejectedOrders: number;
}

function createInitialOMSState(): OMSState {
  return {
    orders: new Map(),
    ordersByMarket: new Map(),
    ordersByToken: new Map(),
    positions: new Map(),
    riskLimits: { ...DEFAULT_RISK_LIMITS },
    currentRiskMetrics: null,
    dailyPnL: 0,
    weeklyPnL: 0,
    monthlyPnL: 0,
    orderCountMinute: 0,
    lastOrderMinuteTs: Date.now(),
    totalOrders: 0,
    filledOrders: 0,
    cancelledOrders: 0,
    rejectedOrders: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OMS Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class OrderManagementSystem {
  private state: OMSState;
  private listeners = new Set<(state: OMSState) => void>();
  private riskOverride = false;

  constructor(initialLimits?: Partial<RiskLimits>) {
    this.state = createInitialOMSState();
    if (initialLimits) {
      this.state.riskLimits = { ...DEFAULT_RISK_LIMITS, ...initialLimits };
    }
  }

  // ─── State Access ───────────────────────────────────────────────────────────

  getState(): OMSState {
    return this.state;
  }

  getOrder(orderId: string): OrderCore | undefined {
    return this.state.orders.get(orderId);
  }

  getOrdersForMarket(marketId: string): OrderCore[] {
    const orderIds = this.state.ordersByMarket.get(marketId);
    if (!orderIds) return [];
    return Array.from(orderIds)
      .map((id) => this.state.orders.get(id))
      .filter((o): o is OrderCore => o !== undefined);
  }

  getOrdersForToken(tokenId: string): OrderCore[] {
    const orderIds = this.state.ordersByToken.get(tokenId);
    if (!orderIds) return [];
    return Array.from(orderIds)
      .map((id) => this.state.orders.get(id))
      .filter((o): o is OrderCore => o !== undefined);
  }

  getOpenOrders(): OrderCore[] {
    return Array.from(this.state.orders.values()).filter(
      (o) => !["FILLED", "CANCELLED", "REJECTED", "EXPIRED", "FAILED"].includes(o.status)
    );
  }

  getPosition(tokenId: string): Position | undefined {
    return this.state.positions.get(tokenId);
  }

  getAllPositions(): Position[] {
    return Array.from(this.state.positions.values());
  }

  // ─── Order Operations ───────────────────────────────────────────────────────

  createOrder(params: {
    marketId: string;
    tokenId: string;
    side: "BUY" | "SELL";
    type: OrderType;
    timeInForce: TimeInForce;
    price: number;
    size: number;
    clientOrderId?: string;
    expiresAt?: number;
  }): OrderCore {
    const order: OrderCore = {
      orderId: generateOrderId(),
      clientOrderId: params.clientOrderId ?? generateClientOrderId(),
      marketId: params.marketId,
      tokenId: params.tokenId,
      side: params.side,
      type: params.type,
      timeInForce: params.timeInForce,
      price: params.price,
      size: params.size,
      filledSize: 0,
      remainingSize: params.size,
      avgFillPrice: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: params.expiresAt ?? null,
      status: "PENDING",
      fills: [],
      events: [{
        orderId: generateOrderId(),
        timestamp: Date.now(),
        type: "CREATED",
        details: { size: params.size, price: params.price },
      }],
    };

    // Add to tracking maps
    this.state.orders.set(order.orderId, order);
    
    if (!this.state.ordersByMarket.has(params.marketId)) {
      this.state.ordersByMarket.set(params.marketId, new Set());
    }
    this.state.ordersByMarket.get(params.marketId)!.add(order.orderId);
    
    if (!this.state.ordersByToken.has(params.tokenId)) {
      this.state.ordersByToken.set(params.tokenId, new Set());
    }
    this.state.ordersByToken.get(params.tokenId)!.add(order.orderId);

    this.state.totalOrders++;
    this.notifyListeners();
    return order;
  }

  submitOrder(orderId: string): OrderCore | undefined {
    const order = this.state.orders.get(orderId);
    if (!order) return undefined;

    const updated = transitionOrder(order, "SUBMITTED");
    this.state.orders.set(orderId, updated);
    this.notifyListeners();
    return updated;
  }

  acceptOrder(orderId: string): OrderCore | undefined {
    const order = this.state.orders.get(orderId);
    if (!order) return undefined;

    const updated = transitionOrder(order, "ACCEPTED");
    this.state.orders.set(orderId, updated);
    this.notifyListeners();
    return updated;
  }

  fillOrder(orderId: string, fill: Omit<Fill, "fillId">): OrderCore | undefined {
    const order = this.state.orders.get(orderId);
    if (!order) return undefined;

    const fullFill: Fill = {
      ...fill,
      fillId: `FILL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    // Update order fill tracking
    const newFilledSize = order.filledSize + fill.size;
    const newRemainingSize = order.size - newFilledSize;
    const newAvgPrice = order.avgFillPrice === 0
      ? fill.price
      : (order.avgFillPrice * order.filledSize + fill.price * fill.size) / newFilledSize;

    let newStatus: OrderLifecycleStatus;
    if (newRemainingSize <= 0) {
      newStatus = "FILLED";
      this.state.filledOrders++;
    } else {
      newStatus = "PARTIALLY_FILLED";
    }

    const updated: OrderCore = {
      ...order,
      filledSize: newFilledSize,
      remainingSize: Math.max(0, newRemainingSize),
      avgFillPrice: newAvgPrice,
      status: newStatus,
      updatedAt: Date.now(),
      fills: [...order.fills, fullFill],
      events: [...order.events, {
        orderId: order.orderId,
        timestamp: Date.now(),
        type: newStatus === "FILLED" ? "FILLED" : "PARTIAL_FILL",
        details: { fillSize: fill.size, fillPrice: fill.price },
      }],
    };

    this.state.orders.set(orderId, updated);
    
    // Update position
    this.updatePositionFromFill(order.tokenId, order.side, fill.size, fill.price, fill.fee);

    this.notifyListeners();
    return updated;
  }

  cancelOrder(orderId: string, reason?: string): OrderCore | undefined {
    const order = this.state.orders.get(orderId);
    if (!order) return undefined;

    if (["FILLED", "CANCELLED", "REJECTED", "EXPIRED", "FAILED"].includes(order.status)) {
      return order; // Cannot cancel terminal orders
    }

    const updated = transitionOrder(order, "CANCELLED", { reason });
    this.state.orders.set(orderId, updated);
    this.state.cancelledOrders++;
    this.notifyListeners();
    return updated;
  }

  rejectOrder(orderId: string, reason: string): OrderCore | undefined {
    const order = this.state.orders.get(orderId);
    if (!order) return undefined;

    const updated = transitionOrder(order, "REJECTED", { reason });
    this.state.orders.set(orderId, updated);
    this.state.rejectedOrders++;
    this.notifyListeners();
    return updated;
  }

  expireOrder(orderId: string): OrderCore | undefined {
    const order = this.state.orders.get(orderId);
    if (!order) return undefined;

    const updated = transitionOrder(order, "EXPIRED");
    this.state.orders.set(orderId, updated);
    this.notifyListeners();
    return updated;
  }

  // ─── Position Management ────────────────────────────────────────────────────

  private updatePositionFromFill(
    tokenId: string,
    side: "BUY" | "SELL",
    fillSize: number,
    fillPrice: number,
    fee: number
  ): void {
    let position = this.state.positions.get(tokenId);
    
    if (!position) {
      position = {
        tokenId,
        marketId: "", // Would be populated from market data
        outcome: "",
        marketTitle: "",
        grossSize: 0,
        netSize: 0,
        avgEntryPrice: 0,
        totalCost: 0,
        realizedPnL: 0,
        currentPrice: fillPrice,
        marketValue: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        entryTimestamp: Date.now(),
        lastUpdateTimestamp: Date.now(),
        maxAdverseExcursion: 0,
        maxFavorableExcursion: 0,
      };
      this.state.positions.set(tokenId, position);
    }

    const signedSize = side === "BUY" ? fillSize : -fillSize;
    const newGrossSize = position.grossSize + signedSize;
    const newNetSize = position.netSize + signedSize;

    // Update cost basis
    const newTotalCost = position.totalCost + fillSize * fillPrice + fee;
    const newAvgEntry = newNetSize !== 0 ? newTotalCost / Math.abs(newNetSize) : 0;

    // Calculate realized P&L for any closed positions
    let realizedPnLCorrection = 0;
    if (side === "SELL" && position.grossSize > 0) {
      // Closing long position
      const closedSize = Math.min(fillSize, position.grossSize);
      realizedPnLCorrection = (fillPrice - position.avgEntryPrice) * closedSize;
    } else if (side === "BUY" && position.grossSize < 0) {
      // Closing short position
      const closedSize = Math.min(fillSize, Math.abs(position.grossSize));
      realizedPnLCorrection = (position.avgEntryPrice - fillPrice) * closedSize;
    }

    // Update MAE/MFE
    const mae = Math.min(position.maxAdverseExcursion, fillPrice - position.avgEntryPrice);
    const mfe = Math.max(position.maxFavorableExcursion, fillPrice - position.avgEntryPrice);

    this.state.positions.set(tokenId, {
      ...position,
      grossSize: newGrossSize,
      netSize: newNetSize,
      avgEntryPrice: newAvgEntry,
      totalCost: newTotalCost,
      realizedPnL: position.realizedPnL + realizedPnLCorrection,
      lastUpdateTimestamp: Date.now(),
      maxAdverseExcursion: mae,
      maxFavorableExcursion: mfe,
    });
  }

  updatePositionPrice(tokenId: string, currentPrice: number): void {
    const position = this.state.positions.get(tokenId);
    if (!position) return;

    const marketValue = position.netSize * currentPrice;
    const unrealizedPnL = position.netSize > 0
      ? (currentPrice - position.avgEntryPrice) * position.netSize
      : (position.avgEntryPrice - currentPrice) * Math.abs(position.netSize);

    this.state.positions.set(tokenId, {
      ...position,
      currentPrice,
      marketValue,
      unrealizedPnL,
      totalPnL: position.realizedPnL + unrealizedPnL,
    });

    this.notifyListeners();
  }

  // ─── Risk Engine ────────────────────────────────────────────────────────────

  checkRisk(order: {
    tokenId: string;
    side: "BUY" | "SELL";
    size: number;
    price: number;
  }): RiskCheckResult {
    if (this.riskOverride) {
      return { allowed: true, severity: "NONE" };
    }

    const limits = this.state.riskLimits;

    // Check order size
    if (order.size > limits.maxOrderSize) {
      return {
        allowed: false,
        reason: `Order size ${order.size} exceeds maximum ${limits.maxOrderSize}`,
        severity: "BLOCK",
        blockedBy: "maxOrderSize",
      };
    }

    // Check order value
    const orderValue = order.size * order.price;
    if (orderValue > limits.maxOrderValue) {
      return {
        allowed: false,
        reason: `Order value ${orderValue.toFixed(2)} exceeds maximum ${limits.maxOrderValue}`,
        severity: "BLOCK",
        blockedBy: "maxOrderValue",
      };
    }

    // Check rate limit
    const now = Date.now();
    if (now - this.state.lastOrderMinuteTs > 60_000) {
      this.state.orderCountMinute = 0;
      this.state.lastOrderMinuteTs = now;
    }
    if (this.state.orderCountMinute >= limits.maxOrdersPerMinute) {
      return {
        allowed: false,
        reason: `Order rate limit exceeded (${limits.maxOrdersPerMinute}/min)`,
        severity: "BLOCK",
        blockedBy: "maxOrdersPerMinute",
      };
    }

    // Check position limit
    const existingPosition = this.state.positions.get(order.tokenId);
    if (existingPosition) {
      const newSize = existingPosition.netSize + (order.side === "BUY" ? order.size : -order.size);
      const maxPositionSize = limits.maxPositionSize;
      const maxPositionValue = limits.maxPositionValue;

      if (Math.abs(newSize) > maxPositionSize) {
        return {
          allowed: false,
          reason: `Position size ${Math.abs(newSize)} would exceed maximum ${maxPositionSize}`,
          severity: "BLOCK",
          blockedBy: "maxPositionSize",
        };
      }

      if (Math.abs(newSize * order.price) > maxPositionValue) {
        return {
          allowed: false,
          reason: `Position value would exceed maximum ${maxPositionValue}`,
          severity: "BLOCK",
          blockedBy: "maxPositionValue",
        };
      }
    }

    // Check concentration
    const totalPositionValue = this.calculateTotalPositionValue();
    const newPositionPct = (order.size * order.price) / totalPositionValue;
    if (newPositionPct > limits.maxConcentrationPct) {
      return {
        allowed: false,
        reason: `Position would be ${(newPositionPct * 100).toFixed(1)}% of portfolio, exceeds ${(limits.maxConcentrationPct * 100).toFixed(0)}% limit`,
        severity: "BLOCK",
        blockedBy: "maxConcentrationPct",
      };
    }

    // Check daily loss limit
    if (this.state.dailyPnL < -limits.maxLossPerDay) {
      return {
        allowed: false,
        reason: `Daily loss limit reached (${this.state.dailyPnL.toFixed(2)} < -${limits.maxLossPerDay})`,
        severity: "BLOCK",
        blockedBy: "maxLossPerDay",
      };
    }

    // Check weekly loss limit
    if (this.state.weeklyPnL < -limits.maxLossPerWeek) {
      return {
        allowed: false,
        reason: `Weekly loss limit reached`,
        severity: "BLOCK",
        blockedBy: "maxLossPerWeek",
      };
    }

    // Warning for large orders
    if (order.size > limits.maxOrderSize * 0.8) {
      return {
        allowed: true,
        reason: `Large order (${order.size} shares)`,
        severity: "WARNING",
      };
    }

    return { allowed: true, severity: "NONE" };
  }

  private calculateTotalPositionValue(): number {
    let total = 0;
    for (const pos of this.state.positions.values()) {
      total += Math.abs(pos.netSize * pos.currentPrice);
    }
    return total || 1; // Avoid division by zero
  }

  updateRiskLimits(limits: Partial<RiskLimits>): void {
    this.state.riskLimits = { ...this.state.riskLimits, ...limits };
    this.notifyListeners();
  }

  setRiskOverride(override: boolean): void {
    this.riskOverride = override;
    this.notifyListeners();
  }

  // ─── Portfolio Metrics ──────────────────────────────────────────────────────

  getPortfolioSummary(): PortfolioSummary {
    let totalValue = 0;
    let totalCost = 0;
    let totalRealizedPnL = 0;
    let totalUnrealizedPnL = 0;
    let longCount = 0;
    let shortCount = 0;
    let flatCount = 0;

    for (const pos of this.state.positions.values()) {
      totalValue += Math.abs(pos.marketValue);
      totalCost += pos.totalCost;
      totalRealizedPnL += pos.realizedPnL;
      totalUnrealizedPnL += pos.unrealizedPnL;

      if (pos.netSize > 0) longCount++;
      else if (pos.netSize < 0) shortCount++;
      else flatCount++;
    }

    const totalPnL = totalRealizedPnL + totalUnrealizedPnL;

    // Calculate simple VaR (using position sizes as approximation)
    const sortedPositions = Array.from(this.state.positions.values())
      .filter((p) => p.netSize !== 0)
      .sort((a, b) => b.marketValue - a.marketValue);
    
    const var95 = totalValue * 0.02; // Simplified 2% VaR
    const expectedShortfall = totalValue * 0.03; // Simplified CVaR

    return {
      totalValue,
      totalCost,
      totalRealizedPnL,
      totalUnrealizedPnL,
      totalPnL,
      positionCount: this.state.positions.size,
      longCount,
      shortCount,
      flatCount,
      var95,
      expectedShortfall,
      maxDrawdown: 0, // Would need historical data
      winRate: this.state.filledOrders > 0 
        ? (this.state.filledOrders - this.state.cancelledOrders) / this.state.filledOrders 
        : 0,
      profitFactor: totalRealizedPnL > 0 ? 1 + (totalRealizedPnL / totalCost) : 0,
      sharpeRatio: 0, // Would need historical returns
    };
  }

  // ─── Event Subscription ─────────────────────────────────────────────────────

  subscribe(listener: (state: OMSState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  toJSON(): object {
    return {
      positions: Array.from(this.state.positions.entries()),
      dailyPnL: this.state.dailyPnL,
      weeklyPnL: this.state.weeklyPnL,
      monthlyPnL: this.state.monthlyPnL,
      riskLimits: this.state.riskLimits,
      statistics: {
        totalOrders: this.state.totalOrders,
        filledOrders: this.state.filledOrders,
        cancelledOrders: this.state.cancelledOrders,
        rejectedOrders: this.state.rejectedOrders,
      },
    };
  }

  loadFromJSON(data: {
    positions?: [string, Position][];
    dailyPnL?: number;
    weeklyPnL?: number;
    monthlyPnL?: number;
    riskLimits?: RiskLimits;
    statistics?: {
      totalOrders?: number;
      filledOrders?: number;
      cancelledOrders?: number;
      rejectedOrders?: number;
    };
  }): void {
    if (data.positions) {
      this.state.positions = new Map(data.positions as [string, Position][]);
    }
    this.state.dailyPnL = data.dailyPnL ?? 0;
    this.state.weeklyPnL = data.weeklyPnL ?? 0;
    this.state.monthlyPnL = data.monthlyPnL ?? 0;
    this.state.riskLimits = data.riskLimits ?? { ...DEFAULT_RISK_LIMITS };
    if (data.statistics) {
      this.state.totalOrders = data.statistics.totalOrders ?? 0;
      this.state.filledOrders = data.statistics.filledOrders ?? 0;
      this.state.cancelledOrders = data.statistics.cancelledOrders ?? 0;
      this.state.rejectedOrders = data.statistics.rejectedOrders ?? 0;
    }
    this.notifyListeners();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global OMS Instance
// ─────────────────────────────────────────────────────────────────────────────

let globalOMS: OrderManagementSystem | null = null;

export function getOMS(): OrderManagementSystem {
  if (!globalOMS) {
    globalOMS = new OrderManagementSystem();
  }
  return globalOMS;
}

export function createOMS(limits?: Partial<RiskLimits>): OrderManagementSystem {
  globalOMS = new OrderManagementSystem(limits);
  return globalOMS;
}

// ─────────────────────────────────────────────────────────────────────────────
// SolidJS Store Bridge
// ─────────────────────────────────────────────────────────────────────────────

export interface OMSSignals {
  orders: () => OrderCore[];
  positions: () => Position[];
  portfolio: () => PortfolioSummary;
  openOrderCount: () => number;
  riskBreached: () => boolean;
}

export function useOMS(oms: OrderManagementSystem): OMSSignals {
  const [ordersSignal, setOrdersSignal] = createSignal<OrderCore[]>([]);
  const [positionsSignal, setPositionsSignal] = createSignal<Position[]>([]);
  const [portfolioSignal, setPortfolioSignal] = createSignal<PortfolioSummary>({
    totalValue: 0,
    totalCost: 0,
    totalRealizedPnL: 0,
    totalUnrealizedPnL: 0,
    totalPnL: 0,
    positionCount: 0,
    longCount: 0,
    shortCount: 0,
    flatCount: 0,
    var95: 0,
    expectedShortfall: 0,
    maxDrawdown: 0,
    winRate: 0,
    profitFactor: 0,
    sharpeRatio: 0,
  });

  // Subscribe to OMS updates
  oms.subscribe((state) => {
    batch(() => {
      setOrdersSignal(Array.from(state.orders.values()));
      setPositionsSignal(Array.from(state.positions.values()));
      setPortfolioSignal(oms.getPortfolioSummary());
    });
  });

  return {
    orders: ordersSignal,
    positions: positionsSignal,
    portfolio: portfolioSignal,
    openOrderCount: () => oms.getOpenOrders().length,
    riskBreached: () => {
      const s = oms.getState();
      return s.dailyPnL < -s.riskLimits.maxLossPerDay;
    },
  };
}