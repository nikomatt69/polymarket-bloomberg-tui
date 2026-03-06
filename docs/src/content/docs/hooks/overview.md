---
title: Hooks Overview
description: Responsibilities and interactions of application hooks.
---

## Hook Philosophy

Hooks in this project orchestrate side effects and API/state bridges.

- Shared state remains in `src/state.ts`.
- Hooks connect external data/event streams to that state.
- Components mostly render and call state actions.

## Core Hooks

### `useMarketData` (`src/hooks/useMarketData.ts`)

- initial market fetch on startup
- periodic refresh with category awareness
- manual refresh trigger
- post-refresh automation and alert evaluation
- token subscription updates for market websocket

### `useWallet` (`src/hooks/useWallet.ts`)

- startup wallet hydration from local config
- private-key connection flow and credential derivation
- CLOB user websocket bootstrap after credentials are available
- wallet disconnect and balance refresh paths

### `useOrders` (`src/hooks/useOrders.ts`)

- order placement/cancel actions
- open/trade history refresh
- advanced history filters and search state
- bulk cancellation helpers and CSV export
- scoring refresh and heartbeat control based on open order state

### `useAlerts` (`src/hooks/useAlerts.ts`)

- alert CRUD and file persistence
- debounce/cooldown-based evaluation logic
- trigger history and terminal bell signaling
- panel sub-state for add-alert flow

### `useWatchlist` (`src/hooks/useWatchlist.ts`)

- persistent market-id set
- list filter toggle that is consumed by `getFilteredMarkets()`

### `useRealtime` (`src/hooks/useRealtime.ts`)

- RTDS client lifecycle
- selected-market activity subscription updates
- sports websocket lifecycle for sports markets
- connection telemetry updates in global state

### `useAssistant` (`src/hooks/useAssistant.ts`)

- chat input/focus management
- slash command handling
- streaming response and live tool call updates
- session initialization, load/save, and usage tracking

## Legacy Hook

`src/hooks/useKeyboardInput.ts` exists but global keyboard handling in this app is currently driven by `useKeyboard()` inside `src/app.tsx`.

## Adding New Hook Logic

When adding side effects:

1. Keep state definitions in `src/state.ts`.
2. Keep I/O and timers in hook files.
3. Use cleanup handlers (`onCleanup`) for intervals, websocket listeners, and process listeners.
4. Avoid duplicating fetch loops that already exist in `useMarketData`.
