/**
 * Market data types for Polymarket API responses
 */

export interface Outcome {
  id: string;
  title: string;
  price: number; // 0-1 (0% to 100%)
  volume24h: number;
  volume: number;
  liquidity: number;
  change24h: number; // percentage change
}

export interface Market {
  id: string;
  title: string;
  description?: string;
  outcomes: Outcome[];
  volume24h: number;
  volume: number;
  liquidity: number;
  change24h: number; // percentage change
  openInterest?: number;
  resolutionDate?: Date;
  totalTrades?: number;
  category?: string; // "politics", "economics", "crypto", etc.
  closed?: boolean;
  resolved?: boolean;
}

export interface PricePoint {
  timestamp: number;
  price: number;
  outcomeId: string;
}

export interface PriceHistory {
  marketId: string;
  outcomeId: string;
  data: PricePoint[];
  timeframe: '1d' | '5d' | '7d' | 'all';
}

export interface AppState {
  markets: Market[];
  selectedMarketId: string | null;
  searchQuery: string;
  sortBy: 'volume' | 'change' | 'name';
  timeframe: '1d' | '5d' | '7d' | 'all';
  loading: boolean;
  error: string | null;
  lastRefresh: Date;
}

export interface PersistentState {
  selectedMarketId: string | null;
  searchQuery: string;
  sortBy: 'volume' | 'change' | 'name';
  timeframe: '1d' | '5d' | '7d' | 'all';
  activeView?: 'market' | 'portfolio';
  themeMode?: 'dark' | 'light';
  themeName?: string;
}

export interface WalletState {
  address: string | null;
  connected: boolean;
  balance: number; // USDC
  username?: string;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  loading: boolean;
  error: string | null;
}

// Polymarket Event - contains markets, series info, tags
export interface Event {
  id: string;
  title: string;
  description?: string;
  slug: string;
  startDate?: string;
  endDate?: string;
  seriesId?: string;
  seriesName?: string;
  markets: Market[];
  tags?: string[];
  status: "upcoming" | "live" | "resolved";
}

// Polymarket Series - collection of related markets (NBA, NFL, Elections, etc.)
export interface Series {
  id: string;
  slug: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  activeMarketsCount?: number;
}

// Polymarket Tag - categorization tag for markets
export interface Tag {
  id: string;
  slug: string;
  name: string;
  category?: string;
  marketsCount?: number;
}

// Category info for filtering markets
export interface Category {
  slug: string;
  name: string;
  marketsCount: number;
}
