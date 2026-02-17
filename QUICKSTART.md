# Quick Start Guide

## 60 Second Setup

```bash
# 1. Install dependencies
bun install

# 2. Run the app
bun run src/index.ts

# 3. Start navigating!
# Use arrow keys (↑↓) to browse markets
# Press Q to quit
```

## What You'll See

A terminal dashboard with:
- **Top**: Search bar for filtering markets
- **Left**: List of Polymarket prediction markets (sorted by volume)
- **Right**: Details of selected market with price chart and outcomes
- **Bottom**: Status bar with keyboard hints

## Basic Controls

| Key | Action |
|-----|--------|
| ↑ ↓ | Navigate markets |
| R | Refresh data |
| Q | Quit |

## Try These First

1. **Browse Markets**: Press ↓ to scroll through markets
2. **View Details**: Select a market, right panel shows details
3. **Search**: Type to search for "Bitcoin", "Trump", etc.
4. **Change Chart**: Press 1/5/7/A to change timeframe
5. **Sort**: Press Ctrl+K to cycle sort method

## Common Issues

### "Bun not found"
Install Bun first: https://bun.sh

### "No markets appear"
- Check internet connection
- Press R to manually refresh
- Polymarket API might be down, try again

### "Terminal looks broken"
- Make terminal wider (80+ columns)
- Make sure it's UTF-8 compatible
- Try `export LANG=en_US.UTF-8`

### "Can't quit with Q"
Use Ctrl+C instead

## All Keyboard Shortcuts

```
Navigation & Selection:
  ↑ ↓          Move up/down market list
  R            Refresh market data now
  Q / Ctrl+C   Quit application

Chart Timeframes:
  1            Show 1-day chart
  5            Show 5-day chart
  7            Show 7-day chart (default)
  A            Show all-time chart

Sorting & Filtering:
  Ctrl+K       Cycle sort: Volume → 24h% → A-Z
  (type)       Search markets (in search bar)
```

## What Each Panel Shows

### Left Panel (Markets List)
- Number (1-20)
- Market title (truncated)
- Number of outcomes (e.g., "2o" for 2 outcomes)
- 24h volume (e.g., "$1.2M")
- 24h price change (e.g., "+2.1%" in green, "-1.5%" in red)

### Right Panel (Market Details)
- **Top**: Market title, volume, liquidity, resolution date
- **Middle**: ASCII price chart showing history
- **Bottom**: Outcome table with prices and trading data

### Bottom Bar
- Current status ("Ready" or "⟳ Refreshing...")
- Sort method ("Vol", "24h%", or "A-Z")
- Current position (e.g., "2/50" markets)
- Last refresh time
- Help text for keyboard commands

## Data Refresh

- **Automatic**: Every 30 seconds
- **Manual**: Press R key
- **Last refresh**: Shown in status bar

## Persistent Settings

Your preferences are automatically saved:
- Selected market
- Search query
- Sort method
- Chart timeframe

Reset to defaults: `rm ~/.polymarket-tui/config.json`

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [DEVELOPMENT.md](DEVELOPMENT.md) for technical details
- Explore the code in `src/` directory

## Need Help?

- **Application crashes**: Check terminal size (need 80x24 minimum)
- **No data loading**: Check internet connection and API status
- **Colors wrong**: Update your terminal, check UTF-8 support
- **Keyboard not responding**: Try Ctrl+C to quit and restart

## Features Explained

### Smart API Fallback
- Tries fast CLOB API first
- Falls back to GraphQL subgraph if needed
- Shows synthetic demo data if all APIs fail

### Real-Time Updates
- Auto-refresh every 30 seconds
- Press R for immediate update
- Efficient incremental updates (only changed data)

### Keyboard-Driven
- No mouse needed
- Fast navigation with arrow keys
- Intuitive shortcuts (R for Refresh, Q for Quit)

### Persistent
- Saves your last viewed market
- Remembers sort & filter settings
- Works across sessions

## Tips & Tricks

### Find a Specific Market
1. Press spacebar to focus search
2. Type keyword (e.g., "Bitcoin", "2024")
3. Results filter in real-time
4. Use ↓ to navigate filtered results

### Compare Market Prices
1. Navigate to first market
2. Note the prices in the right panel
3. Navigate to another market
4. Quick mental comparison of odds

### Monitor Quick Changes
1. Pin your favorite market
2. Let app refresh automatically
3. Watch the "24h%" column change
4. Catch market movements in real-time

### Track Resolution Dates
- Right panel shows "Resolves:" date
- Markets close as they resolve
- Sort by date to find upcoming resolutions

## What's Next?

The app is fully functional for market research. Future versions might add:
- Trading (place bets)
- Wallet integration (see your positions)
- Alerts (notify on price changes)
- Multi-market comparison
- Custom watchlists

## Troubleshooting Checklist

- [ ] Terminal is at least 80x24
- [ ] UTF-8 encoding enabled
- [ ] Internet connection active
- [ ] Bun 1.0+ installed
- [ ] Dependencies installed (`bun install`)
- [ ] No other process using port for API
- [ ] Enough disk space (~100MB)

## Support

For detailed technical information, see:
- `README.md` - Full feature documentation
- `DEVELOPMENT.md` - Architecture and extending
- `src/` - Source code with inline comments

Enjoy monitoring Polymarket! 🚀
