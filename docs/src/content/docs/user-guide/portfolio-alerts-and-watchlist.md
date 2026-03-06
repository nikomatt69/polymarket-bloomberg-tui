---
title: Portfolio, Alerts, Watchlist
description: Position monitoring, alert automation, and market focus controls.
---

<div class="guide-intro">
  <strong>Objective:</strong> stay synchronized with exposure. Use watchlist filtering to
  reduce noise and alerts to detect threshold breaks before manual checks.
</div>

<div class="guide-kpi-grid">
  <div class="guide-kpi-item">
    <span>Portfolio Toggle</span>
    <strong>p</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Watchlist Tag</span>
    <strong>x</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Watchlist Filter</span>
    <strong>f</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Alerts Panel</span>
    <strong>z</strong>
  </div>
</div>

## Control Deck

| Key | Area | Outcome |
| --- | --- | --- |
| `p` | workspace | toggles right pane portfolio mode |
| `u` | account | opens account stats panel |
| `x` | market row | add/remove market from watchlist |
| `f` | list filtering | toggles watchlist-only market list |
| `Shift+L` | watchlist tools | opens watchlist panel |
| `z` | alerts | opens alerts panel and alert management controls |

## Portfolio Views

- `p`: toggle portfolio pane on the right side
- `u`: open account stats panel

Portfolio data is refreshed from hooks tied to wallet connectivity and panel usage.

## Watchlist Workflow

- `x`: toggle selected market in watchlist
- `f`: toggle watchlist-only list filtering
- `Shift+L`: open watchlist panel

When watchlist filter is active, market list and downstream navigation operate only on watched IDs.

## Alerts Panel

Open with `z`.

### Panel-Level Keys

- `a`: enter add-alert mode
- `d`: delete selected active alert
- `x`: dismiss selected alert
- `h`: toggle alert history view
- `s`: toggle sound
- `up` / `down`: move selection
- `esc`: close panel

### Add-Alert Mode Keys

- `tab`: cycle fields (`condition`, `threshold`, `cooldown`, `debounce`)
- `c`: cycle condition (`above`, `below`, `crossesAbove`, `crossesBelow`)
- `m`: cycle metric (`price`, `change24h`, `volume24h`, `liquidity`)
- `+` / `-` and arrows: adjust cooldown/debounce quickly
- `enter`: submit alert with validation
- `esc`: cancel add flow

### Alert Validation Rules

- `price` thresholds must remain between `0` and `1`
- `volume24h` and `liquidity` thresholds must be greater than `0`
- cooldown must be in `[0, 1440]` minutes
- debounce passes must be in `[1, 10]`

## Trigger Model Notes

Alert evaluation runs after market refresh cycles and uses:

- metric resolution per market/outcome
- condition evaluation including cross detection
- debounce hit counts
- cooldown windows to avoid repeated noise

Triggered alerts are recorded in history and can emit terminal bell sound if enabled.

<div class="guide-nav">
  <p>
    Next: <a href="/user-guide/chat-automation-and-messages/">Chat, Automation, Messages</a>
  </p>
</div>
