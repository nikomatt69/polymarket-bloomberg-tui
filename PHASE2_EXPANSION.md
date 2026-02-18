# Phase 2 Expansion - Execution Tracker

Last updated: 2026-02-18

## Mission

Transform the TUI from a read-only monitor into a Bloomberg-style Polymarket trading terminal with:

1. Wallet and account intelligence
2. Real order entry and lifecycle management
3. Alerts and analytics on live data only
4. High-signal UX for fast decision making
5. Durable local persistence

No mocks, no synthetic runtime data, no placeholder flows.

---

## Current Status Snapshot

### Quarter 1 - Foundation (mostly complete)

- [x] Wallet connect/disconnect with local secure persistence (`~/.polymarket-tui/wallet.json`)
- [x] USDC balance loading and wallet initialization on startup
- [x] CLOB auth foundation (L1 typed auth + L2 HMAC headers)
- [x] Position tracking from Data API (`/positions`) and portfolio panel
- [x] Core market data flow from Gamma API (no mock fallback)
- [x] Price history from CLOB (`/prices-history`) with timeframe handling
- [x] Selected-market panel upgrade (market pulse, trend, regime, depth context)
- [x] Outcome table enriched with live bid/ask/spread/depth snapshot

### Quarter 2 - Core Trading (in progress, advanced items pending)

- [x] Order form with BUY/SELL and GTC/FOK/GTD
- [x] EIP-712 order signing against CTF Exchange domain
- [x] Place order via CLOB `POST /order` with L2 headers
- [x] Cancel order via CLOB `DELETE /order`
- [x] Open orders fetch (`GET /data/orders`)
- [x] Trade history fetch (`GET /data/trades`)
- [x] Order history panel with cancellation and status coloring
- [x] Account stats modal (`U`) tied to real wallet/positions/trades state
- [x] Order history filters (status/market/date)
- [x] CSV export and replay/duplicate order action

### Quarter 3 - Advanced Features (in progress)

- [x] Alerts persisted to `~/.polymarket-tui/alerts.json`
- [x] Alert trigger engine with system bell notification
- [x] Multi-metric alerts: price, 24h change, 24h volume, liquidity
- [x] Technical indicators panel on real historical data (SMA/RSI/MACD/Bollinger)
- [x] Sentiment panel with Anthropic integration (hard fail if API key missing, no fake output)
- [x] Comparison panel and watchlist panel overlays
- [ ] View manager fully unified with layout persistence
- [ ] Theme selector and persisted theme mode

### Quarter 4 - Polish and Expansion (not started)

- [ ] Multi-watchlist sets and categories
- [ ] Dashboard layout customization (show/hide/reorder/width)
- [ ] Session sharing (termcast)
- [ ] Notes/insight layer
- [ ] Web/mobile companion track

---

## Implemented in this cycle

1. Removed synthetic/mock market and chart runtime fallbacks; APIs now fail explicitly instead of inventing data.
2. Corrected CLOB price history normalization and timeframe mapping.
3. Added order book integration (`/book`) and surfaced microstructure metrics in market details and outcomes table.
4. Fixed order submission token routing to use selected outcome token id in the order form flow.
5. Reworked wallet auth primitives for proper CLOB L1/L2 header generation.
6. Reworked order API integration for place/cancel/open/trades with L2 auth.
7. Upgraded chart intelligence with trend, move, volatility, SMA overlays, and RSI state.
8. Replaced indicator and sentiment mock behavior with live-data-only behavior.
9. Expanded alerts from price-only to multi-metric alerts with keyboard metric selection.
10. Integrated account analytics modal into global keyboard flow (`U`).
11. Fixed build pipeline with OpenTUI Solid Bun plugin and added `build:mahari` script.
12. Added order history filtering (status/range/selected-market/search), CSV export, and duplicate-to-order-form flow.
13. Added human-readable CLOB error translation for common placement/cancel failures.
14. Added side filter and quick status hotkeys for order history triage.
15. Added dual-cursor order-history navigation (open orders vs trade history) with `TAB` section switching.
16. Added post-only toggle in order form with runtime validation against FOK.
17. Added bulk cancel actions for all open orders and selected-market orders.

---

## Ordered Remaining Plan (next execution sequence)

### Q2 - Finish Core Trading

1. Add side-specific history filter and quick jump by order status.
2. Add per-market replay from trade rows (secondary selection cursor).
3. Add optional post-only order toggle in order form.
4. Add bulk cancel actions (selected market / all open).

Status: Completed.

Next Q2 focus:

1. Add per-order cancel reason drilldown in order history rows.
2. Add explicit status badges for delayed/unmatched retry guidance.
3. Add optional pre-submit sanity checks for notional and spread distance.
4. Add market-depth-aware slippage warning in order form.

### Q3 - Complete Power Features

1. Unify view manager with the top-level layout and persist the active view.
2. Add persistent theme mode control (dark/light) with keyboard toggle.
3. Expand account analytics with monthly section and market concentration risk.
4. Add alert cooldown/debounce options to avoid repeated noise.

### Q4 - UX and ecosystem

1. Multi-watchlist architecture and watchlist groups.
2. Dashboard composition controls.
3. Session sharing and notes.
4. Companion app track kickoff.

---

## Validation Protocol

Run on every milestone:

- `bun run type-check`
- `bun run build`
- `bun run dev`

If an external API is unavailable, UI must show explicit unavailable/error state and never substitute fake market/trading data.

---

## Keybindings in active use

- `W` wallet
- `O` buy, `S` sell
- `H` order history
- `P` portfolio
- `U` account stats
- `Z` alerts
- `I` indicators
- `M` sentiment
- `C` comparison
- `L` watchlist
- `X` watch toggle, `F` watch filter
- `R` refresh
- `Ctrl+K` sort cycle
- `1 / 5 / 7 / A` timeframe
- `Q` quit

Order history panel keys:

- `V` status filter
- `1-7` quick status presets
- `B` side filter
- `G` date-window filter
- `M` selected-market toggle
- `TAB` switch section (open/trades)
- `/` search edit, `X` clear search
- `E` export CSV
- `D` duplicate selected order into order form
- `A` cancel all open, `Y` cancel selected-market open

Order form panel keys:

- `T` order type (GTC/FOK/GTD)
- `P` post-only toggle
