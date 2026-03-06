---
title: Trading And Orders
description: Practical buy/sell execution flow, validation rules, and order-history operations.
---

<div class="guide-intro">
  <strong>Objective:</strong> execute quickly without accidental orders. Validate context,
  then submit, then verify fills from history before taking the next action.
</div>

<div class="guide-kpi-grid">
  <div class="guide-kpi-item">
    <span>Buy Trigger</span>
    <strong>o</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Sell Trigger</span>
    <strong>s</strong>
  </div>
  <div class="guide-kpi-item">
    <span>History Panel</span>
    <strong>h</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Validation Gate</span>
    <strong>Enter</strong>
  </div>
</div>

## Order Form Deck

| Key | Context | Effect |
| --- | --- | --- |
| `tab` | order form open | switches `price` / `shares` focus |
| `i` | multi-outcome market | cycles selected outcome |
| `t` | order form open | cycles `GTC` / `FOK` / `GTD` / `FAK` |
| `p` | order form open | toggles post-only |
| `enter` | valid fields | submits order |
| `esc` | order form open | closes and clears transient input |

## Open A Trade Quickly

- press `o` to open a buy order for the highlighted market outcome
- press `s` to open a sell order for the highlighted market outcome

The order form pre-fills market title, outcome title, and current reference price.

## Order Form Controls

While the order form is open:

- `tab`: switch input focus between `price` and `shares`
- `i`: cycle outcome (for multi-outcome markets)
- `t`: cycle order type (`GTC`, `FOK`, `GTD`, `FAK`)
- `p`: toggle post-only
- `enter`: validate and submit
- `esc`: close and clear transient fields

## Validation Rules

Submission checks enforce:

- price must be numeric and between `0.01` and `0.99`
- shares must be numeric and greater than `0`
- shares support at most two decimal places
- post-only cannot be combined with `FOK`

If validation fails, the form stays open and the order is not submitted.

## Order History Panel

Open with `h`. The panel has two sections: open orders and trades.

### Core Keys

- `tab`: switch section (`open` / `trades`)
- `up` / `down`: move selection
- `r`: refresh order data
- `esc`: close panel

### Risk And Management Actions

- `c`: cancel selected open order
- `a`: cancel all open orders
- `y`: cancel open orders for selected market token set

### Filtering And Search

- `v`: cycle status filter
- `b`: cycle side filter
- `g`: cycle time-window filter
- `n`: cycle scoring filter
- `m`: toggle selected-market-only scope
- `/`: start search editing mode
- `x`: clear search query

### Utilities

- `e`: export current filtered view to CSV (`~/.polymarket-tui/exports/`)
- `d`: replay selected order into order form for quick re-entry
- `left` / `right`: paginate within trade section

## Suggested Execution Habit

1. verify selected market and outcome in right pane
2. open form (`o` or `s`)
3. confirm type/post-only logic
4. submit with `enter`
5. inspect status and fills in order history (`h`)

<div class="guide-nav">
  <p>
    Next: <a href="/user-guide/portfolio-alerts-and-watchlist/">Portfolio, Alerts, Watchlist</a>
  </p>
</div>
