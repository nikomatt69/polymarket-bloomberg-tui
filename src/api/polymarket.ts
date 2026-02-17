/**
 * Polymarket API client for fetching market data
 * Uses Gamma API for markets and CLOB API for price history
 */

import { Market, Outcome, PriceHistory, PricePoint } from "../types/market";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CLOB_API_BASE = "https://clob.polymarket.com";

interface GammaMarket {
  id: string;
  question: string | null;
  conditionId: string;
  slug: string | null;
  endDate: string | null;
  category: string | null;
  liquidity: string | null;
  description: string | null;
  outcomes: string | null;
  outcomePrices: string | null;
  volume: string | null;
  active: boolean | null;
  closed: boolean | null;
  volumeNum: number | null;
  liquidityNum: number | null;
  volume24hr: number | null;
  oneDayPriceChange: number | null;
  clobTokenIds: string | null;
}

function parseGammaMarket(market: GammaMarket): Market {
  const outcomes = market.outcomes ? JSON.parse(market.outcomes) : ["Yes", "No"];
  const outcomePrices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [0.5, 0.5];
  const clobTokenIds = market.clobTokenIds ? JSON.parse(market.clobTokenIds) : [];

  const outcomeList: Outcome[] = outcomes.map((title: string, i: number) => ({
    id: clobTokenIds[i] || `outcome_${i}`,
    title,
    price: parseFloat(outcomePrices[i]) || 0.5,
    volume24h: 0,
    volume: 0,
    liquidity: 0,
    change24h: 0,
  }));

  return {
    id: market.id,
    title: market.question || "Unknown Market",
    description: market.description || "",
    outcomes: outcomeList,
    volume24h: market.volume24hr || 0,
    volume: parseFloat(market.volume || "0"),
    liquidity: parseFloat(market.liquidity || "0") || market.liquidityNum || 0,
    change24h: market.oneDayPriceChange || 0,
    openInterest: 0,
    resolutionDate: market.endDate ? new Date(market.endDate) : undefined,
    totalTrades: 0,
    category: market.category || "general",
    closed: market.closed || false,
    resolved: false,
  };
}

export async function getMarkets(limit: number = 50): Promise<Market[]> {
  try {
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?limit=${limit}&closed=false&order=volumeNum&ascending=false`
    );

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.error("Unexpected API response:", data);
      return getMockMarkets(limit);
    }

    return data.map(parseGammaMarket);
  } catch (error) {
    console.error("Failed to fetch from Gamma API:", error);
    return getMockMarkets(limit);
  }
}

export async function getMarketDetails(marketId: string): Promise<Market | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/markets?id=${marketId}`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return parseGammaMarket(data[0]);
  } catch (error) {
    console.error("Failed to fetch market details:", error);
    return null;
  }
}

export async function getPriceHistory(
  marketId: string,
  timeframe: "1d" | "5d" | "7d" | "all" = "7d"
): Promise<PriceHistory> {
  try {
    const marketDetails = await getMarketDetails(marketId);
    if (!marketDetails || marketDetails.outcomes.length === 0) {
      return generateSyntheticHistory(marketId, timeframe);
    }

    const tokenId = marketDetails.outcomes[0]?.id;
    if (!tokenId) {
      return generateSyntheticHistory(marketId, timeframe);
    }

    const intervalMap: Record<string, string> = {
      "1d": "1h",
      "5d": "1d",
      "7d": "1d",
      "all": "1w",
    };

    const response = await fetch(
      `${CLOB_API_BASE}/prices-history?market=${tokenId}&interval=${intervalMap[timeframe]}`
    );

    if (!response.ok) {
      return generateSyntheticHistory(marketId, timeframe);
    }

    const json = await response.json();
    const data = json as { history?: Array<{ t: number; p: number }> };

    if (!data.history || !Array.isArray(data.history)) {
      return generateSyntheticHistory(marketId, timeframe);
    }

    const pricePoints: PricePoint[] = data.history.map((point) => ({
      timestamp: point.t * 1000,
      price: point.p / 100,
      outcomeId: tokenId,
    }));

    return {
      marketId,
      outcomeId: tokenId,
      data: pricePoints,
      timeframe,
    };
  } catch (error) {
    console.error("Failed to fetch price history:", error);
    return generateSyntheticHistory(marketId, timeframe);
  }
}

function generateSyntheticHistory(
  marketId: string,
  timeframe: "1d" | "5d" | "7d" | "all"
): PriceHistory {
  const data: PricePoint[] = [];
  const now = Date.now();
  
  const points = timeframe === "1d" ? 24 : timeframe === "5d" ? 120 : timeframe === "7d" ? 168 : 720;
  const interval = timeframe === "1d" ? 3600000 : timeframe === "5d" ? 3600000 : timeframe === "7d" ? 3600000 : 3600000;

  for (let i = 0; i < points; i++) {
    const price = 0.4 + Math.sin((i / points) * Math.PI) * 0.2 + Math.random() * 0.1;
    data.push({
      timestamp: now - (points - i) * interval,
      price: Math.max(0.01, Math.min(0.99, price)),
      outcomeId: "synthetic",
    });
  }

  return {
    marketId,
    outcomeId: "all",
    data,
    timeframe,
  };
}

function getMockMarkets(limit: number): Market[] {
  const mockQuestions = [
    "Will BTC reach $200K by end of 2026?",
    "Will ETH flip BTC market cap by 2027?",
    "Will AI pass Turing test by 2027?",
    "Will US enter recession in 2026?",
    "Will Bitcoin ETF be approved in 2026?",
    "Will Solana flip Ethereum by TVL?",
    "Will SpaceX go public by 2027?",
    "Will Apple release AR glasses?",
    "Will Trump win 2028 election?",
    "Will Fed cut rates to 0%?",
    "Will Ethereum upgrade to PoS?",
    "Will crypto regulation pass US?",
    "Will Tesla Robotaxi launch?",
    "Will nuclear fusion work?",
    "Will Mars colony happen?",
  ];

  return mockQuestions.slice(0, limit).map((question, i) => ({
    id: `market_${i + 1}`,
    title: question,
    description: `Prediction market for: ${question}`,
    outcomes: [
      { id: `yes_${i}`, title: "Yes", price: 0.3 + Math.random() * 0.4, volume24h: Math.random() * 1000000, volume: Math.random() * 5000000, liquidity: Math.random() * 2000000, change24h: (Math.random() - 0.5) * 20 },
      { id: `no_${i}`, title: "No", price: 0.3 + Math.random() * 0.4, volume24h: Math.random() * 1000000, volume: Math.random() * 5000000, liquidity: Math.random() * 2000000, change24h: (Math.random() - 0.5) * 20 },
    ],
    volume24h: Math.random() * 2000000,
    volume: Math.random() * 10000000,
    liquidity: Math.random() * 5000000,
    change24h: (Math.random() - 0.5) * 20,
    openInterest: Math.random() * 3000000,
    resolutionDate: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000),
    totalTrades: Math.floor(Math.random() * 50000),
    category: ["crypto", "politics", "economy", "tech", "science"][Math.floor(Math.random() * 5)],
    closed: false,
    resolved: false,
  }));
}

export async function searchMarkets(query: string): Promise<Market[]> {
  const allMarkets = await getMarkets(100);
  return allMarkets.filter(
    (m) =>
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(query.toLowerCase()))
  );
}
