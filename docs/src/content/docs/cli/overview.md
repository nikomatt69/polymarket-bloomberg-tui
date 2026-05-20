---
title: CLI Reference
description: Command-line flags, environment variables, and operational notes for the polytui-dashboard binary.
---

The `polytui-dashboard` binary (or `bun run dev` from source) accepts a small set of flags at startup.

## Flags

| Flag | Effect |
| --- | --- |
| `--version`, `-v` | Print version string and exit |
| `--help`, `-h` | Print usage summary and exit |

The TUI itself does not use positional arguments. All configuration is either interactive (keyboard-driven) or persisted in `~/.polymarket-tui/`.

## Entry Points

```bash
# Standard TUI
polytui-dashboard

# MCP server (stdio transport)
bun run mcp

# MCP server (HTTP transport on port 3000)
bun run mcp:http

# Telegram bot
bun run telegram

# Type-check without running
bun run type-check
```

## Environment Variables

All environment variables are optional. The app falls back gracefully when they are absent.

| Variable | Purpose | Default |
| --- | --- | --- |
| `POLYTUI_DASHBOARD_VERSION` | Build-time version string injected by `script/build.ts` | `pkg.version` |
| `AI_PROVIDER` | Default AI provider (`anthropic`, `openai`, etc.) | Configured in settings |
| `ANTHROPIC_API_KEY` | Anthropic API key for assistant | Settings / env |
| `OPENAI_API_KEY` | OpenAI API key for assistant | Settings / env |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for `bun run telegram` | `~/.polymarket-tui/telegram.json` |

## Persistence Directory

All user data is stored under `~/.polymarket-tui/` by default. The location is not currently overridable via environment variable.

See [Persistence Reference](/reference/persistence/) for the full file map.

## Running Behind A Proxy

The app makes outbound HTTPS requests to:

- `https://gamma-api.polymarket.com` — market data
- `https://clob.polymarket.com` — prices, orderbook, trading
- `https://data-api.polymarket.com` — positions and account data

Configure your proxy via standard `HTTPS_PROXY` / `ALL_PROXY` environment variables if required by your network.

## Signal Handling

`SIGINT` (`Ctrl+C`) and `SIGTERM` both trigger state persistence before exiting. Pressing `q` inside the TUI performs the same save-and-quit sequence.

## TypeScript Checking

```bash
bun run type-check
# runs: tsc --noEmit
```

No build step is required for local development — Bun runs TypeScript natively.

## MCP Server Mode

When run as an MCP server, the process communicates over stdio (default) or HTTP:

```bash
# stdio
bun run mcp

# HTTP on custom port
bun run mcp:http
# or
bun run src/mcp/server.ts --port 8080
```

See [MCP Server](/mcp/overview/) for the full tool reference.
