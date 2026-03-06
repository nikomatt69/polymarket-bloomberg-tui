---
title: Types And Utils
description: Domain model definitions and shared helper modules.
---

## Domain Types (`src/types/`)

### `market.ts`

Defines core business models used across app state and API wrappers:

- `Market`, `Outcome`
- `PricePoint`, `PriceHistory`
- `AppState`, `PersistentState`, `WalletState`
- `Timeframe` union (`1h`, `4h`, `1d`, `5d`, `1w`, `1M`, `all`)

### Other Type Modules

- `orders.ts`: order request/response and order status models
- `positions.ts`: portfolio and position data structures
- `alerts.ts`: alert conditions/metrics and persisted alert model
- `user.ts`: user profile, contacts, and profile state
- `api.ts`: API-specific response typing glue

## Utility Modules (`src/utils/`)

### `format.ts`

Formatting helpers used throughout UI:

- price/percent formatting
- volume and compact notation
- truncation and string alignment helpers

### `chart-utils.ts` and `charts.ts`

Chart rendering and market visual helpers for terminal-friendly displays.

### `indicators.ts`

Indicator calculations consumed by indicator and analytics panels.

### `analytics.ts`

Portfolio and risk helpers, including concentration/risk-level calculations used in status components.

### `export.ts`

Export-oriented helper logic used by history/report workflows.

### `colors.ts`

Color utility logic for terminal output where needed outside the theme context.

## Usage Guidelines

- Keep domain shapes in `src/types/` and avoid redefining them in feature modules.
- Keep pure calculations in `src/utils/` so components and hooks remain focused on orchestration.
- Prefer existing format helpers over one-off local formatting logic for consistent UI output.
