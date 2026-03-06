---
title: Layout And Panels
description: Main workspace structure, overlay stack, and panel responsibilities.
---

## Top-Level Layout

The root terminal composition is defined in `src/components/layout.tsx`.

Main structure:

1. `TopBar`
2. `SearchBar`
3. `QuickActions`
4. Main workspace split:
   - left `MarketList` (`52%` width)
   - right `MarketDetails` or `PortfolioPanel`
5. `StatusBar`
6. `Footer`

## Overlay Rendering Pattern

All modals/panels are rendered from the bottom of `Layout` via `<Show when={signal()}>` gates.

Behavior details:

- shared dimming backdrop (`position="absolute"`, `zIndex={90}`)
- each panel rendered as its own overlay component
- enterprise chat overlay is rendered at highest priority
- toast queue is rendered as a top-right floating layer (`zIndex={200}`)

## Key Component Groups

### Market Workspace

- `market-list.tsx`: category tabs, subcategories, infinite scroll, watchlist-aware filtering, realtime price overlay
- `market-details.tsx`: market analytics, orderbook snapshots, price history, outcomes, and sports score overlays
- `outcome-table.tsx`: per-outcome pricing/depth rows with action affordances

### Trading And Account Panels

- `order-form.tsx`
- `order-history.tsx`
- `order-book-panel.tsx`
- `portfolio-panel.tsx`
- `wallet-connect.tsx`
- `account-stats.tsx`

### Intelligence And Ops Panels

- `enterprise-chat.tsx`
- `alerts-panel.tsx`
- `analytics-panel.tsx`
- `automation-panel.tsx`
- `skills-panel.tsx`
- `sentiment-panel.tsx`

### Communication And Discovery

- `messages-panel.tsx`
- `profile-panel.tsx`
- `user-search.tsx`
- `news-panel.tsx`
- `social-panel.tsx`
- `search-panel.tsx`

## Theme And Visual Consistency

All major components consume colors from `useTheme()` (`src/context/theme.tsx`) and should avoid hard-coded RGB values unless there is a strong reason.

When extending UI:

1. Reuse theme tokens for text/background/border/status colors.
2. Follow existing overlay z-index conventions.
3. Keep keyboard behavior centralized in `src/app.tsx`.
