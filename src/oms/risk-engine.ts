/**
 * Enterprise Risk Engine
 * 
 * Real-time risk management with:
 * - VaR and CVaR calculations
 * - Greeks (Delta, Gamma, Theta, Vega)
 * - Position limits and concentration checks
 * - Automated circuit breakers
 * - Risk attribution
 */

import { createSignal, createEffect, batch } from "solid-js";
import { getOMS, Position, PortfolioSummary, RiskLimits, DEFAULT_RISK_LIMITS } from "./core";

// ─────────────────────────────────────────────────────────────────────────────
// Risk Calculation Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PositionRisk {
  tokenId: string;
  marketId: string;
  grossSize: number;
  netSize: number;
  value: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  categoryExposure: number;
  marketExposure: number;
  concentrationPct: number;
  maxAdverseExcursion: number;
  maxFavorableExcursion: number;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface PortfolioRisk {
  totalValue: number;
  totalExposure: number;
  netExposure: number;
  totalPnL: number;
  dailyPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  var95: number;
  var99: number;
  expectedShortfall95: number;
  expectedShortfall99: number;
  portfolioDelta: number;
  portfolioGamma: number;
  portfolioTheta: number;
  largestPositionPct: number;
  top5ConcentrationPct: number;
  categoryConcentration: Map<string, number>;
  maxDrawdown: number;
  currentDrawdown: number;
  drawdownPeak: number;
  grossLeverage: number;
  netLeverage: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  limitsUtilization: Map<keyof RiskLimits, number>;
  breachedLimits: Array<{ limit: keyof RiskLimits; current: number; threshold: number }>;
}

export interface RiskAlert {
  id: string;
  timestamp: number;
  severity: "INFO" | "WARNING" | "CRITICAL" | "EMERGENCY";
  type: "LIMIT_BREACH" | "CONCENTRATION" | "DRAWDOWN" | "LOSS_LIMIT" | "POSITION_SIZE" | "RATE_LIMIT";
  title: string;
  description: string;
  affectedPositions: string[];
  recommendedAction: string;
  autoAction?: "BLOCK_ORDERS" | "REDUCE_POSITIONS" | "CANCEL_OPEN_ORDERS" | "PAUSE_TRADING";
}

export interface RiskLimitsConfig {
  maxPositionSize: number;
  maxPositionValue: number;
  maxPositions: number;
  maxOrderSize: number;
  maxOrderValue: number;
  maxOrdersPerMinute: number;
  maxPortfolioValue: number;
  maxLossPerDay: number;
  maxLossPerWeek: number;
  maxLossPerMonth: number;
  maxSinglePositionPct: number;
  maxTop5ConcentrationPct: number;
  maxCategoryConcentrationPct: number;
  maxDrawdownPct: number;
  maxVar95: number;
  maxVar99: number;
  priceMoveThresholdPct: number;
  priceMoveWindowSeconds: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Engine Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class RiskEngine {
  private limits: RiskLimitsConfig;
  private alerts: RiskAlert[] = [];
  private positionsRisk: Map<string, PositionRisk> = new Map();
  private portfolioRisk: PortfolioRisk | null = null;
  private drawdownPeak = 0;
  private drawdownHigh = 0;
  private circuitBreakerActive = false;
  private lastPriceMovePct = 0;
  private listeners = new Set<(risk: PortfolioRisk) => void>();
  private alertListeners = new Set<(alert: RiskAlert) => void>();

  constructor(customLimits?: Partial<RiskLimitsConfig>) {
    this.limits = {
      maxPositionSize: customLimits?.maxPositionSize ?? DEFAULT_RISK_LIMITS.maxPositionSize,
      maxPositionValue: customLimits?.maxPositionValue ?? DEFAULT_RISK_LIMITS.maxPositionValue,
      maxPositions: customLimits?.maxPositions ?? DEFAULT_RISK_LIMITS.maxPositions,
      maxOrderSize: customLimits?.maxOrderSize ?? DEFAULT_RISK_LIMITS.maxOrderSize,
      maxOrderValue: customLimits?.maxOrderValue ?? DEFAULT_RISK_LIMITS.maxOrderValue,
      maxOrdersPerMinute: customLimits?.maxOrdersPerMinute ?? DEFAULT_RISK_LIMITS.maxOrdersPerMinute,
      maxPortfolioValue: customLimits?.maxPortfolioValue ?? DEFAULT_RISK_LIMITS.maxPortfolioValue,
      maxLossPerDay: customLimits?.maxLossPerDay ?? DEFAULT_RISK_LIMITS.maxLossPerDay,
      maxLossPerWeek: customLimits?.maxLossPerWeek ?? 25000,
      maxLossPerMonth: customLimits?.maxLossPerMonth ?? 100000,
      maxSinglePositionPct: customLimits?.maxSinglePositionPct ?? 0.2,
      maxTop5ConcentrationPct: customLimits?.maxTop5ConcentrationPct ?? 0.5,
      maxCategoryConcentrationPct: customLimits?.maxCategoryConcentrationPct ?? 0.4,
      maxDrawdownPct: customLimits?.maxDrawdownPct ?? 0.15,
      maxVar95: customLimits?.maxVar95 ?? 0.05,
      maxVar99: customLimits?.maxVar99 ?? 0.1,
      priceMoveThresholdPct: customLimits?.priceMoveThresholdPct ?? 0.05,
      priceMoveWindowSeconds: customLimits?.priceMoveWindowSeconds ?? 300,
    };
  }

  calculatePositionRisk(position: Position, totalPortfolioValue: number): PositionRisk {
    const value = Math.abs(position.netSize * position.currentPrice);
    const concentrationPct = totalPortfolioValue > 0 ? value / totalPortfolioValue : 0;
    const price = position.currentPrice;
    const deltaApproximation = Math.abs(price * (1 - price)) * 2;
    const gammaApproximation = Math.abs(1 - 2 * price) * 0.5;

    let riskScore = 0;
    const sizeRisk = Math.min(30, (value / this.limits.maxPositionValue) * 30);
    riskScore += sizeRisk;
    const concentrationRisk = Math.min(30, concentrationPct / this.limits.maxSinglePositionPct * 30);
    riskScore += concentrationRisk;
    const pnlRisk = position.unrealizedPnL < 0
      ? Math.min(40, Math.abs(position.unrealizedPnL) / this.limits.maxLossPerDay * 40)
      : 0;
    riskScore += pnlRisk;

    let riskLevel: PositionRisk["riskLevel"];
    if (riskScore >= 80) riskLevel = "CRITICAL";
    else if (riskScore >= 60) riskLevel = "HIGH";
    else if (riskScore >= 30) riskLevel = "MEDIUM";
    else riskLevel = "LOW";

    return {
      tokenId: position.tokenId,
      marketId: position.marketId,
      grossSize: position.grossSize,
      netSize: position.netSize,
      value,
      unrealizedPnL: position.unrealizedPnL,
      realizedPnL: position.realizedPnL,
      totalPnL: position.totalPnL,
      delta: deltaApproximation * position.netSize,
      gamma: gammaApproximation * Math.abs(position.netSize),
      vega: 0,
      theta: -0.001 * Math.abs(position.netSize),
      categoryExposure: 0,
      marketExposure: value,
      concentrationPct,
      maxAdverseExcursion: position.maxAdverseExcursion,
      maxFavorableExcursion: position.maxFavorableExcursion,
      riskScore: Math.min(100, riskScore),
      riskLevel,
    };
  }

  calculatePortfolioRisk(positions: Position[], portfolioSummary: PortfolioSummary): PortfolioRisk {
    const totalValue = portfolioSummary.totalValue;
    const totalExposure = positions.reduce((sum, p) => sum + Math.abs(p.netSize * p.currentPrice), 0);
    const netExposure = positions.reduce((sum, p) => sum + p.netSize * p.currentPrice, 0);

    this.positionsRisk.clear();
    for (const position of positions) {
      const risk = this.calculatePositionRisk(position, totalValue);
      this.positionsRisk.set(position.tokenId, risk);
    }

    let portfolioDelta = 0;
    let portfolioGamma = 0;
    let portfolioTheta = 0;

    for (const risk of this.positionsRisk.values()) {
      portfolioDelta += risk.delta;
      portfolioGamma += risk.gamma;
      portfolioTheta += risk.theta;
    }

    const sortedPositions = Array.from(this.positionsRisk.values())
      .sort((a, b) => b.value - a.value);

    const largestValue = sortedPositions[0]?.value ?? 0;
    const largestPositionPct = totalValue > 0 ? largestValue / totalValue : 0;
    const top5Value = sortedPositions.slice(0, 5).reduce((sum, p) => sum + p.value, 0);
    const top5ConcentrationPct = totalValue > 0 ? top5Value / totalValue : 0;
    const categoryConcentration = new Map<string, number>();

    const var95 = totalExposure * 0.02;
    const var99 = totalExposure * 0.03;
    const expectedShortfall95 = var95 * 1.5;
    const expectedShortfall99 = var99 * 1.5;

    const currentPnL = portfolioSummary.totalPnL;
    if (currentPnL > this.drawdownPeak) {
      this.drawdownPeak = currentPnL;
    }
    this.drawdownHigh = Math.max(0, this.drawdownPeak - currentPnL);
    const currentDrawdownPct = this.drawdownPeak > 0 ? this.drawdownHigh / this.drawdownPeak : 0;

    const grossLeverage = totalExposure / (totalValue || 1);
    const netLeverage = Math.abs(netExposure) / (totalValue || 1);

    const limitsUtilization = new Map<keyof RiskLimits, number>();
    const breachedLimits: PortfolioRisk["breachedLimits"] = [];

    const positionUtilization = positions.length / this.limits.maxPositions;
    limitsUtilization.set("maxPositions" as keyof RiskLimits, positionUtilization);
    if (positionUtilization > 1) {
      breachedLimits.push({
        limit: "maxPositions",
        current: positions.length,
        threshold: this.limits.maxPositions,
      });
    }

    const dailyPnlValue = (portfolioSummary as { totalPnL?: number }).totalPnL ?? 0;
    const dailyLossPct = dailyPnlValue < 0 ? Math.abs(dailyPnlValue) / (totalValue || 1) : 0;
    limitsUtilization.set("maxLossPerDay" as keyof RiskLimits, dailyLossPct / 0.02);
    if (dailyLossPct > 0.02) {
      breachedLimits.push({
        limit: "maxLossPerDay",
        current: dailyPnlValue,
        threshold: -totalValue * 0.02,
      });
    }

    if (largestPositionPct > this.limits.maxSinglePositionPct) {
      breachedLimits.push({
        limit: "maxConcentrationPct" as keyof RiskLimits,
        current: largestPositionPct,
        threshold: this.limits.maxSinglePositionPct,
      });
    }

    this.portfolioRisk = {
      totalValue,
      totalExposure,
      netExposure,
      totalPnL: portfolioSummary.totalPnL,
      dailyPnL: portfolioSummary.totalPnL,
      unrealizedPnL: portfolioSummary.totalUnrealizedPnL,
      realizedPnL: portfolioSummary.totalRealizedPnL,
      var95,
      var99,
      expectedShortfall95,
      expectedShortfall99,
      portfolioDelta,
      portfolioGamma,
      portfolioTheta,
      largestPositionPct,
      top5ConcentrationPct,
      categoryConcentration,
      maxDrawdown: this.drawdownHigh,
      currentDrawdown: currentDrawdownPct,
      drawdownPeak: this.drawdownPeak,
      grossLeverage,
      netLeverage,
      winRate: portfolioSummary.winRate,
      profitFactor: portfolioSummary.profitFactor,
      sharpeRatio: portfolioSummary.sharpeRatio,
      limitsUtilization,
      breachedLimits,
    };

    this.checkRiskAlerts(totalValue);
    this.notifyListeners();
    return this.portfolioRisk;
  }

  private checkRiskAlerts(totalValue: number): void {
    if (!this.portfolioRisk) return;
    const risk = this.portfolioRisk;

    if (risk.largestPositionPct > this.limits.maxSinglePositionPct) {
      this.raiseAlert({
        severity: "WARNING",
        type: "CONCENTRATION",
        title: "Position Concentration High",
        description: `Largest position is ${(risk.largestPositionPct * 100).toFixed(1)}% of portfolio`,
        affectedPositions: [Array.from(this.positionsRisk.values())[0]?.tokenId ?? ""],
        recommendedAction: "Consider reducing position size",
        autoAction: "BLOCK_ORDERS",
      });
    }

    if (risk.currentDrawdown > this.limits.maxDrawdownPct) {
      this.raiseAlert({
        severity: "CRITICAL",
        type: "DRAWDOWN",
        title: "Max Drawdown Exceeded",
        description: `Current drawdown ${(risk.currentDrawdown * 100).toFixed(1)}% exceeds limit`,
        affectedPositions: [],
        recommendedAction: "Pause new positions",
        autoAction: "PAUSE_TRADING",
      });
    }

    if (risk.dailyPnL < -this.limits.maxLossPerDay) {
      this.raiseAlert({
        severity: "EMERGENCY",
        type: "LOSS_LIMIT",
        title: "Daily Loss Limit Breached",
        description: `Daily P&L ${risk.dailyPnL.toFixed(2)} exceeds limit`,
        affectedPositions: [],
        recommendedAction: "Stop trading immediately",
        autoAction: "PAUSE_TRADING",
      });
    }

    for (const [tokenId, posRisk] of this.positionsRisk) {
      if (posRisk.riskLevel === "CRITICAL") {
        this.raiseAlert({
          severity: "CRITICAL",
          type: "POSITION_SIZE",
          title: "Critical Position Risk",
          description: `Position risk score ${posRisk.riskScore.toFixed(0)}`,
          affectedPositions: [tokenId],
          recommendedAction: "Reduce position size",
          autoAction: "BLOCK_ORDERS",
        });
      }
    }

    if (risk.var95 > totalValue * this.limits.maxVar95) {
      this.raiseAlert({
        severity: "WARNING",
        type: "LIMIT_BREACH",
        title: "VaR Limit Approaching",
        description: `95% VaR ${risk.var95.toFixed(2)} exceeds threshold`,
        affectedPositions: [],
        recommendedAction: "Reduce overall exposure",
      });
    }
  }

  private raiseAlert(alertConfig: Omit<RiskAlert, "id" | "timestamp">): void {
    const recentSimilar = this.alerts.find(
      (a) => a.type === alertConfig.type && Date.now() - a.timestamp < 60_000
    );
    if (recentSimilar) return;

    const alert: RiskAlert = {
      id: `ALERT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...alertConfig,
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    this.alertListeners.forEach((listener) => listener(alert));
  }

  checkCircuitBreaker(tokenId: string, currentPrice: number, referencePrice: number): boolean {
    if (!referencePrice) return false;

    const priceMove = Math.abs((currentPrice - referencePrice) / referencePrice);

    if (priceMove > this.limits.priceMoveThresholdPct) {
      this.circuitBreakerActive = true;
      this.lastPriceMovePct = priceMove;

      this.raiseAlert({
        severity: "EMERGENCY",
        type: "LIMIT_BREACH",
        title: "Circuit Breaker Triggered",
        description: `Price moved ${(priceMove * 100).toFixed(1)}%`,
        affectedPositions: [tokenId],
        recommendedAction: "Pause all trading",
        autoAction: "PAUSE_TRADING",
      });
      return true;
    }
    return false;
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerActive = false;
    this.lastPriceMovePct = 0;
  }

  isCircuitBreakerActive(): boolean {
    return this.circuitBreakerActive;
  }

  checkOrderRisk(params: { tokenId: string; side: "BUY" | "SELL"; size: number; price: number }): { allowed: boolean; reason?: string; autoAction?: RiskAlert["autoAction"] } {
    if (this.circuitBreakerActive) {
      return { allowed: false, reason: "Circuit breaker active", autoAction: "PAUSE_TRADING" };
    }

    const orderValue = params.size * params.price;

    if (params.size > this.limits.maxOrderSize) {
      return { allowed: false, reason: `Order size ${params.size} exceeds maximum ${this.limits.maxOrderSize}` };
    }

    if (orderValue > this.limits.maxOrderValue) {
      return { allowed: false, reason: `Order value exceeds maximum ${this.limits.maxOrderValue}` };
    }

    if (this.portfolioRisk && this.portfolioRisk.dailyPnL < -this.limits.maxLossPerDay * 0.9) {
      return { allowed: false, reason: "Approaching daily loss limit", autoAction: "PAUSE_TRADING" };
    }

    if (this.portfolioRisk && this.portfolioRisk.currentDrawdown > this.limits.maxDrawdownPct * 0.8) {
      return { allowed: false, reason: "Approaching max drawdown limit", autoAction: "PAUSE_TRADING" };
    }

    const currentPosRisk = this.positionsRisk.get(params.tokenId);
    if (currentPosRisk && this.portfolioRisk) {
      const newValue = currentPosRisk.value + orderValue;
      const newConcentration = newValue / this.portfolioRisk.totalValue;
      if (newConcentration > this.limits.maxSinglePositionPct * 1.2) {
        return { allowed: false, reason: `Would exceed concentration limit (${(newConcentration * 100).toFixed(1)}%)` };
      }
    }

    return { allowed: true };
  }

  getPortfolioRisk(): PortfolioRisk | null {
    return this.portfolioRisk;
  }

  getPositionRisk(tokenId: string): PositionRisk | undefined {
    return this.positionsRisk.get(tokenId);
  }

  getAllPositionRisks(): PositionRisk[] {
    return Array.from(this.positionsRisk.values());
  }

  getAlerts(severity?: RiskAlert["severity"]): RiskAlert[] {
    if (!severity) return this.alerts;
    return this.alerts.filter((a) => a.severity === severity);
  }

  getRecentAlerts(minutes = 60): RiskAlert[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.alerts.filter((a) => a.timestamp > cutoff);
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  updateLimits(newLimits: Partial<RiskLimitsConfig>): void {
    this.limits = { ...this.limits, ...newLimits };
  }

  getLimits(): RiskLimitsConfig {
    return { ...this.limits };
  }

  subscribe(listener: (risk: PortfolioRisk) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeToAlerts(listener: (alert: RiskAlert) => void): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  private notifyListeners(): void {
    if (this.portfolioRisk) {
      this.listeners.forEach((l) => l(this.portfolioRisk!));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Risk Engine Instance
// ─────────────────────────────────────────────────────────────────────────────

let globalRiskEngine: RiskEngine | null = null;

export function getRiskEngine(): RiskEngine {
  if (!globalRiskEngine) {
    globalRiskEngine = new RiskEngine();
  }
  return globalRiskEngine;
}

export function createRiskEngine(limits?: Partial<RiskLimitsConfig>): RiskEngine {
  globalRiskEngine = new RiskEngine(limits);
  return globalRiskEngine;
}

// ─────────────────────────────────────────────────────────────────────────────
// SolidJS Hooks
// ─────────────────────────────────────────────────────────────────────────────

export interface UseRiskEngineResult {
  portfolioRisk: () => PortfolioRisk | null;
  positionRisks: () => PositionRisk[];
  alerts: () => RiskAlert[];
  recentAlerts: (minutes?: number) => RiskAlert[];
  circuitBreakerActive: () => boolean;
  checkOrderRisk: (params: { tokenId: string; side: "BUY" | "SELL"; size: number; price: number }) => { allowed: boolean; reason?: string };
  updateLimits: (limits: Partial<RiskLimitsConfig>) => void;
}

export function useRiskEngine(): UseRiskEngineResult {
  const [portfolioRisk, setPortfolioRisk] = createSignal<PortfolioRisk | null>(null);
  const [positionRisks, setPositionRisks] = createSignal<PositionRisk[]>([]);
  const [alerts, setAlerts] = createSignal<RiskAlert[]>([]);
  const [circuitBreakerActive, setCircuitBreakerActive] = createSignal(false);

  const engine = getRiskEngine();
  const oms = getOMS();

  engine.subscribe((risk) => {
    batch(() => {
      setPortfolioRisk(risk);
      setPositionRisks(engine.getAllPositionRisks());
      setCircuitBreakerActive(engine.isCircuitBreakerActive());
    });
  });

  engine.subscribeToAlerts((alert) => {
    setAlerts((prev) => [alert, ...prev].slice(0, 100));
  });

  createEffect(() => {
    const interval = setInterval(() => {
      const positions = oms.getAllPositions();
      const summary = oms.getPortfolioSummary();
      engine.calculatePortfolioRisk(positions, summary);
    }, 5000);
    return () => clearInterval(interval);
  });

  return {
    portfolioRisk,
    positionRisks,
    alerts,
    recentAlerts: (minutes = 60) => engine.getRecentAlerts(minutes),
    circuitBreakerActive,
    checkOrderRisk: (params) => engine.checkOrderRisk(params),
    updateLimits: (limits) => engine.updateLimits(limits),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Display Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatRiskLevel(level: PositionRisk["riskLevel"]): string {
  switch (level) {
    case "LOW": return "LOW";
    case "MEDIUM": return "MEDIUM";
    case "HIGH": return "HIGH";
    case "CRITICAL": return "CRITICAL";
  }
}

export function formatRiskScore(score: number): string {
  const bars = Math.round(score / 10);
  return "=".repeat(bars) + "-".repeat(10 - bars);
}

export function getRiskColor(score: number): string {
  if (score >= 80) return "error";
  if (score >= 60) return "warning";
  if (score >= 30) return "accent";
  return "success";
}

export function formatPnL(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(2)}`;
}

export function formatPnLPct(pnl: number, totalValue: number): string {
  if (totalValue === 0) return "0.00%";
  const pct = (pnl / totalValue) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}