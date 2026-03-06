---
title: State And Keyboard Model
description: Global state conventions, persistence, and keyboard dispatch strategy.
---

## State Design Principles

All shared UI and feature state is centralized in `src/state.ts`.

- `createStore()` is used for structured state trees (for example `appState`, `walletState`, filter and provider settings).
- `createSignal()` is used for modal visibility, selected indexes, and focused-field toggles.
- Persistence helpers are colocated with state mutators for consistency.

This keeps feature modules thin and predictable: components consume signals/stores, while mutations flow through exported state functions.

## Core State Domains

`src/state.ts` contains the primary domains:

- Market browsing state (`appState`, highlighted index, sort/timeframe/search)
- Wallet and auth session state
- Overlay/panel visibility signals
- Theme/provider preferences
- Enterprise chat and streaming tool inspector state
- WebSocket connection telemetry and latest token prices

## Persistence Strategy

`savePersistedState()` in `src/state.ts` writes the core browsing state (`selectedMarketId`, `searchQuery`, `sortBy`, `timeframe`, `activeView`) to `~/.polymarket-tui/config.json`.

Feature-specific persistence is implemented in its owning module (alerts, watchlist, rules, sessions, messages, skills, auth, wallet).

See [Persistence Reference](/reference/persistence/) for the full file map.

## Global Keyboard Architecture

The single keyboard dispatcher lives in `useKeyboard(...)` inside `src/app.tsx`.

### Dispatch Order

The handler processes keys with strict early-return priority:

1. Enterprise chat overlay
2. Order form
3. Order book panel
4. Order history
5. Indicators panel
6. Sentiment panel
7. Comparison panel
8. Watchlist / shortcuts / account / settings / banking / filter / analytics
9. Alerts panel
10. Auth modal
11. Wallet modal
12. Messages / profile / user search / news / social / automation / skills
13. Search input focus guard
14. Search panel
15. Overlay safety guard (`anyOverlayOpen`)
16. Global shortcuts switch

This ordering is critical: each active modal blocks lower-priority global shortcuts.

## Why This Matters

- No key collision between global shortcuts and focused modal inputs.
- Overlay behavior remains deterministic even as new panels are added.
- Exit and persistence behavior (`q`, `SIGINT`, `SIGTERM`) stays centralized.

## Adding New Keyboard Behavior Safely

When introducing a new panel or keybinding:

1. Add panel open-state signals in `src/state.ts`.
2. Add overlay rendering gate in `src/components/layout.tsx`.
3. Insert intercept logic in `src/app.tsx` before the global switch.
4. Ensure early `return` from intercept branch to block global fall-through.
5. Update [Keybindings Reference](/reference/keybindings/).
