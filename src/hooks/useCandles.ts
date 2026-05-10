/**
 * Candles/OHLCV Analytics Hook
 * Provides comprehensive candle data for technical analysis
 */

import { createSignal, createEffect, onCleanup } from "solid-js";
import { getCandles, Candle } from "../api/clob/additional";
import { clobCircuitBreaker, dedupRequest } from "../api/clob/enhanced-book";

export interface CandleWithIndicators {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // Computed indicators
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
}

export interface CandleIndicators {
  sma: number[];
  ema: number[];
  rsi: number[];
  macd: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
  bollingerUpper: number[];
  bollingerMiddle: number[];
  bollingerLower: number[];
}

const SMA_PERIOD = 20;
const RSI_PERIOD = 14;
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;
const EMA_PERIOD_1 = 12;
const EMA_PERIOD_2 = 26;
const BB_PERIOD = 20;
const BB_STD = 2;

function computeEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  if (data.length < period) {
    return data.map(() => NaN);
  }
  
  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i]!;
  }
  result.push(sum / period);
  
  const multiplier = 2 / (period + 1);
  
  for (let i = period; i < data.length; i++) {
    const prev = result[result.length - 1]!;
    const ema = (data[i]! - prev) * multiplier + prev;
    result.push(ema);
  }
  
  // Fill in NaN for the beginning
  const padded = new Array(period - 1).fill(NaN).concat(result);
  return padded;
}

function computeSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j]!;
      }
      result.push(sum / period);
    }
  }
  return result;
}

function computeRSI(prices: number[], period: number): number[] {
  const result: number[] = [];
  
  if (prices.length < period + 1) {
    return prices.map(() => NaN);
  }
  
  // Calculate first average gain and loss
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i]! - prices[i - 1]!;
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss -= change;
    }
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // First RSI
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - (100 / (1 + firstRS)));
  
  // Subsequent RSI using smoothed averages
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i]! - prices[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));
  }
  
  // Pad the beginning
  return new Array(period).fill(NaN).concat(result);
}

function computeMACD(prices: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = computeEMA(prices, MACD_FAST);
  const emaSlow = computeEMA(prices, MACD_SLOW);
  
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (Number.isNaN(emaFast[i]!) || Number.isNaN(emaSlow[i]!)) {
      macdLine.push(NaN);
    } else {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    }
  }
  
  // Compute signal line (EMA of MACD)
  const validMacd = macdLine.filter((v) => !Number.isNaN(v));
  const signalRaw = computeEMA(validMacd, MACD_SIGNAL);
  
  // Map back to full array
  const signal: number[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (Number.isNaN(macdLine[i]!)) {
      signal.push(NaN);
    } else {
      signal.push(signalRaw[signalIdx] ?? NaN);
      signalIdx++;
    }
  }
  
  const histogram: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (Number.isNaN(macdLine[i]!) || Number.isNaN(signal[i]!)) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i]! - signal[i]!);
    }
  }
  
  return { macd: macdLine, signal, histogram };
}

function computeBollingerBands(prices: number[], period: number, stdMultiplier: number): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  const sma = computeSMA(prices, period);
  
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (Number.isNaN(sma[i]!)) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      // Calculate standard deviation for this window
      let sumSqDiff = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = prices[j]! - sma[i]!;
        sumSqDiff += diff * diff;
      }
      const std = Math.sqrt(sumSqDiff / period);
      
      upper.push(sma[i]! + stdMultiplier * std);
      lower.push(sma[i]! - stdMultiplier * std);
    }
  }
  
  return { upper, middle: sma, lower };
}

export interface UseCandlesOptions {
  tokenId: string;
  interval?: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  limit?: number;
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

export interface UseCandlesResult {
  candles: () => CandleWithIndicators[];
  indicators: () => CandleIndicators | null;
  loading: () => boolean;
  error: () => string | null;
  lastUpdate: () => number | null;
  refresh: () => Promise<void>;
}

export function useCandles(options: UseCandlesOptions): UseCandlesResult {
  const {
    tokenId,
    interval = "1h",
    limit = 100,
    autoRefresh = true,
    refreshIntervalMs = 60_000, // 1 minute default
  } = options;
  
  const [candles, setCandles] = createSignal<CandleWithIndicators[]>([]);
  const [indicators, setIndicators] = createSignal<CandleIndicators | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [lastUpdate, setLastUpdate] = createSignal<number | null>(null);
  
  const computeAllIndicators = (rawCandles: Candle[]): CandleWithIndicators[] => {
    const closes = rawCandles.map((c) => c.close);
    const volumes = rawCandles.map((c) => c.volume);
    
    const sma20 = computeSMA(closes, 20);
    const sma50 = computeSMA(closes, 50);
    const ema12 = computeEMA(closes, EMA_PERIOD_1);
    const ema26 = computeEMA(closes, EMA_PERIOD_2);
    const rsi = computeRSI(closes, RSI_PERIOD);
    const macd = computeMACD(closes);
    const bb = computeBollingerBands(closes, BB_PERIOD, BB_STD);
    
    // Combine everything
    return rawCandles.map((c, i) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      sma20: sma20[i],
      sma50: sma50[i],
      ema12: ema12[i],
      ema26: ema26[i],
      rsi: rsi[i],
      macd: {
        macd: macd.macd[i]!,
        signal: macd.signal[i]!,
        histogram: macd.histogram[i]!,
      },
      // Note: Bollinger bands attached to candle as extra
    }));
  };
  
  const setIndicatorsData = (rawCandles: Candle[]) => {
    const closes = rawCandles.map((c) => c.close);
    
    const sma = computeSMA(closes, SMA_PERIOD);
    const ema = computeEMA(closes, EMA_PERIOD_1); // Using 12-period for simplicity
    const rsi = computeRSI(closes, RSI_PERIOD);
    const macd = computeMACD(closes);
    const bb = computeBollingerBands(closes, BB_PERIOD, BB_STD);
    
    setIndicators({
      sma,
      ema,
      rsi,
      macd,
      bollingerUpper: bb.upper,
      bollingerMiddle: bb.middle,
      bollingerLower: bb.lower,
    });
  };
  
  const fetchCandles = async () => {
    if (!tokenId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const cachedCandles = await dedupRequest(
        `candles:${tokenId}:${interval}:${limit}`,
        () => clobCircuitBreaker.execute(() => getCandles(tokenId, interval, limit))
      );
      
      const processed = computeAllIndicators(cachedCandles);
      setCandles(processed);
      setIndicatorsData(cachedCandles);
      setLastUpdate(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch candles");
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  createEffect(() => {
    void fetchCandles();
  });
  
  // Auto-refresh
  createEffect(() => {
    if (!autoRefresh || !tokenId) return;
    
    const timer = setInterval(() => {
      void fetchCandles();
    }, refreshIntervalMs);
    
    onCleanup(() => clearInterval(timer));
  });
  
  return {
    candles,
    indicators,
    loading,
    error,
    lastUpdate,
    refresh: fetchCandles,
  };
}

// Simple price history wrapper that converts to candles
export async function fetchPriceHistoryForChart(
  tokenId: string,
  interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d" = "1h"
): Promise<Candle[]> {
  return clobCircuitBreaker.execute(() => getCandles(tokenId, interval, 200));
}

// Compute all indicators for a given price array
export function computeIndicatorsFromPrices(prices: number[]): CandleIndicators | null {
  if (prices.length < SMA_PERIOD) return null;
  
  const sma = computeSMA(prices, SMA_PERIOD);
  const ema = computeEMA(prices, EMA_PERIOD_1);
  const rsi = computeRSI(prices, RSI_PERIOD);
  const macd = computeMACD(prices);
  const bb = computeBollingerBands(prices, BB_PERIOD, BB_STD);
  
  return {
    sma,
    ema,
    rsi,
    macd,
    bollingerUpper: bb.upper,
    bollingerMiddle: bb.middle,
    bollingerLower: bb.lower,
  };
}

// Volume analysis helpers
export interface VolumeAnalysis {
  avgVolume: number;
  maxVolume: number;
  minVolume: number;
  volumeTrend: "increasing" | "decreasing" | "stable";
  volumeStdDev: number;
  anomalyScore: number; // 0-1, higher = more anomalous
}

export function analyzeVolume(candles: Candle[]): VolumeAnalysis {
  if (candles.length === 0) {
    return {
      avgVolume: 0,
      maxVolume: 0,
      minVolume: 0,
      volumeTrend: "stable",
      volumeStdDev: 0,
      anomalyScore: 0,
    };
  }
  
  const volumes = candles.map((c) => c.volume);
  
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const maxVolume = Math.max(...volumes);
  const minVolume = Math.min(...volumes);
  
  // Compute trend (compare first half vs second half average)
  const halfLen = Math.floor(volumes.length / 2);
  const firstHalfAvg = volumes.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen;
  const secondHalfAvg = volumes.slice(halfLen).reduce((a, b) => a + b, 0) / (volumes.length - halfLen);
  
  let volumeTrend: "increasing" | "decreasing" | "stable";
  const ratio = secondHalfAvg / (firstHalfAvg || 1);
  if (ratio > 1.2) {
    volumeTrend = "increasing";
  } else if (ratio < 0.8) {
    volumeTrend = "decreasing";
  } else {
    volumeTrend = "stable";
  }
  
  // Compute standard deviation
  const variance = volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length;
  const volumeStdDev = Math.sqrt(variance);
  
  // Anomaly detection: current volume vs average
  const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const anomalyScore = Math.min(1, Math.abs(recentVolume - avgVolume) / (avgVolume * 3 || 1));
  
  return {
    avgVolume,
    maxVolume,
    minVolume,
    volumeTrend,
    volumeStdDev,
    anomalyScore,
  };
}

// Price momentum analysis
export interface MomentumAnalysis {
  currentPrice: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  momentumScore: number; // -100 to 100
  momentumLabel: "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
  volatilityScore: number; // 0-100
}

export function analyzeMomentum(candles: Candle[]): MomentumAnalysis {
  if (candles.length === 0) {
    return {
      currentPrice: 0,
      priceChange1h: 0,
      priceChange24h: 0,
      priceChange7d: 0,
      momentumScore: 0,
      momentumLabel: "neutral",
      volatilityScore: 0,
    };
  }
  
  const currentPrice = candles[candles.length - 1]!.close;
  
  // Find candles by time offset (approximate based on candle interval)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  // Find closest candle to each time
  const findClosest = (targetTime: number) => {
    let closest = candles[0]!;
    let minDiff = Math.abs(candles[0]!.time - targetTime);
    for (const c of candles) {
      const diff = Math.abs(c.time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = c;
      }
    }
    return closest;
  };
  
  const candle1h = findClosest(oneHourAgo);
  const candle24h = findClosest(oneDayAgo);
  const candle7d = findClosest(sevenDaysAgo);
  
  const priceChange1h = candle1h ? ((currentPrice - candle1h.close) / candle1h.close) * 100 : 0;
  const priceChange24h = candle24h ? ((currentPrice - candle24h.close) / candle24h.close) * 100 : 0;
  const priceChange7d = candle7d ? ((currentPrice - candle7d.close) / candle7d.close) * 100 : 0;
  
  // Momentum score: weighted average of recent changes
  const momentumScore = (priceChange1h * 0.5 + priceChange24h * 0.3 + priceChange7d * 0.2) * 10;
  
  let momentumLabel: MomentumAnalysis["momentumLabel"];
  if (momentumScore > 50) {
    momentumLabel = "strong_bullish";
  } else if (momentumScore > 20) {
    momentumLabel = "bullish";
  } else if (momentumScore < -50) {
    momentumLabel = "strong_bearish";
  } else if (momentumScore < -20) {
    momentumLabel = "bearish";
  } else {
    momentumLabel = "neutral";
  }
  
  // Volatility score: average true range percentage
  const priceRange = candles.map((c) => c.high - c.low);
  const avgRange = priceRange.reduce((a, b) => a + b, 0) / priceRange.length;
  const volatilityScore = Math.min(100, (avgRange / currentPrice) * 100 * 20);
  
  return {
    currentPrice,
    priceChange1h,
    priceChange24h,
    priceChange7d,
    momentumScore: Math.max(-100, Math.min(100, momentumScore)),
    momentumLabel,
    volatilityScore,
  };
}