---
title: Keybindings
description: Global and modal keyboard mappings implemented in src/app.tsx.
---

## Global Keys (No Overlay Open)

| Key | Action |
| --- | --- |
| `up` / `down` | Move highlighted market |
| `left` / `right` | Toggle right pane between market and portfolio views |
| `/` | Open search panel |
| `Enter` | Open enterprise chat overlay |
| `r` | Manual market refresh |
| `w` | Open wallet modal |
| `g` | Open auth modal |
| `p` | Toggle portfolio panel |
| `o` | Open buy order form |
| `s` | Open sell order form |
| `h` | Open order history |
| `z` | Open alerts panel |
| `l` | Toggle filter panel |
| `f` | Toggle watchlist-only filtering |
| `x` | Toggle watchlist for selected market |
| `Ctrl+X` | Toggle user profile panel |
| `d` | Toggle order book panel |
| `Shift+M` | Toggle messages panel |
| `i` | Toggle indicators panel |
| `n` | Toggle news panel |
| `t` | Toggle social panel |
| `b` | Toggle automation panel |
| `v` | Toggle skills panel |
| `m` | Toggle sentiment panel |
| `c` | Open comparison panel in select mode |
| `Shift+U` | Show selected market URL as toast |
| `Shift+L` | Toggle watchlist panel |
| `u` | Toggle account stats panel |
| `y` | Toggle banking panel |
| `Ctrl+Y` | Toggle user search panel |
| `a` / `A` | Toggle analytics panel |
| `k` | Toggle shortcuts panel |
| `Ctrl+K` | Cycle market sort (`volume -> change -> liquidity -> volatility -> name`) |
| `1` | Set timeframe to `1h` |
| `2` | Set timeframe to `4h` |
| `3` | Set timeframe to `1d` |
| `4` | Set timeframe to `5d` |
| `5` | Set timeframe to `1w` |
| `6` | Set timeframe to `1M` |
| `7` | Set timeframe to `all` |
| `e` | Toggle settings panel |
| `[` / `]` | Cycle market list category |
| `;` / `'` | Cycle active sub-category within current category |
| `q` | Save state and quit |

## Modal Intercept Notes

`src/app.tsx` handles keyboard dispatch with early returns for each open modal. If a modal is open, global keys do not run.

## Frequently Used Modal Keys

### Order Form

| Key | Action |
| --- | --- |
| `Tab` | Toggle active input field (`price`/`shares`) |
| `i` | Cycle selected market outcome |
| `t` | Cycle order type (`GTC`, `FOK`, `GTD`, `FAK`) |
| `p` | Toggle post-only |
| `Enter` | Validate and submit order |
| `Esc` | Close form and clear temporary fields |

### Order History

| Key | Action |
| --- | --- |
| `Tab` | Switch section (`open` / `trades`) |
| `up` / `down` | Move selected row |
| `left` / `right` | Trade-history page nav |
| `c` | Cancel selected open order |
| `a` | Cancel all open orders |
| `y` | Cancel selected-market open orders |
| `v` / `b` / `g` / `n` | Cycle status/side/window/scoring filters |
| `m` | Toggle selected-market-only filter |
| `/` | Start search input mode |
| `x` | Clear history search query |
| `e` | Export filtered history to CSV |
| `d` | Replay selected order into order form |
| `Esc` | Close history panel |

### Settings

| Key | Action |
| --- | --- |
| `Tab` / `right` | Next settings tab |
| `left` | Previous settings tab |
| `Esc` / `e` | Close settings panel |
| `t` / `Enter` (theme tab) | Toggle dark/light mode |
| `n` / `p` (theme tab) | Next/previous theme |
| `/` (theme tab) | Enter theme-search editing |
| `x` (theme tab) | Clear theme-search query |

### Enterprise Chat

| Context | Key | Action |
| --- | --- | --- |
| Input focused | `Enter` | Submit prompt |
| Input focused | `Ctrl+U` | Clear input |
| Input focused | `Ctrl+L` | Clear chat |
| Input focused | `up` / `down` | Prompt history navigation when input empty |
| Tool list mode | `up` / `down` or `k` / `j` | Move selected live tool |
| Tool list mode | `Space` | Expand/collapse selected tool details |
| Any | `Esc` | Close chat or blur input |

For additional panel-specific keys, check the relevant intercept branch in `src/app.tsx`.
