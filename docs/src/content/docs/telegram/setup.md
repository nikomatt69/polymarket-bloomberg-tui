---
title: Telegram Bot Setup
description: Configure and run the polytui-dashboard Telegram bot to monitor and control the app from any Telegram client.
---

polytui-dashboard includes a Telegram bot that lets you receive alerts, query market data, check positions, and execute orders from any Telegram client.

## Prerequisites

1. A [Telegram Bot Token](https://core.telegram.org/bots#botfather) from `@BotFather`.
2. Bun installed and the project cloned locally.

## Configuration

Create or update `~/.polymarket-tui/telegram.json`:

```json
{
  "botToken": "YOUR_BOT_TOKEN_HERE",
  "allowedUserIds": [123456789],
  "notificationsEnabled": true,
  "alertNotifications": true,
  "orderNotifications": true
}
```

| Field | Type | Description |
| --- | --- | --- |
| `botToken` | string | Token from `@BotFather` |
| `allowedUserIds` | number[] | Telegram user IDs allowed to use the bot |
| `notificationsEnabled` | boolean | Master toggle for push notifications |
| `alertNotifications` | boolean | Send messages when price alerts trigger |
| `orderNotifications` | boolean | Send messages when orders fill |

To find your Telegram user ID, message `@userinfobot` on Telegram.

## Starting The Bot

```bash
bun run telegram
```

The bot process is independent of the TUI — you can run both simultaneously.

## Available Commands

| Command | Description |
| --- | --- |
| `/start` | Show welcome message and command list |
| `/markets [query]` | List top markets or search by keyword |
| `/market <id>` | Detail for a specific market |
| `/positions` | Show open positions |
| `/balance` | Show USDC wallet balance |
| `/orders` | List open orders |
| `/cancel <orderId>` | Cancel a specific order |
| `/alerts` | List active alerts |
| `/alert <marketId> <above\|below> <price>` | Create a price alert |
| `/buy <marketId> <outcome> <price> <size>` | Place a buy order |
| `/sell <marketId> <outcome> <price> <size>` | Place a sell order |
| `/status` | Show connection and refresh status |
| `/help` | Show command reference |

## Push Notifications

When `alertNotifications: true`, the bot sends a message whenever a price alert fires:

```
🔔 Alert triggered
Market: Will BTC hit $200k by EOY?
Condition: YES price crossed above 0.50
Current: 0.52
```

When `orderNotifications: true`, order fill confirmations are sent automatically:

```
✅ Order filled
BUY YES — Will BTC hit $200k?
0.45 × 100 shares = $45.00 USDC
```

## Security Notes

- `allowedUserIds` is a hard-coded allowlist — messages from any other user are silently ignored.
- The bot token gives full control over the bot; keep `telegram.json` private.
- Trading commands execute real orders on Polygon mainnet — verify amounts before confirming.

## Running As A Service

To run the bot persistently, use a process manager:

```bash
# systemd example
[Unit]
Description=polytui-dashboard Telegram bot

[Service]
ExecStart=/usr/local/bin/bun run /path/to/polytui-dashboard/src/telegram/bot.ts
Restart=on-failure
WorkingDirectory=/path/to/polytui-dashboard

[Install]
WantedBy=multi-user.target
```

Or with `pm2`:

```bash
pm2 start "bun run telegram" --name polytui-telegram
pm2 save
```
