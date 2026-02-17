/**
 * Order types for Polymarket CLOB trading
 */

export type OrderSide = "BUY" | "SELL";
export type OrderStatus = "LIVE" | "MATCHED" | "CANCELLED" | "DELAYED" | "FILLED" | "UNMATCHED";
export type OrderType = "GTC" | "FOK" | "GTD";

export interface Order {
  tokenId: string;       // CLOB token ID (outcome ID)
  side: OrderSide;
  price: number;         // 0-1
  shares: number;        // number of shares
  type: OrderType;       // time-in-force
  marketId?: string;     // gamma market ID for display
  outcomeTitle?: string;
  marketTitle?: string;
}

export interface PlacedOrder {
  orderId: string;
  tokenId: string;
  side: OrderSide;
  price: number;
  originalSize: number;
  sizeMatched: number;
  sizeRemaining: number;
  status: OrderStatus;
  createdAt: number;     // unix ms
  marketTitle?: string;
  outcomeTitle?: string;
}

export interface OrderFormState {
  open: boolean;
  tokenId: string;
  side: OrderSide;
  marketTitle: string;
  outcomeTitle: string;
  currentPrice: number;
  // input fields
  priceInput: string;
  sharesInput: string;
  // cursor: 'price' | 'shares'
  focusField: "price" | "shares";
}
