---
title: Settings, Wallet, Auth
description: Configure themes/providers, wallet lifecycle, and local authentication flows.
---

<div class="guide-intro">
  <strong>Objective:</strong> keep your environment stable, secure, and predictable.
  Configure providers and credentials once, then validate connectivity before trading.
</div>

<div class="guide-kpi-grid">
  <div class="guide-kpi-item">
    <span>Settings Panel</span>
    <strong>e</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Wallet Modal</span>
    <strong>w</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Auth Modal</span>
    <strong>g</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Theme Reload</span>
    <strong>r (Theme Tab)</strong>
  </div>
</div>

## Configuration Deck

| Key | Scope | Effect |
| --- | --- | --- |
| `e` | global | toggles settings panel |
| `w` | global | opens wallet modal |
| `g` | global | opens auth modal |
| `tab` | settings/auth | switches tabs or form mode |
| `r` | account/wallet/theme context | refreshes balances or reloads themes |
| `esc` | all overlays | exits current mode or closes panel |

## Settings Panel

Open with `e`.

Global settings navigation:

- `tab` or `right`: next tab
- `left`: previous tab
- `esc` or `e`: close panel

Tabs include `theme`, `providers`, `account`, `display`, and `keys`.

## Theme Controls

In the `theme` tab:

- `enter` or `t`: toggle dark/light mode
- `n` / `down`: next theme
- `p` / `up`: previous theme
- `r`: reload themes from disk
- `/`: enter theme search edit mode
- `x`: clear theme search query

## Account Controls

In the `account` tab:

- `d`: disconnect wallet
- `r`: refresh wallet balances
- `w`: open wallet modal
- `f`: edit funder address
- `l`: logout local user session (if authenticated)

## Wallet Modal

Open with `w`.

- `c`: enter connect mode
- `enter` in connect mode: connect using provided private key
- `d`: disconnect wallet in view mode
- `r`: refresh balance in view mode
- `esc`: close modal or exit connect mode

## Auth Modal

Open with `g`.

- `tab`: switch between login/register mode
- `enter`: submit current auth form
- `esc`: close and clear inputs/errors

Auth data is local-only and persisted under `~/.polymarket-tui/auth.json` with encrypted active session support.

## Provider Configuration

Provider settings are managed in settings and persisted in app config.

The active AI provider determines assistant model routing in `src/api/assistant.ts`.

When provider API keys are missing or invalid, assistant calls will return explicit configuration errors.

## Secure Setup Checklist

1. Connect wallet and confirm balances before placing any order.
2. Verify active AI provider and model in settings.
3. Confirm theme/search shortcuts still work after profile changes.
4. Log out auth session when the environment is shared.

<div class="guide-nav">
  <p>
    Return to: <a href="/user-guide/">User Guide Overview</a>
  </p>
</div>
