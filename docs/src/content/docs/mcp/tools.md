---
title: MCP Tools Reference
description: Complete list of tools exposed by the polytui-dashboard MCP server.
---

All tools are available on both stdio and HTTP transports. Schemas use JSON Schema draft-07 notation.

## Market Tools

### `get_markets`

Fetch a list of active prediction markets.

```json
{
  "name": "get_markets",
  "description": "Fetch active prediction markets from Polymarket",
  "inputSchema": {
    "type": "object",
    "properties": {
      "limit": { "type": "number", "default": 20, "maximum": 100 },
      "category": { "type": "string", "description": "Filter by category slug" },
      "search": { "type": "string", "description": "Free-text search query" }
    }
  }
}
```

**Returns:** Array of market objects with `id`, `title`, `outcomes`, `volume24h`, `liquidity`.

### `get_market_detail`

Fetch full detail for a single market including price history and orderbook snapshot.

```json
{
  "name": "get_market_detail",
  "inputSchema": {
    "type": "object",
    "required": ["marketId"],
    "properties": {
      "marketId": { "type": "string" },
      "timeframe": { "type": "string", "enum": ["1h","4h","1d","5d","1w","1M","all"] }
    }
  }
}
```

### `search_markets`

Full-text search across market titles and descriptions.

```json
{
  "name": "search_markets",
  "inputSchema": {
    "type": "object",
    "required": ["query"],
    "properties": {
      "query": { "type": "string" },
      "limit": { "type": "number", "default": 10 }
    }
  }
}
```

## Trading Tools

### `place_order`

Place a limit order on Polymarket CLOB. Requires a connected wallet with sufficient USDC balance.

```json
{
  "name": "place_order",
  "inputSchema": {
    "type": "object",
    "required": ["marketId", "outcomeIndex", "side", "price", "size"],
    "properties": {
      "marketId": { "type": "string" },
      "outcomeIndex": { "type": "number", "enum": [0, 1] },
      "side": { "type": "string", "enum": ["buy", "sell"] },
      "price": { "type": "number", "minimum": 0.01, "maximum": 0.99 },
      "size": { "type": "number", "minimum": 0.01 },
      "orderType": { "type": "string", "enum": ["GTC","FOK","GTD","FAK"], "default": "GTC" },
      "postOnly": { "type": "boolean", "default": false }
    }
  }
}
```

> **Caution:** this tool executes real orders on Polygon mainnet. Validate price and size before calling.

### `cancel_order`

Cancel a specific open order by order ID.

```json
{
  "name": "cancel_order",
  "inputSchema": {
    "type": "object",
    "required": ["orderId"],
    "properties": {
      "orderId": { "type": "string" }
    }
  }
}
```

### `cancel_all_orders`

Cancel all open orders for the connected wallet.

```json
{
  "name": "cancel_all_orders",
  "inputSchema": { "type": "object", "properties": {} }
}
```

### `get_open_orders`

List all currently open orders for the connected wallet.

```json
{
  "name": "get_open_orders",
  "inputSchema": {
    "type": "object",
    "properties": {
      "marketId": { "type": "string", "description": "Filter to a specific market" }
    }
  }
}
```

### `get_trade_history`

Fetch filled trade history.

```json
{
  "name": "get_trade_history",
  "inputSchema": {
    "type": "object",
    "properties": {
      "limit": { "type": "number", "default": 20 },
      "marketId": { "type": "string" }
    }
  }
}
```

## Portfolio Tools

### `get_positions`

Return open positions with current market prices and unrealized P&L.

```json
{
  "name": "get_positions",
  "inputSchema": { "type": "object", "properties": {} }
}
```

### `get_wallet_balance`

Return USDC balance on Polygon (native + bridged).

```json
{
  "name": "get_wallet_balance",
  "inputSchema": { "type": "object", "properties": {} }
}
```

## Alert Tools

### `create_alert`

Create a new price alert.

```json
{
  "name": "create_alert",
  "inputSchema": {
    "type": "object",
    "required": ["marketId", "condition", "threshold"],
    "properties": {
      "marketId": { "type": "string" },
      "condition": { "type": "string", "enum": ["above","below","crossesAbove","crossesBelow"] },
      "threshold": { "type": "number" },
      "metric": { "type": "string", "enum": ["price","change24h","volume24h","liquidity"], "default": "price" },
      "cooldownMinutes": { "type": "number", "default": 60 }
    }
  }
}
```

### `list_alerts`

Return all active alert definitions.

### `delete_alert`

Delete an alert by ID.

## UI Tools

### `open_panel`

Programmatically open a named panel in the TUI (only effective when the TUI is also running).

```json
{
  "name": "open_panel",
  "inputSchema": {
    "type": "object",
    "required": ["panel"],
    "properties": {
      "panel": {
        "type": "string",
        "enum": [
          "order_form","order_history","portfolio","alerts","wallet",
          "analytics","settings","chat","news","social","automation","skills"
        ]
      }
    }
  }
}
```

### `set_selected_market`

Navigate the TUI to a specific market by ID.

```json
{
  "name": "set_selected_market",
  "inputSchema": {
    "type": "object",
    "required": ["marketId"],
    "properties": {
      "marketId": { "type": "string" }
    }
  }
}
```

## Error Handling

All tools return a `CallToolResult`. On error, `isError: true` and `content[0].text` contains the error message. Trading tools additionally include error context from the CLOB API where available.
