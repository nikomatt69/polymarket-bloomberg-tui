---
title: Changelog
description: Release history for polytui-dashboard.
---

All notable changes are documented here. The project follows [Semantic Versioning](https://semver.org/).

## 1.0.1 — 2026-05-20

### Changed
- Renamed project from `polymarket-bloomberg-tui` to `polytui-dashboard` across all files.
- Updated npm package name, binary name, XMTP app version string, and build-time constant.
- Updated `install` script variables to `POLYTUI_DASHBOARD_*`.
- Updated docs to reflect new name throughout.

### Added
- This changelog.
- Comprehensive docs site with Cloudflare Pages deployment, MCP reference, Telegram bot guide, CLI reference, and installation guide.
- SolidJS interactive terminal preview component on the docs home page.
- `_headers` and `_redirects` for Cloudflare Pages caching and redirect configuration.
- `wrangler.toml` for Cloudflare Pages deployment via Wrangler CLI.

## 1.0.0 — 2026-05-01

Initial public release.

### Features
- Bloomberg-style split-panel TUI: market list (52%) + detail panel (48%).
- Real-time market data from Polymarket Gamma API with CLOB enrichment.
- 30-second auto-refresh with manual refresh (`r`).
- Full-text search, category and sub-category navigation.
- Watchlist with persistent pinning and filter mode.
- Buy/sell order entry with EIP-712 signing on Polygon mainnet.
- Order history with filters, search, CSV export, and replay.
- Portfolio panel with open positions and account stats.
- Price alerts with debounce, cooldown, and terminal bell.
- Multi-provider AI assistant (Anthropic, OpenAI) with tool use.
- Automation rules engine and skills system.
- Enterprise chat overlay with session persistence.
- XMTP decentralized messaging integration.
- MCP server (stdio + HTTP) for AI agent integration.
- Telegram bot for remote monitoring and control.
- Local auth system with encrypted session persistence.
- Theme system (dark/light) with custom theme support.
- WebSocket-based real-time price stream.
- RTDS and sports market live score support.
- Full keyboard-driven interface with no mouse requirement.
- State persistence under `~/.polymarket-tui/`.
- Self-contained binary build targeting Bun runtime.
