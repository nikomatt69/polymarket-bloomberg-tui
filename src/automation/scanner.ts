export interface MarketInfo {
  id: string;
  question: string;
  volume: number;
  prices: number[];
  outcomes: string[];
  liquidity?: number;
  endDate?: string;
}

export interface ScanResult {
  type: "volume_spike" | "price_movement" | "arbitrage" | "low_liquidity";
  marketId: string;
  marketTitle: string;
  severity: "low" | "medium" | "high";
  message: string;
  details?: Record<string, unknown>;
}

export interface ScannerConfig {
  volumeSpikeThreshold: number;
  priceMovementThreshold: number;
  minLiquidity: number;
  checkArbitrage: boolean;
}

const DEFAULT_CONFIG: ScannerConfig = {
  volumeSpikeThreshold: 3.0,
  priceMovementThreshold: 10,
  minLiquidity: 1000,
  checkArbitrage: true,
};

export class MarketScanner {
  private previousVolume: Map<string, number> = new Map();
  private previousPrices: Map<string, number[]> = new Map();
  private config: ScannerConfig;

  constructor(config: Partial<ScannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  scanMarkets(markets: MarketInfo[]): ScanResult[] {
    const results: ScanResult[] = [];

    for (const market of markets) {
      const volumeSpike = this.checkVolumeSpike(market);
      if (volumeSpike) results.push(volumeSpike);

      const priceMovement = this.checkPriceMovement(market);
      if (priceMovement) results.push(priceMovement);

      if (this.config.checkArbitrage) {
        const arbitrage = this.checkArbitrage(market);
        if (arbitrage) results.push(arbitrage);
      }

      const lowLiquidity = this.checkLowLiquidity(market);
      if (lowLiquidity) results.push(lowLiquidity);
    }

    this.updateHistory(markets);
    return results;
  }

  private checkVolumeSpike(market: MarketInfo): ScanResult | null {
    const previousVolume = this.previousVolume.get(market.id);
    if (!previousVolume || previousVolume === 0) return null;

    const volumeChange = market.volume / previousVolume;
    if (volumeChange >= this.config.volumeSpikeThreshold) {
      return {
        type: "volume_spike",
        marketId: market.id,
        marketTitle: market.question,
        severity: volumeChange >= 5 ? "high" : "medium",
        message: `Volume spiked ${volumeChange.toFixed(1)}x ($${previousVolume.toLocaleString()} → $${market.volume.toLocaleString()})`,
        details: { previousVolume, currentVolume: market.volume, multiplier: volumeChange },
      };
    }
    return null;
  }

  private checkPriceMovement(market: MarketInfo): ScanResult | null {
    const previousPrices = this.previousPrices.get(market.id);
    if (!previousPrices || previousPrices.length === 0 || market.prices.length === 0) return null;

    const currentPrice = market.prices[0];
    const previousPrice = previousPrices[0];
    if (!currentPrice || !previousPrice || previousPrice === 0) return null;

    const percentChange = Math.abs(((currentPrice - previousPrice) / previousPrice) * 100);
    if (percentChange >= this.config.priceMovementThreshold) {
      return {
        type: "price_movement",
        marketId: market.id,
        marketTitle: market.question,
        severity: percentChange >= 25 ? "high" : percentChange >= 15 ? "medium" : "low",
        message: `Price moved ${percentChange.toFixed(1)}% (${(previousPrice * 100).toFixed(1)}¢ → ${(currentPrice * 100).toFixed(1)}¢)`,
        details: { previousPrice, currentPrice, percentChange },
      };
    }
    return null;
  }

  private checkArbitrage(market: MarketInfo): ScanResult | null {
    if (market.prices.length < 2) return null;

    const sum = market.prices.reduce((a, b) => a + b, 0);
    const totalProbability = sum * 100;

    if (totalProbability < 99 || totalProbability > 101) {
      const deviation = totalProbability - 100;
      return {
        type: "arbitrage",
        marketId: market.id,
        marketTitle: market.question,
        severity: Math.abs(deviation) >= 5 ? "high" : "medium",
        message: `Probabilities sum to ${totalProbability.toFixed(1)}% (potential arb: ${Math.abs(deviation).toFixed(1)}%)`,
        details: { prices: market.prices, sum: totalProbability },
      };
    }
    return null;
  }

  private checkLowLiquidity(market: MarketInfo): ScanResult | null {
    const liquidity = market.liquidity || market.volume * 0.1;
    if (liquidity < this.config.minLiquidity) {
      return {
        type: "low_liquidity",
        marketId: market.id,
        marketTitle: market.question,
        severity: liquidity < this.config.minLiquidity / 10 ? "high" : "medium",
        message: `Low liquidity: $${liquidity.toLocaleString()} (min: $${this.config.minLiquidity.toLocaleString()})`,
        details: { liquidity, minLiquidity: this.config.minLiquidity },
      };
    }
    return null;
  }

  private updateHistory(markets: MarketInfo[]): void {
    for (const market of markets) {
      this.previousVolume.set(market.id, market.volume);
      this.previousPrices.set(market.id, [...market.prices]);
    }
  }

  getAlerts(results: ScanResult[], minSeverity: "low" | "medium" | "high" = "medium"): ScanResult[] {
    const severityOrder = { low: 0, medium: 1, high: 2 };
    return results.filter((r) => severityOrder[r.severity] >= severityOrder[minSeverity]);
  }

  clearHistory(): void {
    this.previousVolume.clear();
    this.previousPrices.clear();
  }
}
