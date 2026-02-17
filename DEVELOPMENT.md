# Development Guide

## Project Structure Summary

```
polymarket-bloomberg-tui/
├── src/
│   ├── index.ts                      # Entry point - TUI renderer
│   ├── app.tsx                       # Root component - orchestration
│   ├── state.ts                      # Global state (signals + store)
│   │
│   ├── types/
│   │   ├── market.ts                 # Market data types
│   │   └── api.ts                    # API response types
│   │
│   ├── api/
│   │   ├── polymarket.ts             # API client (CLOB + GraphQL)
│   │   └── queries.ts                # GraphQL query definitions
│   │
│   ├── components/
│   │   ├── layout.tsx                # Main grid layout
│   │   ├── search-bar.tsx            # Top search input
│   │   ├── market-list.tsx           # Left panel markets
│   │   ├── market-details.tsx        # Right panel details
│   │   ├── chart.tsx                 # ASCII price chart
│   │   ├── outcome-table.tsx         # Outcome prices table
│   │   └── status-bar.tsx            # Bottom status line
│   │
│   ├── hooks/
│   │   ├── useMarketData.ts          # Data fetching hooks
│   │   └── useKeyboardInput.ts       # Keyboard handler
│   │
│   └── utils/
│       ├── format.ts                 # Number/price formatting
│       ├── colors.ts                 # ANSI color helpers
│       └── chart-utils.ts            # ASCII chart rendering
│
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── README.md                         # User documentation
├── DEVELOPMENT.md                    # This file
└── .gitignore                        # Git ignore rules
```

## Technology Stack

- **Runtime**: Bun (uses SWC for TS compilation)
- **UI Framework**: OpenTUI (@opentui/core) + SolidJS reconciler
- **State**: SolidJS signals and store (reactive)
- **API**: graphql-request for GraphQL queries
- **Charts**: simple-ascii-chart for terminal graphics
- **Language**: TypeScript with JSX support

## Key Implementation Details

### 1. State Management (`src/state.ts`)

Uses SolidJS store pattern for reactive state:

```typescript
const [appState, setAppState] = createStore<AppState>({
  markets: [],
  selectedMarketId: null,
  searchQuery: "",
  sortBy: "volume",
  timeframe: "7d",
  loading: false,
  error: null,
  lastRefresh: new Date(),
});
```

Signals for UI updates:
- `highlightedIndex`: Current keyboard navigation position
- `isRefreshing`: UI loading state

Persistence:
- Saves to `~/.polymarket-tui/config.json` on state changes
- Loads on app startup

### 2. API Client (`src/api/polymarket.ts`)

**Primary Flow**: CLOB API → GraphQL Subgraph (fallback)

Functions:
- `getMarkets(limit)`: Fetch list of markets
- `getMarketDetails(marketId)`: Fetch full market info
- `getPriceHistory(marketId, timeframe)`: Fetch historical prices
- `searchMarkets(query)`: Search by keyword

Error handling:
- Try-catch blocks with fallback logic
- Synthetic data generation if APIs unavailable (demo mode)
- Logs errors to console

### 3. Components Architecture

**Parent → Child Flow**:

```
App (app.tsx)
└── Layout (layout.tsx)
    ├── SearchBar (search-bar.tsx)           [Top bar - 5%]
    ├── MarketList (market-list.tsx)        [Left - 30%]
    └── MarketDetails (market-details.tsx)  [Right - 70%]
        ├── Chart (chart.tsx)
        ├── OutcomeTable (outcome-table.tsx)
        └── Status area
    └── StatusBar (status-bar.tsx)           [Bottom - 5%]
```

**Data Flow** (reactive):
1. State changes → SolidJS tracks dependencies
2. Only affected components re-render
3. Terminal output updated only for changed regions

### 4. Keyboard Input (`src/hooks/useKeyboardInput.ts`)

Handles raw terminal input:
- Parses ANSI escape sequences (arrow keys, etc.)
- Maps to semantic key names (ArrowUp, ArrowDown, etc.)
- Executes handlers from key handler list
- Terminal stays in raw mode for immediate response

Key sequences:
```
↑/↓       → ArrowUp/ArrowDown
←/→       → ArrowLeft/ArrowRight
Enter     → \r or \n
Ctrl+C    → \x03 → exit
Ctrl+K    → \x0b → menu
```

### 5. Formatting & Colors (`src/utils/`)

**format.ts**:
- `formatPrice(0.42)` → "42.00%"
- `formatVolume(1500000)` → "$1.5M"
- `formatChange(+2.5)` → "+2.50%"
- `truncateString(str, 30)` → "Some long title..."
- `padRight/padLeft/centerString()` → alignment

**colors.ts**:
- ANSI 256-color support
- Helpers: `green()`, `red()`, `cyan()`, `bold()`, `dim()`
- Change formatter: green for +, red for -, yellow for neutral
- Safe color reset after each styled text

**chart-utils.ts**:
- `generateSimpleChart()`: ASCII bar/line chart
- `generateSparkline()`: Compact inline chart (▁▂▃▄▅▆▇█)
- `formatChartLabel()`: Price label formatting

### 6. Data Flow on Startup

1. **index.ts** → Clears terminal, hides cursor, renders App
2. **app.tsx** → Initializes state, sets up effects
3. **state.ts** → Loads persisted config
4. **useMarketData.ts** → `useMarketsFetch()` effect triggers
5. **api/polymarket.ts** → Fetches markets from CLOB/GraphQL
6. **state.ts** → Updates store with new markets
7. **Components** → Re-render with new market list
8. **keyboard** → useKeyboardInput sets up listeners
9. **refresh** → useRefreshInterval starts 30s timer

### 7. User Interaction Flow

**Example: Navigate and view market**

1. User presses ↓
2. `useKeyboardInput` → calls `navigateNext()` handler
3. `navigateNext()` → updates `highlightedIndex` signal + calls `selectMarket(id)`
4. `selectMarket(id)` → updates store, saves to disk
5. **app.tsx** → `createEffect` detects `selectedMarketId` change
6. **useSelectedMarketDetails()** → fetches market details
7. **usePriceHistory()** → fetches price history for chart
8. Store updated → components re-render
9. Terminal shows updated market details panel

**Example: Search for markets**

1. User types "bitcoin"
2. `SearchBar` → calls `updateSearchQuery("bitcoin")`
3. `updateSearchQuery()` → updates store, resets highlight to 0
4. **MarketList** → re-filters via `getFilteredMarkets()`
5. Matching markets shown, others hidden
6. Terminal updates

## Running the Application

### Development

```bash
# Install dependencies
bun install

# Run with live updates (auto-recompile)
bun run dev

# Type check without running
bun run type-check
```

### Production

```bash
# Build to dist/
bun run build

# Create standalone executable
bun build src/index.ts --compile --outfile=polymarket-tui

# Run standalone binary
./polymarket-tui
```

## Extending the Application

### Add New Component

1. Create `src/components/new-component.tsx`
2. Import in parent component
3. Use SolidJS JSX syntax (JSX = HTML for render)
4. Access state via `import { appState } from "../state"`

Example:
```tsx
import { appState } from "../state";
import { bold, cyan } from "../utils/colors";

export function NewComponent() {
  return (
    <div>
      {bold(cyan("Component Title"))}
      {appState.selectedMarketId && (
        <div>Selected: {appState.selectedMarketId}</div>
      )}
    </div>
  );
}
```

### Add New State Signal

In `src/state.ts`:
```typescript
export const [mySignal, setMySignal] = createSignal<string>("initial value");

// Or in store:
setAppState("newField", value);
```

### Add New Keyboard Handler

In `src/app.tsx`:
```typescript
{
  key: "x",
  handler: () => {
    // Do something
  },
  description: "Do something with X key"
}
```

### Add New API Query

1. Define GraphQL query in `src/api/queries.ts`
2. Create fetch function in `src/api/polymarket.ts`
3. Import and use in components via `createEffect` or custom hook

### Add Color Theme

In `src/utils/colors.ts`:
```typescript
export function themeColor(text: string, theme: "light" | "dark"): string {
  return theme === "light" ? cyan(text) : blue(text);
}
```

## Testing Tips

### Manual Testing

1. **Markets Load**: Should see list of markets with volumes
2. **Navigation**: Arrow keys change highlight
3. **Details Update**: Right panel updates when market selected
4. **Search**: Typing filters market list
5. **Sort**: Ctrl+K cycles through sort methods
6. **Chart**: Changes appear when timeframe selected
7. **Refresh**: Data updates every 30s, or immediately with R key
8. **Exit**: Graceful shutdown, persists state

### Debug Output

Enable console logs:
```typescript
// In api/polymarket.ts
console.log("Fetching markets...", { limit });
console.log("Markets fetched:", markets.length);

// In state.ts
console.log("State updated:", appState);
```

Run with stderr visible:
```bash
bun run src/index.ts 2>&1 | tee debug.log
```

### Test with Mock Data

Modify `src/api/polymarket.ts` to bypass API:

```typescript
export async function getMarkets(limit: number = 50): Promise<Market[]> {
  // Return mock data instead of fetching
  return [
    {
      id: "0x123",
      title: "Will Bitcoin reach $100k by end of 2024?",
      outcomes: [
        { id: "1", title: "Yes", price: 0.65, volume24h: 500000, ... },
        { id: "2", title: "No", price: 0.35, volume24h: 300000, ... }
      ],
      // ...
    }
  ];
}
```

## Performance Optimization

### Current Bottlenecks

1. **API Fetching**: 1-2 second latency per request
   - Solution: Cache with TTL, WebSocket for updates

2. **Rendering**: All components re-render on store change
   - Solution: Use `createMemo()` for expensive computations

3. **Market List**: Max 20 visible, renders all
   - Solution: Virtual scrolling library

4. **Chart Generation**: ASCII rendering every display
   - Solution: Memoize chart data, cache rendered output

### Optimization Examples

**Memoize expensive computation**:
```typescript
import { createMemo } from "solid-js";

const sortedMarkets = createMemo(() => {
  return getFilteredMarkets().sort(...);
});
```

**Lazy load components**:
```typescript
import { lazy } from "solid-js";

const MarketList = lazy(() => import("./market-list"));
```

**Debounce search input**:
```typescript
let debounceTimer: number;

function handleSearch(query: string) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateSearchQuery(query);
  }, 300);
}
```

## Known Limitations

1. **Terminal Width/Height**: Fixed 80x24, adapts to actual terminal
2. **Market Count**: Loads 50 by default (configurable)
3. **Historical Data**: Limited by API availability (synthetic fallback)
4. **No Pagination**: All markets in memory
5. **Keyboard**: No mouse support
6. **Search**: Case-insensitive substring matching only
7. **Colors**: 256-color minimum (older terminals may have issues)

## Future Enhancements

### High Priority
- [ ] Virtual scrolling for large market lists
- [ ] WebSocket support for real-time updates
- [ ] Configurable refresh interval
- [ ] Command palette (Ctrl+P)
- [ ] Help menu (?, F1)

### Medium Priority
- [ ] User positions display (with wallet integration)
- [ ] Price alerts / notifications
- [ ] Watchlist / favorites
- [ ] Multi-market comparison view
- [ ] Export data to CSV

### Low Priority
- [ ] Dark/light themes
- [ ] Custom keyboard layouts
- [ ] Terminal theme configuration
- [ ] Tmux/screen integration
- [ ] Network graph visualization

## Troubleshooting Development

### TypeScript Errors

```bash
bun run type-check
```

Common issues:
- Missing `jsxImportSource` in tsconfig.json
- Incorrect type imports
- SolidJS-specific typing issues

### Terminal Rendering Issues

- Terminal too small: Resize to >80 columns
- Colors wrong: Check terminal color support
- No output: Check `src/index.ts` render call
- Cursor problems: Kill process with Ctrl+C or `pkill -f bun`

### API Errors

- CLOB API down: Falls back to GraphQL
- Rate limits: Add backoff logic in API client
- Network timeout: Increase timeout, improve fallback

### State Not Persisting

- Check `~/.polymarket-tui/config.json` exists
- Verify permissions on `~/.polymarket-tui/` directory
- Look for errors in console output

## Code Style & Conventions

### Naming
- Components: PascalCase (SearchBar)
- Functions: camelCase (getMarkets)
- Constants: UPPER_SNAKE_CASE (CLOB_API_BASE)
- Types: PascalCase (Market, Outcome)

### File Structure
- One component per file
- Utilities grouped by domain (format, colors, chart-utils)
- Types separated from implementations
- Tests would go in `__tests__/` directories

### Comments
- File header: Describe purpose
- Complex logic: Explain why, not what
- API docs: JSDoc for public functions
- TODOs: Link to GitHub issues

## Resources

- **OpenTUI**: https://opentui.dev
- **SolidJS**: https://solidjs.com
- **Bun**: https://bun.sh
- **ANSI Colors**: https://en.wikipedia.org/wiki/ANSI_escape_code
- **Polymarket CLOB API**: https://docs.polymarket.com
- **The Graph**: https://thegraph.com

## Contributing

1. Fork and clone
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes, test locally
4. Commit with clear messages
5. Push and create pull request

## License

MIT
