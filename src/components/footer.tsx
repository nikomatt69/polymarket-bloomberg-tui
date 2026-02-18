/**
 * Footer — keyboard shortcuts reference bar
 */

import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useTheme } from "../context/theme";

interface KeyHint {
  key: string;
  fullLabel: string;
  shortLabel: string;
}

const HINTS: KeyHint[] = [
  { key: "↑↓/jk", fullLabel: "Navigate", shortLabel: "Nav" },
  { key: "Enter/Click", fullLabel: "AI Chat", shortLabel: "Chat" },
  { key: "O/S", fullLabel: "Buy/Sell", shortLabel: "Trade" },
  { key: "H", fullLabel: "Orders", shortLabel: "Orders" },
  { key: "P", fullLabel: "Portfolio", shortLabel: "Port" },
  { key: "Z", fullLabel: "Alerts", shortLabel: "Alerts" },
  { key: "W", fullLabel: "Wallet", shortLabel: "Wallet" },
  { key: "R", fullLabel: "Refresh", shortLabel: "Ref" },
  { key: "E", fullLabel: "Settings", shortLabel: "Set" },
  { key: "Q", fullLabel: "Quit", shortLabel: "Quit" },
];

const SHORTCUTS_PANEL_HINT = "[K] All Shortcuts";

export function Footer() {
  const { theme } = useTheme();
  const [columns, setColumns] = createSignal(
    Number.isFinite(process.stdout.columns) ? process.stdout.columns : 120,
  );

  onMount(() => {
    const handleResize = () => {
      if (Number.isFinite(process.stdout.columns)) {
        setColumns(process.stdout.columns);
      }
    };

    process.stdout.on("resize", handleResize);
    onCleanup(() => {
      process.stdout.off("resize", handleResize);
    });
  });

  const content = createMemo(() => {
    const cols = Math.max(24, columns());
    const maxLen = Math.max(12, cols - 3);
    const compact = cols < 110;
    const panelHint = SHORTCUTS_PANEL_HINT;
    const panelReserve = Math.min(maxLen, panelHint.length + 2);

    const chunks: string[] = [];
    let usedLen = 0;

    for (const hint of HINTS) {
      const label = compact ? hint.shortLabel : hint.fullLabel;
      const chunk = `[${hint.key}] ${label}`;
      const separatorLen = chunks.length === 0 ? 0 : 2;
      if (usedLen + separatorLen + chunk.length + panelReserve > maxLen) {
        break;
      }

      chunks.push(chunk);
      usedLen += separatorLen + chunk.length;
    }

    if (chunks.length === 0) {
      return panelHint.length <= maxLen ? panelHint : panelHint.slice(0, maxLen);
    }

    const hiddenCount = HINTS.length - chunks.length;
    const ellipsis = hiddenCount > 0 ? "  …" : "";
    return `${chunks.join("  ")}${ellipsis}  ${panelHint}`.trim();
  });

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={theme.backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
    >
      <text content={content()} fg={theme.textMuted} />
    </box>
  );
}
