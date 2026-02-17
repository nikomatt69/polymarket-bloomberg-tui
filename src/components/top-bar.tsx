/**
 * TopBar — branding, live clock, aggregate market stats
 */

import { createSignal, onCleanup, onMount, createMemo } from "solid-js";
import { useTheme } from "../context/theme";
import { appState } from "../state";
import { walletState } from "../state";

function fmtClock(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
}

function fmtVol(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function TopBar() {
  const { theme } = useTheme();
  const [now, setNow] = createSignal(new Date());

  onMount(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    onCleanup(() => clearInterval(id));
  });

  const totalVol = createMemo(() =>
    appState.markets.reduce((sum, m) => sum + (m.volume24h ?? 0), 0)
  );

  const marketCount = createMemo(() => appState.markets.length);

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={theme.primary}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Brand */}
      <text content="◈ POLYMARKET" fg={theme.highlightText} width={14} />
      <text content=" TUI " fg={theme.highlightText} width={5} />

      {/* Separator */}
      <text content="│" fg={theme.primaryMuted} width={3} />

      {/* Market stats */}
      <text content={`${marketCount()} markets`} fg={theme.highlightText} width={12} />
      <text content="│" fg={theme.primaryMuted} width={3} />
      <text content={`24h vol: ${fmtVol(totalVol())}`} fg={theme.highlightText} width={18} />

      {/* Wallet status */}
      <text content="│" fg={theme.primaryMuted} width={3} />
      <text
        content={walletState.connected ? `◉ ${walletState.address?.slice(0, 8)}…` : "○ No Wallet"}
        fg={theme.highlightText}
        width={16}
      />

      {/* Spacer */}
      <box flexGrow={1} />

      {/* Clock */}
      <text content={fmtDate(now())} fg={theme.highlightText} width={20} />
      <text content="  " width={2} />
      <text content={fmtClock(now())} fg={theme.highlightText} width={8} />
    </box>
  );
}
