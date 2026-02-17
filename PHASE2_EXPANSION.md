# Phase 2 Expansion Plan - Polymarket Bloomberg TUI

## Overview

Phase 1 delivery is complete with a fully functional, production-ready read-only dashboard. Phase 2 focuses on expanding capabilities with trading, wallet integration, advanced features, and cross-platform support.

## Phase 2 Goals

1. **Wallet & Position Tracking**: Display user positions, P&L, and account balance
2. **Trading Interface**: Place orders, view order history, manage positions
3. **Advanced Analytics**: Price alerts, technical indicators, sentiment analysis
4. **Enhanced UI**: Multi-view layouts, customizable dashboard, themes
5. **Persistence**: Watchlist, order history, alert configuration
6. **Community**: Share sessions, collaborative analysis, market insights
7. **Mobile/Web**: Companion apps beyond terminal

## Detailed Roadmap

### A. Wallet Integration (High Priority)

#### A1. User Authentication
- **Task**: Add wallet connection flow
- **Files to Create**:
  - `src/auth/wallet.ts` - Wallet connection logic
  - `src/components/wallet-connect.tsx` - Connection UI
  - `src/hooks/useWallet.ts` - Wallet state hook

- **Implementation**:
```typescript
// src/auth/wallet.ts
import { PolymarketClob } from '@polymarket/clob-client';

export interface WalletState {
  address: string | null;
  connected: boolean;
  balance: number;
  username?: string;
}

export async function connectWallet(): Promise<string> {
  // Connect via ethers.js/web3modal to MetaMask, WalletConnect, etc.
  // Return user address
}

export function getWalletClient(address: string) {
  return new PolymarketClob({ chainId: 137, signer: ethers.provider.getSigner(address) });
}
```

- **Integration Points**:
  - Add wallet selector to SearchBar
  - Show balance in StatusBar
  - Display connected address in header

#### A2. Position Tracking
- **Task**: Fetch and display user positions
- **Files to Create**:
  - `src/api/positions.ts` - Position API client
  - `src/types/positions.ts` - Position types
  - `src/components/portfolio-panel.tsx` - Portfolio view
  - `src/hooks/usePositions.ts` - Position fetching hook

- **Implementation**:
```typescript
// src/api/positions.ts
export interface Position {
  marketId: string;
  outcomeId: string;
  shares: number;
  avgPrice: number;
  currentValue: number;
  change: number;
  change24h: number;
}

export async function getUserPositions(address: string): Promise<Position[]> {
  const client = getWalletClient(address);
  const positions = await client.getPositions(address);
  return positions.map(p => ({...}));
}

// Calculate P&L
export function calculatePnL(position: Position): number {
  return (position.currentValue - (position.shares * position.avgPrice));
}
```

- **UI Layout**:
  - New "Portfolio" tab in sidebar
  - Show positions grouped by market
  - Display P&L with color coding (green/red)
  - Real-time position updates

#### A3. Account Analytics
- **Files to Create**:
  - `src/components/account-stats.tsx` - Account overview
  - `src/api/account.ts` - Account data fetching
  - `src/utils/analytics.ts` - Calculation utilities

- **Metrics to Display**:
  - Total account balance
  - Total positions value
  - Unrealized P&L
  - Win rate (trades won / total trades)
  - Average trade size
  - Trading history (last 10 trades)
  - Asset allocation (pie chart)

### B. Trading Interface (High Priority)

#### B1. Order Placement
- **Files to Create**:
  - `src/components/order-form.tsx` - Order entry UI
  - `src/api/orders.ts` - Order API
  - `src/types/orders.ts` - Order types
  - `src/hooks/useOrder.ts` - Order submission hook

- **Implementation**:
```typescript
// src/types/orders.ts
export interface Order {
  marketId: string;
  outcomeId: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;
  estimatedCost?: number;
  slippage?: number;
}

export interface OrderResult {
  orderId: string;
  status: "PENDING" | "FILLED" | "PARTIAL" | "CANCELLED";
  filledShares: number;
  averagePrice: number;
}

// src/api/orders.ts
export async function placeOrder(order: Order, address: string): Promise<OrderResult> {
  const client = getWalletClient(address);
  return client.postOrder({
    marketId: order.marketId,
    outcomeId: order.outcomeId,
    side: order.side,
    shares: order.shares,
    price: order.price,
  });
}
```

- **UI Components**:
  - Modal order entry form (triggered with 'O' key)
  - Quick order buttons on outcome rows (Buy/Sell)
  - Order confirmation dialog
  - Real-time order status updates

#### B2. Order History
- **Files to Create**:
  - `src/components/order-history.tsx` - Order list view
  - `src/api/order-history.ts` - Historical data
  - `src/hooks/useOrderHistory.ts` - Fetch orders

- **Features**:
  - List recent 50 orders
  - Filter by status, market, date range
  - Search by market title
  - Export to CSV
  - Replay/duplicate order

#### B3. Advanced Ordering
- Limit orders with time-in-force (GTC/IOC/FOK)
- Batch orders (Multiple markets simultaneously)
- Order templates (Save/load frequent orders)
- Price alerts → Auto-order execution

### C. Analytics & Alerts (Medium Priority)

#### C1. Price Alerts
- **Files to Create**:
  - `src/components/alerts-panel.tsx` - Alert management
  - `src/api/alerts.ts` - Alert API
  - `src/types/alerts.ts` - Alert types
  - `src/hooks/useAlerts.ts` - Alert monitoring

- **Alert Types**:
  - Price reaches level (above/below)
  - 24h change threshold
  - Volume spike
  - Liquidity change
  - Outcome probability milestone

- **Persistence**:
  - Save to `~/.polymarket-tui/alerts.json`
  - Notifications via system bell or desktop notif

#### C2. Technical Indicators
- **Files to Create**:
  - `src/utils/indicators.ts` - TA calculations
  - `src/components/indicators.tsx` - Indicator display

- **Indicators**:
  - SMA (Simple Moving Average): 7d, 30d
  - RSI (Relative Strength Index)
  - MACD (Moving Average Convergence Divergence)
  - Bollinger Bands
  - Pivot points

#### C3. Sentiment Analysis
- **Files to Create**:
  - `src/api/sentiment.ts` - Sentiment API
  - `src/components/sentiment-panel.tsx` - Sentiment display
  - `src/hooks/useSentiment.ts` - Fetch sentiment

- **Data Sources**:
  - Claude API for market analysis (sample prompts)
  - Twitter sentiment (if API available)
  - Market discussion feeds
  - News aggregation

### D. Enhanced UI & UX (Medium Priority)

#### D1. Multi-View Dashboard
- **Files to Create**:
  - `src/components/view-manager.tsx` - View switcher
  - `src/components/split-view.tsx` - Dual market view
  - `src/components/comparison-panel.tsx` - Market comparison

- **View Modes**:
  - Standard (current): List + Details
  - Comparison: Side-by-side two markets
  - Portfolio: Account overview + positions
  - Analytics: Charts + indicators
  - Trading: Order form + recent fills

- **Layout Persistence**:
  - Save preferred layout
  - Remember last view

#### D2. Theming System
- **Files to Create**:
  - `src/theme/colors.ts` - Theme definitions
  - `src/theme/default.ts` - Default theme
  - `src/hooks/useTheme.ts` - Theme hook
  - `src/components/theme-selector.tsx` - Theme picker

- **Themes**:
  - Bloomberg (default, dark)
  - Light mode
  - Monochrome (accessibility)
  - Custom (user-defined)

#### D3. Customizable Dashboard
- **Files to Create**:
  - `src/components/dashboard-config.tsx` - Config UI
  - `src/utils/dashboard.ts` - Layout management

- **Customization**:
  - Reorder panels
  - Show/hide sections
  - Adjust column widths
  - Save/load layouts

### E. Persistence & Storage (Medium Priority)

#### E1. Watchlist
- **Files to Create**:
  - `src/api/watchlist.ts` - Watchlist management
  - `src/components/watchlist-panel.tsx` - Watchlist view
  - `src/hooks/useWatchlist.ts` - Watchlist hook

- **Features**:
  - Add/remove markets from watchlist
  - Create multiple watchlists (by category)
  - Quick view button
  - Saved to `~/.polymarket-tui/watchlists.json`

#### E2. Trade History & Analytics
- **Files to Create**:
  - `src/api/trade-history.ts` - History storage/retrieval
  - `src/components/trade-stats.tsx` - Statistics display
  - `src/utils/trade-analytics.ts` - Analysis functions

- **Metrics**:
  - Win/loss ratio
  - Average trade size
  - Average profit/loss
  - Best/worst trade
  - Monthly summary

#### E3. Database Backend (Optional)
- Upgrade from JSON files to SQLite or better
- Local schema: trades, alerts, watchlists, positions
- Schema migrations for version updates

### F. Community & Sharing (Low Priority)

#### F1. Session Streaming
- **Files to Create**:
  - `src/integrations/termcast.ts` - termcast.app integration
  - `src/components/share-button.tsx` - Share UI

- **Implementation**:
  - Auto-record session
  - Generate shareable link
  - Embed into Discord/Slack
  - Replay sessions

#### F2. Analysis Notes
- **Files to Create**:
  - `src/components/notes-panel.tsx` - Notes editor
  - `src/api/notes.ts` - Note storage
  - `src/types/notes.ts` - Note types

- **Features**:
  - Add notes to markets
  - Rich text formatting
  - Tags/categories
  - Export as markdown

#### F3. Community Features
- Market discussion integration (if available)
- Leaderboard (optional)
- Shared watchlists
- Strategy templates

### G. Mobile/Web Companion (Low Priority)

#### G1. Web Dashboard
- **Technology**: React + TypeScript (share logic/types)
- **Features**: All Phase 2 features plus:
  - Larger charts
  - Touch-friendly interface
  - Push notifications
  - Mobile-optimized layouts

#### G2. Mobile App
- **Technology**: React Native
- **Features**: Subset of web (core trading only):
  - View positions
  - Place orders
  - Price alerts
  - Push notifications

#### G3. API Server
- **Technology**: Node.js/Express or Rust/Axum
- **Purpose**: Backend for mobile/web
- **Features**:
  - User auth
  - Position sync
  - Order relaying
  - WebSocket updates

## Implementation Roadmap

### Quarter 1: Foundation
- [x] Phase 1: Read-only dashboard (COMPLETED)
- [ ] Wallet integration basics
- [ ] Position tracking
- [ ] Basic trading UI

### Quarter 2: Core Trading
- [ ] Full order placement
- [ ] Order history
- [ ] Account analytics
- [ ] Basic alerts

### Quarter 3: Advanced Features
- [ ] Technical indicators
- [ ] Sentiment analysis
- [ ] Multi-view dashboard
- [ ] Theming system

### Quarter 4: Polish & Expansion
- [ ] Watchlist system
- [ ] Session streaming
- [ ] Web companion app
- [ ] Community features

## Technical Considerations

### Dependencies to Add

```json
{
  "@polymarket/clob-client": "^0.x.x",
  "ethers": "^6.x.x",
  "web3modal": "^2.x.x",
  "@metamask/detect-provider": "^2.x.x",
  "decimal.js": "^10.x.x",
  "date-fns": "^2.x.x",
  "sqlite": "^5.x.x",
  "@anthropic-ai/sdk": "^0.x.x"
}
```

### Code Quality Improvements

- [ ] Add unit tests (Vitest)
- [ ] Add integration tests (E2E)
- [ ] Add error boundaries
- [ ] Improve error messages
- [ ] Add logging system (Winston)
- [ ] Add metrics/telemetry (optional)

### Performance Optimizations

- [ ] Implement virtual scrolling for large lists
- [ ] Add data caching layer (Redis-like)
- [ ] Optimize chart rendering (throttle)
- [ ] Reduce bundle size (tree-shaking)
- [ ] Add lazy-loading for components

### Security Enhancements

- [ ] Encrypt sensitive config
- [ ] Validate all inputs
- [ ] Rate limit API calls
- [ ] Secure wallet key storage
- [ ] Add permission system
- [ ] Audit logging

## Breaking Changes Planning

Phase 2 may introduce breaking changes:

1. **State Schema Changes**
   - Migration: Auto-upgrade `~/.polymarket-tui/config.json`
   - Add version field to all config files

2. **Component API Changes**
   - Deprecation warnings before removal
   - Migration guide in docs

3. **Database Schema Changes**
   - Migration scripts for SQLite upgrade
   - Backup before migration

## Testing Strategy

### Unit Tests
```typescript
// Example: test position P&L calculation
describe('calculatePnL', () => {
  it('should calculate unrealized P&L correctly', () => {
    const position = { shares: 100, avgPrice: 0.45, currentValue: 50 };
    expect(calculatePnL(position)).toBe(50 - 45);
  });
});
```

### Integration Tests
- Wallet connection flow
- Order placement → confirmation
- Position updates on new fills
- Alert triggering

### E2E Tests
- Full trading flow: Connect → Buy → Monitor → Sell
- Dashboard switching
- Multi-window interactions

## Documentation Updates

- [ ] API reference for new endpoints
- [ ] Trading guide (order types, strategies)
- [ ] Wallet setup instructions
- [ ] Admin/config guide
- [ ] Troubleshooting expanded
- [ ] Video tutorials

## Community & Feedback

### Beta Testing
- Invite 10-20 traders for Phase 2 beta
- Gather feedback on UX
- Bug bounty program (optional)

### Feedback Channels
- GitHub Issues (bugs)
- GitHub Discussions (features)
- Discord community (support)
- Bi-weekly product meetings

## Success Metrics

### Phase 2 Success Criteria

- [ ] >= 100 Monthly Active Users (MAU)
- [ ] >= 50 trades placed per day
- [ ] >= 95% order success rate
- [ ] < 100ms order latency
- [ ] < 50MB memory footprint
- [ ] >= 4.5/5 user satisfaction rating

### Performance Targets

- App startup: < 3s
- Market list load: < 2s
- Position fetch: < 1s
- Order placement: < 500ms
- Chart render: < 1s

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|-----------|
| Wallet integration complexity | Use existing SDKs, extensive testing |
| Order execution failures | Fallback logic, retry mechanism |
| Performance degradation | Load testing, caching strategy |
| Data loss | Regular backups, migration safeguards |

### Business Risks

| Risk | Mitigation |
|------|-----------|
| User adoption | Beta testing, feedback loops |
| Support burden | Good documentation, support tiers |
| Security issues | Audit before release, bug bounty |
| Regulatory changes | Monitor, adapt quickly |

## Conclusion

Phase 2 transforms the Polymarket TUI from read-only research tool to a full-featured trading platform. The 18-month plan prioritizes core trading functionality (Quarters 1-2) before adding advanced features (Quarters 3-4).

Success depends on:
1. **Solid foundations** from Phase 1 ✓
2. **User feedback** during development
3. **Rigorous testing** before each release
4. **Clear documentation** for all features
5. **Community engagement** and support

---

## Quick Links

- **Phase 1 Complete**: README.md, DEVELOPMENT.md
- **Architecture**: PROJECT_OVERVIEW.md
- **API Reference**: COMMANDS.md
- **Getting Started**: QUICKSTART.md

---

**Next Step**: Implement Wallet Integration (A1) in Quarter 1
