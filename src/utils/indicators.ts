export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorValue {
  time: number;
  value: number;
}

export interface IndicatorResult {
  name: string;
  values: IndicatorValue[];
}

export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / period;
      sma.push(avg);
    }
  }
  return sma;
}

export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sum += data[i];
      ema.push(NaN);
    } else if (i === period - 1) {
      const avg = sum / period;
      ema.push(avg);
    } else {
      const prevEma = ema[i - 1];
      const currentEma = (data[i] - prevEma) * multiplier + prevEma;
      ema.push(currentEma);
    }
  }
  return ema;
}

export function calculateRSI(data: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  rsi.push(NaN);
  
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      rsi.push(NaN);
      continue;
    }
    
    const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  return rsi;
}

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function calculateMACD(
  data: number[], 
  fastPeriod: number = 12, 
  slowPeriod: number = 26, 
  signalPeriod: number = 9
): MACDResult {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  const macdLine: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  const validMACD = macdLine.filter(v => !isNaN(v));
  const signalEMA = calculateEMA(validMACD, signalPeriod);
  
  const signal: number[] = [];
  const histogram: number[] = [];
  let validIdx = 0;
  
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) {
      signal.push(NaN);
      histogram.push(NaN);
    } else {
      if (validIdx < signalEMA.length) {
        signal.push(signalEMA[validIdx]);
        histogram.push(macdLine[i] - signalEMA[validIdx]);
        validIdx++;
      }
    }
  }
  
  return { macd: macdLine, signal, histogram };
}

export interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function calculateBollingerBands(
  data: number[], 
  period: number = 20, 
  stdDev: number = 2
): BollingerBands {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = data.slice(Math.max(0, i - period + 1), i + 1);
      const mean = middle[i];
      const squaredDiffs = slice.map(v => Math.pow(v - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / slice.length;
      const std = Math.sqrt(variance);
      
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }
  
  return { upper, middle, lower };
}

export interface PivotPoints {
  pivot: number[];
  r1: number[];
  r2: number[];
  r3: number[];
  s1: number[];
  s2: number[];
  s3: number[];
}

export function calculatePivotPoints(highs: number[], lows: number[], closes: number[]): PivotPoints {
  const pivot: number[] = [];
  const r1: number[] = [];
  const r2: number[] = [];
  const r3: number[] = [];
  const s1: number[] = [];
  const s2: number[] = [];
  const s3: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const prevClose = closes[i - 1];
    const prevHigh = highs[i - 1];
    const prevLow = lows[i - 1];
    
    const pp = (prevHigh + prevLow + prevClose) / 3;
    pivot.push(pp);
    
    r1.push(2 * pp - prevLow);
    s1.push(2 * pp - prevHigh);
    r2.push(pp + (prevHigh - prevLow));
    s2.push(pp - (prevHigh - prevLow));
    r3.push(prevHigh + 2 * (pp - prevLow));
    s3.push(prevLow - 2 * (prevHigh - pp));
  }
  
  return { pivot, r1, r2, r3, s1, s2, s3 };
}

export function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const atr: number[] = [NaN];
  
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    
    if (i < period) {
      atr.push(NaN);
    } else if (i === period) {
      const sum = atr.slice(1, i + 1).reduce((a, b) => a + b, 0) / period;
      atr.push(sum);
    } else {
      const prevAtr = atr[i - 1];
      atr.push((prevAtr * (period - 1) + tr) / period);
    }
  }
  
  return atr;
}

export function calculateStochastic(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  kPeriod: number = 14, 
  dPeriod: number = 3
): { k: number[]; d: number[] } {
  const k: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < kPeriod - 1) {
      k.push(NaN);
    } else {
      const sliceHighs = highs.slice(i - kPeriod + 1, i + 1);
      const sliceLows = lows.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...sliceHighs);
      const lowestLow = Math.min(...sliceLows);
      
      if (highestHigh === lowestLow) {
        k.push(50);
      } else {
        k.push(((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100);
      }
    }
  }
  
  const d = calculateSMA(k.filter(v => !isNaN(v)), dPeriod);
  
  const dResult: number[] = [];
  let validIdx = 0;
  for (let i = 0; i < k.length; i++) {
    if (isNaN(k[i])) {
      dResult.push(NaN);
    } else {
      dResult.push(d[validIdx] || NaN);
      validIdx++;
    }
  }
  
  return { k, d: dResult };
}
