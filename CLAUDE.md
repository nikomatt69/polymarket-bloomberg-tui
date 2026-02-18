# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Run the TUI (same as start)
bun run type-check   # TypeScript check without emit (tsc --noEmit)
bun run build        # Bundle to dist/ targeting Bun runtime
```

There are no tests. Always use `bun` as the package manager.

## Architecture

This is a Bloomberg-style terminal UI for monitoring Polymarket prediction markets. It runs entirely in the terminal using SolidJS + `@opentui/solid` (opentui renders to the terminal, not the browser DOM).

**Entry point:** `src/index.tsx` calls `render(() => <App />, { useMouse: true })` from `@opentui/solid`.

### State Layer (`src/state.ts`)
Single source of truth. All shared UI signals and stores live here — never inside components. Pattern:
- `createStore<T>()` for structured state (`appState`, `walletState`, `ordersState`)
- `createSignal()` for modal open/close, form input, highlighted index
- Modal signals follow naming: `[name]Open`, `[name]Mode`, `[name]Input`

### Keyboard Handling (`src/app.tsx`)
**All** keyboard input is handled in a single `useKeyboard()` call in `App`. Modal intercepts come first with early `return` to block global keys. Order matters:
1. `orderFormOpen()` → capture all keys for the order form
2. `orderHistoryOpen()` → capture Escape
3. `alertsState.panelOpen` → capture all keys for alerts
4. `walletModalOpen()` → capture keys for wallet modal
5. Global switch on `e.name` for navigation/actions

### Layout (`src/components/layout.tsx`)
Top-level TUI layout with 52%/48% left-right split (market list / detail panel). Modal overlays are rendered at the bottom of `<Layout>` inside `<Show when={signal()}>` — they use `position="absolute"` + `zIndex` for overlay effect.

### API Layer
- `src/api/polymarket.ts` — Gamma API (`gamma-api.polymarket.com`) for markets + CLOB API (`clob.polymarket.com`) for price history. Falls back to synthetic/mock data on API errors.
- `src/api/orders.ts` — CLOB order placement with EIP-712 signed orders (CTF Exchange on Polygon, chainId 137). Uses L1 ECDSA auth headers for all mutating requests.
- `src/api/positions.ts`, `src/api/account.ts`, `src/api/sentiment.ts` — additional data fetchers

### Auth (`src/auth/wallet.ts`)
viem-based wallet. Private key stored in `~/.polymarket-tui/wallet.json` (mode 0o600). Never sent to any server. CLOB L1 auth = ECDSA signature over `timestamp + nonce`. CLOB order signing = EIP-712 typed data against the CTF Exchange contract.

### Hooks
- `src/hooks/useMarketData.ts` — `useMarketsFetch()` on mount, `useRefreshInterval(30000)` for auto-refresh, `manualRefresh()` for `r` key
- `src/hooks/useWallet.ts` — `initializeWallet()` on startup (loads persisted key), `connectWallet(pk)`, `disconnectWalletHook()`
- `src/hooks/useAlerts.ts` — price alert store + `evaluateAlerts()` called after every market refresh; writes `\x07` bell on trigger
- `src/hooks/useWatchlist.ts` — persisted set of pinned market IDs; filter mode hides non-watchlisted markets from list
- `src/hooks/useOrders.ts` — order placement/cancellation state wrapping `src/api/orders.ts`

### Persistence
All user data stored in `~/.polymarket-tui/`:
- `config.json` — app state (sort, timeframe, selected market)
- `wallet.json` — address + private key (mode 0o600)
- `alerts.json` — price alerts
- `watchlist.json` — watchlisted market IDs

### opentui / @opentui/core Constraints
- **`bold` is NOT a JSX prop on `<text>`** — only works via `vstyles.bold()` from `@opentui/core`
- Layout uses `<box>` with flexbox props (`flexDirection`, `flexGrow`, `width`, `height`)
- Overlays require `position="absolute"` + `zIndex` on `<box>`
- Colors must be `RGBA` instances (use `RGBA.fromHex(...)` or theme values from `useTheme()`)

### Theme (`src/context/theme.tsx`)
`ThemeProvider` wraps the whole app. Dark/light themes defined as `ThemeColors` objects. Components access via `const { theme } = useTheme()` and use `theme.background`, `theme.text`, etc. for all colors.

## Key Bindings (for reference when adding features)
- `↑/↓` — navigate markets
- `r` — refresh
- `w` — wallet modal
- `p` — portfolio panel
- `o/s` — buy/sell order form
- `h` — order history
- `z` — price alerts panel
- `x` — toggle watchlist for selected market
- `f` — toggle watchlist filter
- `Ctrl+K` — cycle sort (volume → change → name)
- `1/5/7/a` — timeframe
- `q` — quit
