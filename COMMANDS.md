# Command Reference Card

## Quick Command Lookup

### Installation & Running

```bash
# Install dependencies
bun install

# Run the application
bun run src/index.ts

# Type check (no runtime)
bun run type-check

# Build to dist/
bun run build
```

### Keyboard Commands

#### Navigation
| Key | Action | Result |
|-----|--------|--------|
| `↑` | Up | Move to previous market |
| `↓` | Down | Move to next market |
| `←` | Left | Scroll details panel left |
| `→` | Right | Scroll details panel right |

#### Data & View
| Key | Action | Result |
|-----|--------|--------|
| `R` | Refresh | Manually fetch latest data |
| `1` | 1-day | Show 1-day price chart |
| `5` | 5-day | Show 5-day price chart |
| `7` | 7-day | Show 7-day price chart (default) |
| `A` | All-time | Show all historical prices |

#### Sorting & Filtering
| Key | Action | Result |
|-----|--------|--------|
| `^K` | Menu | Cycle sort: Volume → Change → Name |
| Type | Search | Filter markets by keyword |
| Backspace | Delete | Remove character from search |
| Ctrl+A | Select All | Select search text |

#### Application Control
| Key | Action | Result |
|-----|--------|--------|
| `Q` | Quit | Exit application |
| `Ctrl+C` | Force Quit | Hard exit (also Quit) |
| Enter | Select | View market details (current in panel) |
| Tab | Toggle | Switch view mode |

### State Management

#### Persisted Settings
Location: `~/.polymarket-tui/config.json`

```json
{
  "selectedMarketId": "0x123...",
  "searchQuery": "bitcoin",
  "sortBy": "volume",
  "timeframe": "7d"
}
```

**To reset**: `rm ~/.polymarket-tui/config.json`

#### What Gets Saved
- Last viewed market
- Search query
- Sort preference
- Chart timeframe

#### What Doesn't Get Saved
- Market list data (refreshed each session)
- Watchlist (not implemented yet)
- Alerts (not implemented yet)

### API Commands

#### Manual API Calls (CLI)

```bash
# Get markets list
curl https://clob.polymarket.com/markets | jq

# Get specific market
curl https://clob.polymarket.com/markets/{MARKET_ID} | jq

# GraphQL query
curl -X POST https://api.thegraph.com/subgraphs/name/polymarket/polymarket \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ markets(first: 10) { id title volume } }"
  }' | jq
```

### Configuration Commands

#### Environment Variables

```bash
# Set language/encoding
export LANG=en_US.UTF-8

# Increase terminal size
export COLUMNS=120
export LINES=30

# Run with debug output
DEBUG=* bun run src/index.ts 2>&1 | tee debug.log
```

#### Terminal Configuration

```bash
# Check terminal capabilities
echo $TERM

# List terminal colors
for i in {0..255}; do echo -e "\033[38;5;${i}m Color $i"; done

# Show Unicode support
printf '\u2590\n'  # Should show: ▐

# Check UTF-8
locale charmap  # Should output: UTF-8
```

### File Operations

#### Project Files

```bash
# View main source file
cat src/index.ts

# View state management
cat src/state.ts

# View API client
cat src/api/polymarket.ts

# View all components
ls -la src/components/

# Count lines of code
wc -l src/**/*.ts src/**/*.tsx
```

#### Configuration Files

```bash
# View TypeScript config
cat tsconfig.json

# View package config
cat package.json

# View user config
cat ~/.polymarket-tui/config.json
```

### Debugging Commands

#### Logs & Output

```bash
# Run with output capture
bun run src/index.ts > app.log 2>&1 &
tail -f app.log

# Filter logs for errors
grep -i error app.log

# Monitor in real-time
bun run src/index.ts 2>&1 | grep -i "error\|warning"
```

#### Process Management

```bash
# Check if app is running
ps aux | grep "bun run"

# Kill app cleanly
pkill -f "bun run src/index.ts"

# Kill with SIGTERM
kill -15 $(pgrep -f "bun run src/index.ts")

# Force kill
pkill -9 -f "bun run src/index.ts"
```

#### Performance Monitoring

```bash
# Monitor memory usage
watch -n 1 'ps aux | grep bun'

# CPU usage
top -p $(pgrep -f "bun run")

# Network traffic
sudo tcpdump -i any dst host clob.polymarket.com

# Check API response time
time curl https://clob.polymarket.com/markets
```

### Development Commands

#### Code Quality

```bash
# Type checking
bun run type-check

# List TypeScript errors
bun run type-check 2>&1 | grep -i "error"

# Format code (if prettier installed)
bunx prettier --write src/

# Lint (if eslint installed)
bunx eslint src/
```

#### Building

```bash
# Development build
bun build src/index.ts --target=bun

# Production build
bun build src/index.ts --target=bun --outdir=dist

# Compile to standalone binary
bun build src/index.ts --compile --outfile=polymarket-tui

# Check output size
ls -lh dist/
ls -lh polymarket-tui
```

#### Testing

```bash
# Run with mock data (edit api/polymarket.ts first)
bun run src/index.ts

# Test with specific market
grep -r "marketId" src/api/polymarket.ts

# Simulate no network
sudo iptables -A OUTPUT -d clob.polymarket.com -j DROP
bun run src/index.ts  # Should fallback to GraphQL
sudo iptables -D OUTPUT -d clob.polymarket.com -j DROP
```

### Advanced Usage

#### Stream Session

```bash
# Record terminal session
script -t 0 -q session.out bun run src/index.ts
play session.out  # Replay

# Use termcast.app (requires account)
termcast
bun run src/index.ts
# Get URL from termcast output

# Use asciinema
asciinema rec session.json
bun run src/index.ts
asciinema play session.json
```

#### Terminal Multiplexing

```bash
# Run in tmux
tmux new-session -d -s polymarket -x 120 -y 30 \
  "bun run src/index.ts"
tmux attach -t polymarket

# Run in screen
screen -S polymarket -c /dev/null -d -m \
  bun run src/index.ts
screen -r polymarket

# Kill tmux/screen session
tmux kill-session -t polymarket
screen -S polymarket -X quit
```

#### Docker Usage

```bash
# Build Docker image
docker build -t polymarket-tui .

# Run in container
docker run -it polymarket-tui

# Run with volume mount
docker run -it -v ~/.polymarket-tui:/root/.polymarket-tui polymarket-tui

# Run in background
docker run -d polymarket-tui > container_id.txt
docker logs -f $(cat container_id.txt)
```

### Troubleshooting Commands

#### Diagnostics

```bash
# Check Bun version
bun --version

# Check Node compatibility
bun --help | grep node

# Verify TypeScript
bunx tsc --version

# Check terminal info
infocmp | head

# Test ANSI colors
seq 30 37 | xargs -I {} bash -c 'echo -e "\033[{}mColor {}m"'
```

#### Fix Common Issues

```bash
# Terminal looks broken
clear
reset

# Restore after crash
stty sane

# Verify UTF-8
file ~/.polymarket-tui/config.json

# Check file permissions
ls -la ~/.polymarket-tui/

# Fix config
chmod 700 ~/.polymarket-tui
chmod 600 ~/.polymarket-tui/config.json

# Reset to defaults
rm -rf ~/.polymarket-tui
```

#### Network Testing

```bash
# Check CLOB API
curl -I https://clob.polymarket.com/markets

# Check GraphQL
curl -I https://api.thegraph.com/subgraphs/name/polymarket/polymarket

# Trace DNS
dig clob.polymarket.com

# Test connectivity
nc -zv clob.polymarket.com 443
nc -zv api.thegraph.com 443
```

### Common Workflows

#### Daily Usage

```bash
# 1. Start the app
bun run src/index.ts

# 2. Navigate markets
# Press ↓ several times

# 3. Search for interest
# Type "Bitcoin"

# 4. View price chart
# Press 7 for 7-day, 1 for 1-day

# 5. Exit
# Press Q or Ctrl+C
```

#### Monitoring Session

```bash
# 1. Start with auto-refresh
bun run src/index.ts

# 2. Select market of interest
# Use ↑↓ to navigate

# 3. Refresh manually if needed
# Press R

# 4. Watch 24-hour changes
# Check "24h%" column in left panel

# 5. Exit gracefully
# Press Q
```

#### Development Session

```bash
# 1. Start dev monitoring
bun run src/index.ts &

# 2. Edit component
vim src/components/market-list.tsx

# 3. Type check changes
bun run type-check

# 4. Restart app (Ctrl+C, then)
bun run src/index.ts

# 5. Verify changes
# Navigate through app to test
```

#### Troubleshooting Session

```bash
# 1. Check system info
bun --version
echo $TERM

# 2. Run with debug output
bun run src/index.ts 2>&1 | head -50

# 3. Test API separately
curl https://clob.polymarket.com/markets | jq '.markets | length'

# 4. Check state file
cat ~/.polymarket-tui/config.json

# 5. Reset and retry
rm ~/.polymarket-tui/config.json
bun run src/index.ts
```

### Useful Aliases

Add to your shell profile (~/.bashrc, ~/.zshrc):

```bash
# Quick start
alias poly='bun run /path/to/polymarket-bloomberg-tui/src/index.ts'

# Quick dev
alias poly-dev='cd /path/to/polymarket-bloomberg-tui && bun run src/index.ts'

# Type check
alias poly-check='cd /path/to/polymarket-bloomberg-tui && bun run type-check'

# View config
alias poly-config='cat ~/.polymarket-tui/config.json'

# Reset config
alias poly-reset='rm ~/.polymarket-tui/config.json'

# Build standalone
alias poly-build='bun build /path/to/polymarket-bloomberg-tui/src/index.ts --compile --outfile=~/bin/polymarket-tui'
```

Then use:
```bash
poly              # Start app
poly-check        # Type check
poly-config       # View settings
poly-reset        # Reset settings
```

## Quick Reference Sheet

```
╔═══════════════════════════════════════════════════════════╗
║         POLYMARKET TUI - QUICK REFERENCE                  ║
╠═══════════════════════════════════════════════════════════╣
║ NAVIGATION                    │ VIEW                      ║
║ ↑ ↓       Navigate markets    │ 1 5 7 A   Chart times    ║
║ ← →       Scroll panel         │ R         Refresh        ║
║ ─────────────────────────────│─────────────────────────  ║
║ SORTING/SEARCH               │ APPLICATION               ║
║ ^K        Cycle sort          │ Q Ctrl+C  Quit          ║
║ Type      Filter              │ Enter     Select         ║
╚═══════════════════════════════════════════════════════════╝
```

---

*For detailed information, see README.md and DEVELOPMENT.md*
