---
title: Persistence
description: Local storage files under ~/.polymarket-tui and what each file contains.
---

## Base Directory

All persisted user data is stored under:

```text
~/.polymarket-tui/
```

## Core App Files

| File | Owner Module | Purpose |
| --- | --- | --- |
| `config.json` | `src/state.ts` | selected market, search query, sort, timeframe, active view, theme prefs, provider metadata |
| `wallet.json` | `src/auth/wallet.ts` | connected wallet address/private key, funder address, API credentials |
| `alerts.json` | `src/hooks/useAlerts.ts` | alert definitions, trigger metadata |
| `watchlist.json` | `src/hooks/useWatchlist.ts` | persisted set of market IDs |
| `filters.json` | `src/state.ts` | saved filter presets |
| `rules.json` | `src/automation/rules.ts` | automation rule definitions |
| `skills.json` | `src/api/skills.ts` | enabled and custom assistant skills |

## Messaging And Assistant Files

| File | Owner Module | Purpose |
| --- | --- | --- |
| `globalChat.json` | `src/api/messages.ts` | persisted global chat log |
| `directMessages.json` | `src/api/messages.ts` | persisted direct-message log |
| `sessions/*.json` | `src/api/sessions.ts` | assistant conversation sessions and metadata |

## Auth Files

| File | Owner Module | Purpose |
| --- | --- | --- |
| `auth.json` | `src/auth/auth.ts` | local users and encrypted active session |
| `.auth.key` | `src/auth/auth.ts` | AES key used to encrypt/decrypt auth session payload |

## Optional/Feature Files

| File | Owner Module | Purpose |
| --- | --- | --- |
| `telegram.json` | `src/telegram/bot.ts` | telegram bot config when enabled |
| `exports/orders_*.csv` | `src/hooks/useOrders.ts` | CSV exports generated from order history panel |

## File Permission Notes

Several sensitive writes explicitly use mode `0o600` in code paths (for example `wallet.json`, `config.json`, auth/session files, skills, and message files).

Other files (for example `alerts.json`, `watchlist.json`, `rules.json`, and CSV exports) are written without an explicit mode and follow system default umask behavior.

## Operational Guidance

- Keep `wallet.json`, `auth.json`, and `.auth.key` private.
- Do not commit any `~/.polymarket-tui` contents to source control.
- If state becomes inconsistent, remove specific files rather than deleting the whole directory blindly.
