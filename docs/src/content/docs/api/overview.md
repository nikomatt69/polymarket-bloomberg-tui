---
title: API Overview
description: Gamma/CLOB/data APIs, websocket clients, and assistant tooling.
---

## API Surface Layout

The API layer is split by responsibility under `src/api/`:

- `polymarket.ts`: consolidated market and quote facade used by most UI features
- `gamma/*`: market/event/tag/category/search endpoints (discovery and metadata)
- `clob/*`: price, orderbook, and trading endpoints
- `data/*`: positions, activity, profile-style data helpers
- `websocket.ts` and `ws.ts`: CLOB user/market websocket wiring
- `realtime.ts`: RTDS and sports websocket clients
- `assistant.ts`: AI streaming and tool-call integration
- `messages.ts`, `sessions.ts`, `skills.ts`: chat and assistant persistence adapters

## Endpoint Constants

Shared constants are defined in `src/api/queries.ts`:

- `GAMMA_BASE_URL = https://gamma-api.polymarket.com`
- `CLOB_BASE_URL = https://clob.polymarket.com`
- timeframe to interval mapping for CLOB history requests
- shared batch-limit constants and query builders

## Market Data Pipeline

`src/api/polymarket.ts` performs the main market pipeline:

1. Fetch Gamma market payloads.
2. Normalize into internal `Market`/`Outcome` models.
3. Enrich outcomes with CLOB orderbook midpoint/last-trade data.
4. Expose category, search, trending, sports, and depth helpers.

This is the source consumed by `useMarketData` and most components.

## Trading And Auth

Trading entrypoints are re-exported through `src/api/orders.ts` from `src/api/clob/trading.ts`.

Authentication/signing is handled in `src/auth/wallet.ts`:

- private key validation and local wallet persistence
- CLOB L1 auth headers (typed-data signature)
- CLOB L2 HMAC headers (API key/secret/passphrase)
- USDC balance retrieval on Polygon (native and bridged contracts)

## Realtime Channels

Two websocket paths are used:

- CLOB websocket facade (`src/api/websocket.ts`) for token price stream updates
- RTDS + sports clients (`src/api/realtime.ts`) for activity feeds and live sports scores

Realtime updates are pushed to state via `addMarketUpdate()` and connection status signals.

## AI Assistant Integration

`src/api/assistant.ts` streams model output and tool calls with `streamText(...)`.

- Provider selection is driven by persisted AI provider config in `src/state.ts`.
- Tool calls can query markets, open panels, place/cancel orders, and inspect wallet/positions.
- Session persistence is handled by `src/api/sessions.ts`.

## Extension Pattern

To add a new API capability:

1. Add a typed function in the right module (`gamma`, `clob`, `data`, or facade).
2. Reuse `buildQueryString` and numeric normalization helpers where applicable.
3. Return internal domain models, not raw payloads.
4. Wire usage through a hook or panel action, not direct component-side fetches.
