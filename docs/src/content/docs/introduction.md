---
title: Introduction
description: What polytui-dashboard is, who it is for, and how it compares to browser-based prediction market interfaces.
---

polytui-dashboard is a Bloomberg-style terminal application for real-time monitoring and trading of [Polymarket](https://polymarket.com) prediction markets.

It runs entirely in your terminal using **SolidJS** reactive primitives rendered to the terminal via **OpenTUI** — no browser, no Electron, no web server. It is built on the **Bun** runtime and targets the Polymarket Gamma and CLOB APIs.

## What It Does

- **Market Discovery** — browse 50+ live markets with category filters, sub-category tabs, full-text search, and watchlist pinning.
- **Real-Time Data** — auto-refreshes every 30 seconds; manual refresh on demand with `r`.
- **Order Execution** — place buy/sell limit orders directly via Polymarket CLOB with EIP-712 signed payloads. Cancel individual or all open orders from the history panel.
- **Portfolio Monitoring** — view open positions, unrealized P&L, and account statistics.
- **Price Alerts** — set threshold-based alerts with debounce and cooldown logic; terminal bell on trigger.
- **AI Assistant** — multi-provider streaming chat with tool use: query markets, execute orders, inspect wallet state, and more.
- **Automation** — rule-based automation engine and skills system for repeatable workflows.
- **MCP Server** — expose the full trading surface as a Model Context Protocol server for external AI agent consumption.
- **Telegram Bot** — control and monitor from any Telegram client.
- **XMTP Messaging** — decentralized messaging via the XMTP protocol.

## Who It Is For

| Role | Primary Use |
| --- | --- |
| Traders | Fast order entry, position monitoring, alert-driven exits |
| Researchers | High-density market browsing, price history, sentiment data |
| Developers | Extend the TUI, build on the MCP server, add automation skills |
| Power users | Keyboard-first workflows without browser overhead |

## Architecture In One Paragraph

**`src/index.tsx`** bootstraps the OpenTUI renderer and mounts `<App />`. **`src/app.tsx`** initializes all hooks, establishes WebSocket channels, and runs the single global keyboard dispatcher. **`src/state.ts`** owns every shared signal and store. **`src/components/layout.tsx`** composes the two-panel workspace and all modal overlays. API calls flow through `src/api/`, auth and signing live in `src/auth/wallet.ts`, and user data persists to `~/.polymarket-tui/`.

See [Architecture Overview](/architecture/overview/) for the full module map.

## Prerequisites

- **Bun** ≥ 1.3.10: `curl -fsSL https://bun.sh/install | bash`
- A terminal with UTF-8 support and 256-color output
- Network access to `gamma-api.polymarket.com` and `clob.polymarket.com`
- (Optional) Polygon wallet private key for order execution

## Next Steps

- [Getting Started](/getting-started/) — run the app in two commands
- [Installation](/installation/) — full install options including binary and global alias
- [User Guide](/user-guide/) — daily operating workflows
