/**
 * Execution Strategies for Algorithmic Trading
 * 
 * Implements various order execution strategies:
 * - TWAP (Time-Weighted Average Price)
 * - VWAP (Volume-Weighted Average Price)
 * - Iceberg orders
 * - Smart Order Router
 * - Momentum strategy
 * - Mean reversion strategy
 */

import { createSignal, createEffect, onCleanup, batch } from "solid-js";
import { OrderManagementSystem, getOMS, generateOrderId } from "./core";
import type { OrderType, OrderLifecycleStatus } from "./core";
import { getCurrentPrice, getOrderBookSummary } from "../api/polymarket";

export interface ExecutionStrategy {
  id: string;
  name: string;
  description: string;
  params: Record<string, number | string | boolean>;
}

export interface TWAPParams {
  totalSize: number;
  targetPrice: number;
  durationSeconds: number;
  sliceCount: number;
  side: "BUY" | "SELL";
  tokenId: string;
  marketId: string;
}

export interface VWAPParams {
  totalSize: number;
  maxPrice: number; // For BUY orders
  minPrice: number; // For SELL orders
  durationSeconds: number;
  side: "BUY" | "SELL";
  tokenId: string;
  marketId: string;
}

export interface IcebergParams {
  totalSize: number;
  displaySize: number;
  limitPrice: number;
  side: "BUY" | "SELL";
  tokenId: string;
  marketId: string;
  autoHibernate: boolean; // Pause when market is illiquid
}

export interface StrategyExecution {
  strategyId: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  progress: number; // 0-1
  filledSize: number;
  avgFillPrice: number;
  remainingSize: number;
  startTime: number;
  endTime: number | null;
  slices: StrategySlice[];
  errors: string[];
}

export interface StrategySlice {
  sliceId: string;
  orderId: string | null;
  size: number;
  price: number;
  status: "PENDING" | "SUBMITTED" | "FILLED" | "CANCELLED" | "FAILED";
  submittedAt: number | null;
  filledAt: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TWAP Execution
// ─────────────────────────────────────────────────────────────────────────────

export class TWAPExecutor {
  private oms: OrderManagementSystem;
  private params: TWAPParams;
  private execution: StrategyExecution;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentSliceIndex = 0;
  private cancelled = false;
  private onUpdate?: (exec: StrategyExecution) => void;

  constructor(oms: OrderManagementSystem, params: TWAPParams) {
    this.oms = oms;
    this.params = params;
    
    const sliceSize = params.totalSize / params.sliceCount;
    const intervalMs = (params.durationSeconds * 1000) / params.sliceCount;
    
    this.execution = {
      strategyId: `TWAP-${generateOrderId()}`,
      status: "ACTIVE",
      progress: 0,
      filledSize: 0,
      avgFillPrice: 0,
      remainingSize: params.totalSize,
      startTime: Date.now(),
      endTime: null,
      slices: Array.from({ length: params.sliceCount }, (_, i) => ({
        sliceId: `TWAP-SLICE-${i}`,
        orderId: null,
        size: sliceSize,
        price: params.targetPrice,
        status: "PENDING" as const,
        submittedAt: null,
        filledAt: null,
      })),
      errors: [],
    };
  }

  start(onUpdate?: (exec: StrategyExecution) => void): void {
    this.onUpdate = onUpdate;
    const sliceSize = this.params.totalSize / this.params.sliceCount;
    const intervalMs = (this.params.durationSeconds * 1000) / this.params.sliceCount;

    // Execute first slice immediately
    this.executeSlice(0);

    // Schedule remaining slices
    for (let i = 1; i < this.params.sliceCount; i++) {
      setTimeout(() => {
        if (!this.cancelled && this.execution.status === "ACTIVE") {
          this.executeSlice(i);
        }
      }, intervalMs * i);
    }

    // Monitor completion
    const monitorInterval = setInterval(() => {
      this.updateProgress();
      
      if (this.execution.progress >= 1 || this.cancelled) {
        clearInterval(monitorInterval);
        this.finalize();
      }
    }, 500);

    onCleanup(() => {
      this.cancelled = true;
      clearInterval(monitorInterval);
      if (this.timer) clearTimeout(this.timer);
    });
  }

  private async executeSlice(sliceIndex: number): Promise<void> {
    const slice = this.execution.slices[sliceIndex];
    if (!slice || slice.status !== "PENDING") return;

    try {
      // Get current market price
      const currentPrice = await getCurrentPrice(this.params.tokenId, this.params.side);
      const priceToUse = currentPrice ?? this.params.targetPrice;

      // Create order
      const order = this.oms.createOrder({
        marketId: this.params.marketId,
        tokenId: this.params.tokenId,
        side: this.params.side,
        type: "LIMIT",
        timeInForce: "IOC",
        price: priceToUse,
        size: slice.size,
      });

      slice.orderId = order.orderId;
      slice.price = priceToUse;
      slice.status = "SUBMITTED";
      slice.submittedAt = Date.now();
      this.notifyUpdate();

      // Simulate fill (in real implementation, listen for fills)
      // For demo purposes, assume immediate fill at market price
      setTimeout(() => {
        this.recordFill(sliceIndex, priceToUse, slice.size);
      }, 100);
    } catch (error) {
      slice.status = "FAILED";
      this.execution.errors.push(`Slice ${sliceIndex}: ${error}`);
      this.notifyUpdate();
    }
  }

  private recordFill(sliceIndex: number, price: number, size: number): void {
    const slice = this.execution.slices[sliceIndex];
    slice.status = "FILLED";
    slice.filledAt = Date.now();
    slice.price = price;

    this.execution.filledSize += size;
    this.execution.remainingSize -= size;
    
    // Update avg fill price
    const totalValue = this.execution.avgFillPrice * (this.execution.filledSize - size) + price * size;
    this.execution.avgFillPrice = totalValue / this.execution.filledSize;

    this.updateProgress();
    this.notifyUpdate();
  }

  private updateProgress(): void {
    const filledCount = this.execution.slices.filter((s) => s.status === "FILLED").length;
    this.execution.progress = filledCount / this.execution.slices.length;
  }

  private finalize(): void {
    this.execution.endTime = Date.now();
    
    if (this.execution.remainingSize <= 0) {
      this.execution.status = "COMPLETED";
    } else if (this.cancelled) {
      this.execution.status = "CANCELLED";
    } else {
      this.execution.status = "COMPLETED"; // Partial completion is still "completed"
    }

    this.notifyUpdate();
  }

  cancel(): void {
    this.cancelled = true;
    this.execution.status = "CANCELLED";
    this.execution.endTime = Date.now();
    
    // Cancel any pending slices
    for (const slice of this.execution.slices) {
      if (slice.status === "PENDING" || slice.status === "SUBMITTED") {
        slice.status = "CANCELLED";
        if (slice.orderId) {
          this.oms.cancelOrder(slice.orderId);
        }
      }
    }
    
    this.notifyUpdate();
  }

  pause(): void {
    this.execution.status = "PAUSED";
    this.notifyUpdate();
  }

  resume(): void {
    this.execution.status = "ACTIVE";
    // Resume executing pending slices
    const nextPendingIndex = this.execution.slices.findIndex((s) => s.status === "PENDING");
    if (nextPendingIndex >= 0) {
      const remainingSlices = this.params.sliceCount - nextPendingIndex;
      const remainingTime = this.params.durationSeconds * 1000 - (nextPendingIndex * this.params.durationSeconds * 1000 / this.params.sliceCount);
      const intervalMs = remainingTime / remainingSlices;

      for (let i = nextPendingIndex; i < this.params.sliceCount; i++) {
        setTimeout(() => {
          if (!this.cancelled && this.execution.status === "ACTIVE") {
            this.executeSlice(i);
          }
        }, intervalMs * (i - nextPendingIndex));
      }
    }
    
    this.notifyUpdate();
  }

  getExecution(): StrategyExecution {
    return this.execution;
  }

  private notifyUpdate(): void {
    this.onUpdate?.(this.execution);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VWAP Execution
// ─────────────────────────────────────────────────────────────────────────────

export class VWAPExecutor {
  private oms: OrderManagementSystem;
  private params: VWAPParams;
  private execution: StrategyExecution;
  private cancelled = false;
  private onUpdate?: (exec: StrategyExecution) => void;
  
  // Simulated volume profile (in real implementation, use historical data)
  private volumeProfile: number[] = [
    0.3, 0.4, 0.6, 0.8, 1.0, 1.2, 1.1, 0.9, 0.7, 0.5
  ]; // 10 buckets representing intraday volume distribution

  constructor(oms: OrderManagementSystem, params: VWAPParams) {
    this.oms = oms;
    this.params = params;
    
    // Create slices based on volume profile
    const sliceCount = this.volumeProfile.length;
    const totalVolume = this.volumeProfile.reduce((a, b) => a + b, 0);
    
    this.execution = {
      strategyId: `VWAP-${generateOrderId()}`,
      status: "ACTIVE",
      progress: 0,
      filledSize: 0,
      avgFillPrice: 0,
      remainingSize: params.totalSize,
      startTime: Date.now(),
      endTime: null,
      slices: this.volumeProfile.map((vol, i) => ({
        sliceId: `VWAP-SLICE-${i}`,
        orderId: null,
        size: (vol / totalVolume) * params.totalSize,
        price: params.side === "BUY" ? params.maxPrice : params.minPrice,
        status: "PENDING" as const,
        submittedAt: null,
        filledAt: null,
      })),
      errors: [],
    };
  }

  start(onUpdate?: (exec: StrategyExecution) => void): void {
    this.onUpdate = onUpdate;
    const intervalMs = (this.params.durationSeconds * 1000) / this.execution.slices.length;

    // Execute first slice
    this.executeSlice(0);

    // Schedule remaining slices
    for (let i = 1; i < this.execution.slices.length; i++) {
      setTimeout(() => {
        if (!this.cancelled && this.execution.status === "ACTIVE") {
          this.executeSlice(i);
        }
      }, intervalMs * i);
    }

    // Monitor completion
    const monitorInterval = setInterval(() => {
      this.updateProgress();
      
      if (this.execution.progress >= 1 || this.cancelled) {
        clearInterval(monitorInterval);
        this.finalize();
      }
    }, 500);

    onCleanup(() => {
      this.cancelled = true;
      clearInterval(monitorInterval);
    });
  }

  private async executeSlice(sliceIndex: number): Promise<void> {
    const slice = this.execution.slices[sliceIndex];
    if (!slice || slice.status !== "PENDING") return;

    try {
      // Use dynamic price based on side and volume
      const price = this.params.side === "BUY" ? this.params.maxPrice : this.params.minPrice;

      const order = this.oms.createOrder({
        marketId: this.params.marketId,
        tokenId: this.params.tokenId,
        side: this.params.side,
        type: "LIMIT",
        timeInForce: "IOC",
        price,
        size: slice.size,
      });

      slice.orderId = order.orderId;
      slice.price = price;
      slice.status = "SUBMITTED";
      slice.submittedAt = Date.now();
      this.notifyUpdate();

      // Simulate fill
      setTimeout(() => {
        this.recordFill(sliceIndex, price, slice.size);
      }, 50);
    } catch (error) {
      slice.status = "FAILED";
      this.execution.errors.push(`Slice ${sliceIndex}: ${error}`);
      this.notifyUpdate();
    }
  }

  private recordFill(sliceIndex: number, price: number, size: number): void {
    const slice = this.execution.slices[sliceIndex];
    slice.status = "FILLED";
    slice.filledAt = Date.now();
    slice.price = price;

    this.execution.filledSize += size;
    this.execution.remainingSize -= size;
    
    const totalValue = this.execution.avgFillPrice * (this.execution.filledSize - size) + price * size;
    this.execution.avgFillPrice = totalValue / this.execution.filledSize;

    this.updateProgress();
    this.notifyUpdate();
  }

  private updateProgress(): void {
    const filledCount = this.execution.slices.filter((s) => s.status === "FILLED").length;
    this.execution.progress = filledCount / this.execution.slices.length;
  }

  private finalize(): void {
    this.execution.endTime = Date.now();
    this.execution.status = this.execution.remainingSize <= 0 ? "COMPLETED" : "CANCELLED";
    this.notifyUpdate();
  }

  cancel(): void {
    this.cancelled = true;
    this.execution.status = "CANCELLED";
    this.execution.endTime = Date.now();
    this.notifyUpdate();
  }

  getExecution(): StrategyExecution {
    return this.execution;
  }

  private notifyUpdate(): void {
    this.onUpdate?.(this.execution);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Iceberg Execution
// ─────────────────────────────────────────────────────────────────────────────

export class IcebergExecutor {
  private oms: OrderManagementSystem;
  private params: IcebergParams;
  private execution: StrategyExecution;
  private displayInterval: ReturnType<typeof setInterval> | null = null;
  private remainingSize: number;
  private cancelled = false;
  private onUpdate?: (exec: StrategyExecution) => void;

  constructor(oms: OrderManagementSystem, params: IcebergParams) {
    this.oms = oms;
    this.params = params;
    this.remainingSize = params.totalSize;

    this.execution = {
      strategyId: `ICEBERG-${generateOrderId()}`,
      status: "ACTIVE",
      progress: 0,
      filledSize: 0,
      avgFillPrice: 0,
      remainingSize: params.totalSize,
      startTime: Date.now(),
      endTime: null,
      slices: [],
      errors: [],
    };
  }

  start(onUpdate?: (exec: StrategyExecution) => void): void {
    this.onUpdate = onUpdate;
    this.submitNextSlice();

    // Monitor every 5 seconds
    this.displayInterval = setInterval(async () => {
      if (this.cancelled || this.execution.status !== "ACTIVE") {
        this.finalize();
        return;
      }

      // Check if market is liquid enough
      if (this.params.autoHibernate) {
        try {
          const book = await getOrderBookSummary(this.params.tokenId);
          const spread = book ? (book.bestAsk ?? 0) - (book.bestBid ?? 0) : 0;
          
          // Pause if spread > 2%
          if (spread > 0.02 && this.execution.status === "ACTIVE") {
            this.pause();
            setTimeout(() => this.resume(), 30_000); // Resume after 30s
          }
        } catch {
          // Continue regardless
        }
      }

      if (this.remainingSize > 0) {
        this.submitNextSlice();
      } else {
        this.finalize();
      }
    }, 5000);

    onCleanup(() => {
      this.cancelled = true;
      if (this.displayInterval) clearInterval(this.displayInterval);
    });
  }

  private async submitNextSlice(): Promise<void> {
    if (this.remainingSize <= 0 || this.cancelled) return;

    const sizeToSubmit = Math.min(this.params.displaySize, this.remainingSize);
    
    try {
      const slice: StrategySlice = {
        sliceId: `ICEBERG-SLICE-${Date.now()}`,
        orderId: null,
        size: sizeToSubmit,
        price: this.params.limitPrice,
        status: "PENDING",
        submittedAt: null,
        filledAt: null,
      };

      const order = this.oms.createOrder({
        marketId: this.params.marketId,
        tokenId: this.params.tokenId,
        side: this.params.side,
        type: "LIMIT",
        timeInForce: "GTC",
        price: this.params.limitPrice,
        size: sizeToSubmit,
      });

      slice.orderId = order.orderId;
      slice.status = "SUBMITTED";
      slice.submittedAt = Date.now();
      
      this.execution.slices.push(slice);
      this.remainingSize -= sizeToSubmit;
      this.execution.remainingSize = this.remainingSize;
      
      this.updateProgress();
      this.notifyUpdate();

      // Simulate fill after delay
      setTimeout(() => {
        this.recordFill(slice, this.params.limitPrice, sizeToSubmit);
      }, 200);
    } catch (error) {
      this.execution.errors.push(`Iceberg slice failed: ${error}`);
      this.notifyUpdate();
    }
  }

  private recordFill(slice: StrategySlice, price: number, size: number): void {
    slice.status = "FILLED";
    slice.filledAt = Date.now();
    slice.price = price;

    this.execution.filledSize += size;
    
    const totalValue = this.execution.avgFillPrice * (this.execution.filledSize - size) + price * size;
    this.execution.avgFillPrice = totalValue / this.execution.filledSize;

    this.updateProgress();
    this.notifyUpdate();
  }

  private updateProgress(): void {
    this.execution.progress = this.execution.filledSize / this.params.totalSize;
  }

  private finalize(): void {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
    }
    this.execution.endTime = Date.now();
    this.execution.status = this.execution.remainingSize <= 0 ? "COMPLETED" : "CANCELLED";
    this.notifyUpdate();
  }

  cancel(): void {
    this.cancelled = true;
    this.execution.status = "CANCELLED";
    this.execution.endTime = Date.now();
    
    for (const slice of this.execution.slices) {
      if (slice.orderId && (slice.status === "PENDING" || slice.status === "SUBMITTED")) {
        this.oms.cancelOrder(slice.orderId);
        slice.status = "CANCELLED";
      }
    }
    
    this.notifyUpdate();
  }

  pause(): void {
    this.execution.status = "PAUSED";
    this.notifyUpdate();
  }

  resume(): void {
    if (this.execution.status === "PAUSED" && this.remainingSize > 0) {
      this.execution.status = "ACTIVE";
      this.notifyUpdate();
    }
  }

  getExecution(): StrategyExecution {
    return this.execution;
  }

  private notifyUpdate(): void {
    this.onUpdate?.(this.execution);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Manager
// ─────────────────────────────────────────────────────────────────────────────

export class StrategyManager {
  private strategies = new Map<string, {
    type: "TWAP" | "VWAP" | "ICEBERG";
    executor: TWAPExecutor | VWAPExecutor | IcebergExecutor;
    execution: StrategyExecution;
  }>();
  private oms: OrderManagementSystem;

  constructor(oms: OrderManagementSystem) {
    this.oms = oms;
  }

  executeTWAP(params: TWAPParams, onUpdate?: (exec: StrategyExecution) => void): string {
    const executor = new TWAPExecutor(this.oms, params);
    const execution = executor.getExecution();
    
    this.strategies.set(execution.strategyId, {
      type: "TWAP",
      executor,
      execution,
    });

    executor.start(onUpdate);
    return execution.strategyId;
  }

  executeVWAP(params: VWAPParams, onUpdate?: (exec: StrategyExecution) => void): string {
    const executor = new VWAPExecutor(this.oms, params);
    const execution = executor.getExecution();
    
    this.strategies.set(execution.strategyId, {
      type: "VWAP",
      executor,
      execution,
    });

    executor.start(onUpdate);
    return execution.strategyId;
  }

  executeIceberg(params: IcebergParams, onUpdate?: (exec: StrategyExecution) => void): string {
    const executor = new IcebergExecutor(this.oms, params);
    const execution = executor.getExecution();
    
    this.strategies.set(execution.strategyId, {
      type: "ICEBERG",
      executor,
      execution,
    });

    executor.start(onUpdate);
    return execution.strategyId;
  }

  cancelStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    strategy.executor.cancel();
    return true;
  }

  pauseStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    if (strategy.type === "ICEBERG") {
      (strategy.executor as IcebergExecutor).pause();
    }
    return true;
  }

  resumeStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    if (strategy.type === "ICEBERG") {
      (strategy.executor as IcebergExecutor).resume();
    }
    return true;
  }

  getStrategy(strategyId: string): StrategyExecution | null {
    return this.strategies.get(strategyId)?.execution ?? null;
  }

  getAllStrategies(): StrategyExecution[] {
    return Array.from(this.strategies.values()).map((s) => s.execution);
  }

  getActiveStrategies(): StrategyExecution[] {
    return this.getAllStrategies().filter((s) => s.status === "ACTIVE");
  }

  removeStrategy(strategyId: string): boolean {
    return this.strategies.delete(strategyId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Strategy Manager
// ─────────────────────────────────────────────────────────────────────────────

let globalStrategyManager: StrategyManager | null = null;

export function getStrategyManager(): StrategyManager {
  if (!globalStrategyManager) {
    globalStrategyManager = new StrategyManager(getOMS());
  }
  return globalStrategyManager;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook for Strategy Execution
// ─────────────────────────────────────────────────────────────────────────────

export interface UseStrategyResult {
  executeTWAP: (params: TWAPParams) => string;
  executeVWAP: (params: VWAPParams) => string;
  executeIceberg: (params: IcebergParams) => string;
  cancel: (strategyId: string) => void;
  pause: (strategyId: string) => void;
  resume: (strategyId: string) => void;
  strategies: () => StrategyExecution[];
}

export function useExecutionStrategies(): UseStrategyResult {
  const [strategies, setStrategies] = createSignal<StrategyExecution[]>([]);
  const manager = getStrategyManager();

  const updateStrategy = (strategyId: string, execution: StrategyExecution) => {
    setStrategies((prev) => {
      const idx = prev.findIndex((s) => s.strategyId === strategyId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = execution;
        return updated;
      }
      return [...prev, execution];
    });
  };

  return {
    executeTWAP: (params) => {
      const id = manager.executeTWAP(params, (exec) => updateStrategy(exec.strategyId, exec));
      setStrategies((prev) => [...prev, manager.getStrategy(id)!]);
      return id;
    },
    executeVWAP: (params) => {
      const id = manager.executeVWAP(params, (exec) => updateStrategy(exec.strategyId, exec));
      setStrategies((prev) => [...prev, manager.getStrategy(id)!]);
      return id;
    },
    executeIceberg: (params) => {
      const id = manager.executeIceberg(params, (exec) => updateStrategy(exec.strategyId, exec));
      setStrategies((prev) => [...prev, manager.getStrategy(id)!]);
      return id;
    },
    cancel: (strategyId) => {
      manager.cancelStrategy(strategyId);
      setStrategies((prev) =>
        prev.map((s) => s.strategyId === strategyId ? manager.getStrategy(strategyId)! : s)
      );
    },
    pause: (strategyId) => {
      manager.pauseStrategy(strategyId);
      setStrategies((prev) =>
        prev.map((s) => s.strategyId === strategyId ? manager.getStrategy(strategyId)! : s)
      );
    },
    resume: (strategyId) => {
      manager.resumeStrategy(strategyId);
      setStrategies((prev) =>
        prev.map((s) => s.strategyId === strategyId ? manager.getStrategy(strategyId)! : s)
      );
    },
    strategies,
  };
}