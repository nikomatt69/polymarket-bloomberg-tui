/**
 * Footer — keyboard shortcuts reference bar
 */

import { useTheme } from "../context/theme";

interface KeyHint {
  key: string;
  label: string;
}

const HINTS: KeyHint[] = [
  { key: "↑↓", label: "Nav" },
  { key: "W", label: "Wallet" },
  { key: "O", label: "Buy" },
  { key: "S", label: "Sell" },
  { key: "H", label: "Orders" },
  { key: "P", label: "Portfolio" },
  { key: "Z", label: "Alerts" },
  { key: "I", label: "Indicators" },
  { key: "M", label: "Sentiment" },
  { key: "U", label: "Account" },
  { key: "C", label: "Compare" },
  { key: "L", label: "Watchlist" },
  { key: "X", label: "Watch+" },
  { key: "F", label: "Filter" },
  { key: "R", label: "Refresh" },
  { key: "1/5/7/A", label: "Timeframe" },
  { key: "K", label: "Shortcuts" },
  { key: "E", label: "Settings" },
  { key: "Q", label: "Quit" },
];

export function Footer() {
  const { theme } = useTheme();

  const content = HINTS.map(h => `[${h.key}] ${h.label}`).join("  ");

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={theme.backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
    >
      <text content={content} fg={theme.textMuted} />
    </box>
  );
}
