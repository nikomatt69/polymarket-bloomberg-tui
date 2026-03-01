/**
 * AutomationPanel — Rule engine UI + market scanner alerts
 * Two tabs: Rules | Scanner Alerts
 * Keyboard handled in app.tsx intercept block.
 */

import { Show, For, createMemo } from "solid-js";
import { useTheme } from "../context/theme";
import {
  automationPanelOpen,
  setAutomationPanelOpen,
  automationRules,
  setAutomationRules,
  scannerAlerts,
  setScannerAlerts,
  automationTab,
  setAutomationTab,
  automationSelectedIdx,
  setAutomationSelectedIdx,
} from "../state";
import { saveRules } from "../automation/rules";
import type { TradingRule } from "../automation/rules";
import type { ScanResult } from "../automation/scanner";

function fmtDate(ts: number): string {
  if (!ts) return "never";
  return new Date(ts).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

export function AutomationPanel() {
  const { theme } = useTheme();

  const rules = createMemo(() => automationRules());
  const alerts = createMemo(() => scannerAlerts());

  function toggleRule(idx: number) {
    const updated = rules().map((r, i) =>
      i === idx ? { ...r, enabled: !r.enabled } : r
    );
    setAutomationRules(updated);
    saveRules(updated);
  }

  function deleteRule(idx: number) {
    const updated = rules().filter((_, i) => i !== idx);
    setAutomationRules(updated);
    saveRules(updated);
    if (automationSelectedIdx() >= updated.length && updated.length > 0) {
      setAutomationSelectedIdx(updated.length - 1);
    }
  }

  function severityColor(sev: ScanResult["severity"]) {
    if (sev === "high") return theme.error;
    if (sev === "medium") return theme.warning;
    return theme.textMuted;
  }

  function typeLabel(type: ScanResult["type"]): string {
    switch (type) {
      case "volume_spike": return "VOL-SPIKE";
      case "price_movement": return "PRICE-MOV";
      case "arbitrage": return "ARBITRAGE";
      case "low_liquidity": return "LOW-LIQ  ";
      default: return type;
    }
  }

  return (
    <box
      position="absolute"
      top={1}
      left="5%"
      width="90%"
      height={28}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.warning} flexDirection="row">
        <text content=" ◈ AUTOMATION ENGINE " fg={theme.highlightText} />
        <box flexGrow={1} />
        <text content={`${rules().length} rules · ${alerts().length} alerts `} fg={theme.highlightText} />
        <box onMouseDown={() => setAutomationPanelOpen(false)}>
          <text content=" [B] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Tab bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <box
          onMouseDown={() => { setAutomationTab("rules"); setAutomationSelectedIdx(0); }}
          paddingLeft={1}
          paddingRight={1}
        >
          <text
            content={`[1] RULES (${rules().length})`}
            fg={automationTab() === "rules" ? theme.warning : theme.textMuted}
          />
        </box>
        <text content="  │  " fg={theme.border} />
        <box
          onMouseDown={() => { setAutomationTab("alerts"); setAutomationSelectedIdx(0); }}
          paddingRight={1}
        >
          <text
            content={`[2] SCANNER ALERTS (${alerts().length})`}
            fg={automationTab() === "alerts" ? theme.warning : theme.textMuted}
          />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

      {/* Rules tab */}
      <Show when={automationTab() === "rules"}>
        <box flexGrow={1} flexDirection="column" paddingLeft={1}>
          {/* Column headers */}
          <box flexDirection="row" width="100%">
            <text content="   " width={3} fg={theme.textMuted} />
            <text content="EN " width={4} fg={theme.textMuted} />
            <text content="NAME                 " width={22} fg={theme.textMuted} />
            <text content="TRIGGER      " width={14} fg={theme.textMuted} />
            <text content="ACTION       " width={14} fg={theme.textMuted} />
            <text content="LAST FIRED" fg={theme.textMuted} />
          </box>

          <Show
            when={rules().length > 0}
            fallback={
              <box flexGrow={1} paddingTop={1} paddingLeft={1}>
                <text content="No automation rules. Edit ~/.polymarket-tui/rules.json to add rules." fg={theme.textMuted} />
              </box>
            }
          >
            <scrollbox height={18} width="100%">
              <For each={rules()}>
                {(rule, i) => {
                  const isSelected = () => automationSelectedIdx() === i();
                  return (
                    <box
                      flexDirection="row"
                      width="100%"
                      backgroundColor={isSelected() ? theme.highlight : undefined}
                      onMouseDown={() => setAutomationSelectedIdx(i())}
                    >
                      <text content={isSelected() ? " ▶ " : "   "} fg={theme.warning} width={3} />
                      <text
                        content={rule.enabled ? "✓  " : "✗  "}
                        fg={rule.enabled ? theme.success : theme.error}
                        width={4}
                      />
                      <text
                        content={truncate(rule.name, 21).padEnd(21, " ")}
                        fg={isSelected() ? theme.highlightText : theme.text}
                        width={22}
                      />
                      <text
                        content={rule.trigger.type.padEnd(13, " ")}
                        fg={isSelected() ? theme.highlightText : theme.accent}
                        width={14}
                      />
                      <text
                        content={rule.action.type.padEnd(13, " ")}
                        fg={isSelected() ? theme.highlightText : theme.warning}
                        width={14}
                      />
                      <text
                        content={fmtDate(rule.lastTriggered ?? 0)}
                        fg={theme.textMuted}
                      />
                    </box>
                  );
                }}
              </For>
            </scrollbox>
          </Show>
        </box>

        {/* Rules footer */}
        <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={2} flexDirection="row">
          <text content="Space/Enter: toggle  " fg={theme.textMuted} />
          <text content="d: delete  " fg={theme.textMuted} />
          <text content="Tab: alerts tab  " fg={theme.textMuted} />
          <text content="[B] close" fg={theme.textMuted} />
        </box>
      </Show>

      {/* Scanner Alerts tab */}
      <Show when={automationTab() === "alerts"}>
        <box flexGrow={1} flexDirection="column" paddingLeft={1}>
          {/* Column headers */}
          <box flexDirection="row" width="100%">
            <text content="   " width={3} fg={theme.textMuted} />
            <text content="TYPE        " width={12} fg={theme.textMuted} />
            <text content="SEV    " width={8} fg={theme.textMuted} />
            <text content="MARKET                  " width={25} fg={theme.textMuted} />
            <text content="MESSAGE" fg={theme.textMuted} />
          </box>

          <Show
            when={alerts().length > 0}
            fallback={
              <box flexGrow={1} paddingTop={1} paddingLeft={1}>
                <text content="No scanner alerts. Alerts appear after market refresh." fg={theme.textMuted} />
              </box>
            }
          >
            <scrollbox height={18} width="100%">
              <For each={alerts()}>
                {(alert, i) => {
                  const isSelected = () => automationSelectedIdx() === i();
                  return (
                    <box
                      flexDirection="row"
                      width="100%"
                      backgroundColor={isSelected() ? theme.highlight : undefined}
                      onMouseDown={() => setAutomationSelectedIdx(i())}
                    >
                      <text content={isSelected() ? " ▶ " : "   "} fg={theme.warning} width={3} />
                      <text
                        content={typeLabel(alert.type).padEnd(11, " ")}
                        fg={severityColor(alert.severity)}
                        width={12}
                      />
                      <text
                        content={alert.severity.toUpperCase().padEnd(7, " ")}
                        fg={severityColor(alert.severity)}
                        width={8}
                      />
                      <text
                        content={truncate(alert.marketTitle, 24).padEnd(24, " ")}
                        fg={isSelected() ? theme.highlightText : theme.text}
                        width={25}
                      />
                      <text
                        content={truncate(alert.message, 60)}
                        fg={isSelected() ? theme.highlightText : theme.textMuted}
                      />
                    </box>
                  );
                }}
              </For>
            </scrollbox>
          </Show>
        </box>

        {/* Alerts footer */}
        <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={2} flexDirection="row">
          <text content="c: clear all  " fg={theme.textMuted} />
          <text content="d: delete selected  " fg={theme.textMuted} />
          <text content="Tab: rules tab  " fg={theme.textMuted} />
          <text content="[B] close" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );
}
