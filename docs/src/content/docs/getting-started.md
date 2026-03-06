---
title: Getting Started
description: Local setup, run commands, and first navigation flow.
---

## Prerequisites

- Bun `>= 1.0.0`
- A terminal with UTF-8 support
- Network access to Polymarket APIs

## Install And Run

```bash
bun install
bun run dev
```

The entrypoint is `src/index.tsx`, which renders `<App />` with OpenTUI mouse support enabled.

## Core Developer Commands

```bash
bun run dev
bun run type-check
bun run build

bun run docs:dev
bun run docs:build
bun run docs:preview
```

## First Navigation Pass

After launch:

1. Use `up` and `down` to move the market cursor.
2. Press `o` or `s` to open the order form for the highlighted market outcome.
3. Press `h` to open order history.
4. Press `p` to switch the right panel to portfolio mode.
5. Press `q` to save state and quit.

## Important Runtime Notes

- Shared state is centralized in `src/state.ts`; panel-local keyboard behavior is still orchestrated in `src/app.tsx`.
- Auto refresh runs every 30 seconds via `useRefreshInterval(30000)` in `src/hooks/useMarketData.ts`.
- There are no test suites in this repository today; `bun run type-check` and `bun run build` are the primary validation commands.
