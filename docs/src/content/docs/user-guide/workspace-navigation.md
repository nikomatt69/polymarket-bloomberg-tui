---
title: Workspace Navigation
description: How to move through the interface, switch panels, and avoid key collisions.
---

<div class="guide-intro">
  <strong>Objective:</strong> keep selection flow fast while preventing modal collisions.
  Treat overlay state as the first thing to check whenever controls feel unresponsive.
</div>

<div class="guide-kpi-grid">
  <div class="guide-kpi-item">
    <span>Primary Movement</span>
    <strong>Up / Down</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Mode Switch</span>
    <strong>Left / Right</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Overlay Escape</span>
    <strong>Esc</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Safe Exit</span>
    <strong>q</strong>
  </div>
</div>

## Quick Command Deck

| Key | Use Case | Result |
| --- | --- | --- |
| `up` / `down` | move market cursor | changes active highlighted market |
| `left` / `right` | toggle right pane | switches details/portfolio context |
| `/` | search jump | opens dedicated search panel |
| `[` / `]` | category sweep | changes top-level market category |
| `;` / `'` | sub-category sweep | rotates category-specific subfilters |

## Layout Orientation

The default workspace has three main zones:

- left: market list with categories, sub-categories, and scrolling rows
- right: market details (or portfolio when toggled)
- bottom: status and shortcut guidance

Top rows contain the global header, search bar, and quick actions strip.

## Core Navigation Keys

- `up` / `down`: move highlighted market
- `left` / `right`: toggle right pane between market details and portfolio
- `/`: open search panel
- `[` / `]`: cycle top-level market category
- `;` / `'`: cycle active sub-category when category supports sub-categories

## Overlay Behavior

When any modal/panel is open, that panel captures keys first.

Examples:

- if order form is open, `tab`, `t`, `p`, and `enter` are interpreted by the form
- if settings is open, `tab`, arrows, and theme/search keys stay inside settings
- if enterprise chat is open, chat/tool navigation keys are isolated from global keys

Use `esc` as the primary close/exit key for most overlays.

## High-Frequency Panel Toggles

- `h`: order history
- `d`: order book panel
- `z`: alerts panel
- `i`: indicators panel
- `a` or `A`: analytics panel
- `v`: skills panel
- `b`: automation panel
- `n`: news panel
- `t`: social panel
- `k`: shortcuts panel

## Search And Selection Flow

For fast market targeting:

1. press `/` to open search panel
2. move selection with `up` / `down`
3. switch categories with `tab`
4. press `enter` to jump to market

## Exit And Safety

- `q` saves persisted state and exits
- `SIGINT` and `SIGTERM` handlers also persist state before exit

If key behavior feels wrong, first check whether an overlay is still open and close it with `esc`.

<div class="guide-nav">
  <p>
    Next: <a href="/user-guide/trading-and-orders/">Trading And Orders</a>
  </p>
</div>
