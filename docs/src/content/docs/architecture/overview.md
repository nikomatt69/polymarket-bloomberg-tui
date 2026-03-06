---
title: Architecture Overview
description: High-level runtime, module boundaries, and data flow.
---

## Runtime Stack

- Runtime: Bun
- UI: SolidJS with `@opentui/solid`
- Rendering target: terminal, not browser DOM
- Market/trading backend: Polymarket Gamma + CLOB APIs

## Entry And Composition

1. `src/index.tsx` registers OpenTUI 3D extension and renders `<App />`.
2. `src/app.tsx` bootstraps state, hooks, services, and the global keyboard dispatcher.
3. `src/components/layout.tsx` composes top bar, market workspace, status/footer, and all modal overlays.

## Top-Level Module Map

```text
src/
  app.tsx                 # App bootstrap and global key handling
  state.ts                # Global stores/signals + persistence helpers
  api/                    # Gamma/CLOB/data/ws/assistant integrations
  auth/                   # Wallet and local auth logic
  hooks/                  # Lifecycle and feature orchestration hooks
  components/             # Panels, overlays, tables, and TUI widgets
  types/                  # Shared domain models
  utils/                  # Formatting, analytics, chart helpers
```

## Startup Lifecycle

At runtime, `AppContent` in `src/app.tsx` initializes the app in this order:

1. State and persisted preferences (`initializeState`, `initializeFilters`, `initializeAuth`, `initializeMessages`)
2. Market data and refresh loop (`useMarketsFetch`, `useRefreshInterval`)
3. Wallet state (`initializeWallet`)
4. Alerts/watchlist persistence (`loadAlerts`, `loadWatchlist`)
5. WebSocket channels (`initializeWebSocket`, `useRealtimeData`)
6. Automation and skills persistence (`loadRules`, `loadSkills`)
7. Optional MCP HTTP server and Telegram bot bootstrap

## Data Refresh Loop

Primary market refresh behavior lives in `src/hooks/useMarketData.ts`:

- Initial market fetch via `getMarkets(50)`
- 30-second interval refresh (category aware)
- Post-refresh side effects:
  - alert evaluation
  - automation cycle
  - token re-subscription for live prices

## Overlay Model

`src/components/layout.tsx` renders all panels and modals through `<Show when={...}>` gates and applies:

- a shared backdrop layer (`position="absolute"`, `zIndex={90}`)
- per-panel overlay components
- enterprise chat as highest-priority full-screen overlay

Keyboard capture priority for overlays is documented in [State and Keyboard Model](/architecture/state-and-keyboard/).
