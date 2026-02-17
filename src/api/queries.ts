/**
 * GraphQL query definitions for Polymarket subgraph
 */

export const GET_MARKETS_QUERY = `
  query GetMarkets($first: Int!, $skip: Int!) {
    markets(first: $first, skip: $skip, orderBy: volume, orderDirection: desc) {
      id
      title
      description
      outcomes {
        id
        title
      }
      volume
      liquidityBin
      createdTime
      closingTime
      closed
      resolved
    }
  }
`;

export const GET_MARKET_DETAILS_QUERY = `
  query GetMarketDetails($id: ID!) {
    market(id: $id) {
      id
      title
      description
      outcomes {
        id
        title
        price
        volume
      }
      volume
      liquidityBin
      createdTime
      closingTime
      closed
      resolved
      openInterest
    }
  }
`;

export const GET_OUTCOMES_QUERY = `
  query GetOutcomes($marketId: ID!) {
    outcomes(where: { market: $marketId }) {
      id
      title
      market {
        id
      }
      price
      volume
    }
  }
`;

export const GET_PRICE_HISTORY_QUERY = `
  query GetPriceHistory($marketId: ID!, $skip: Int!) {
    priceHistories(
      first: 100
      skip: $skip
      where: { market: $marketId }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      timestamp
      price
      outcome {
        id
        title
      }
    }
  }
`;

export const GET_MARKET_TRADES_QUERY = `
  query GetMarketTrades($marketId: ID!) {
    trades(where: { market: $marketId }, orderBy: timestamp, orderDirection: desc, first: 10) {
      id
      timestamp
      buyer
      outcome {
        id
        title
      }
      shares
      price
    }
  }
`;
