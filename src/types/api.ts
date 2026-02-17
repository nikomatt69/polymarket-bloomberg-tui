/**
 * API response types for GraphQL queries
 */

export interface GraphQLMarketNode {
  id: string;
  title: string;
  description?: string;
  outcomes?: {
    id: string;
    title: string;
  }[];
  volume: string;
  liquidityBin: string;
  createdTime: string;
  closingTime: string;
}

export interface GraphQLOutcomeNode {
  id: string;
  market: {
    id: string;
    title: string;
  };
  price: string;
  volume: string;
  liquidity: string;
}

export interface GraphQLPriceHistory {
  id: string;
  timestamp: string;
  price: string;
  outcome: {
    id: string;
    title: string;
  };
}

export interface ClobMarket {
  id: string;
  question: string;
  description?: string;
  outcomes: ClobOutcome[];
  volume: string;
  openInterest?: string;
  createdTime?: number;
  closingTime?: number;
}

export interface ClobOutcome {
  id: string;
  title: string;
  price: string;
  volume: string;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}
