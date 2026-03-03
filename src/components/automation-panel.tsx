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
import { PanelHeader, Separator } from "./ui/panel-components";

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
      <PanelHeader
        title="AUTOMATION ENGINE"
        icon="◈"
        subtitle={`${rules().length} rules  │  ${alerts().length} scanner alerts`}
        onClose={() => setAutomationPanelOpen(false)}
      />

      {/* Tab bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={automationTab() === "rules" ? theme.warning : undefined}
          onMouseDown={() => { setAutomationTab("rules"); setAutomationSelectedIdx(0); }}
        >
          <text
            content={` RULES (${rules().length}) `}
            fg={automationTab() === "rules" ? theme.background : theme.textMuted}
          />
        </box>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={automationTab() === "alerts" ? theme.warning : undefined}
          onMouseDown={() => { setAutomationTab("alerts"); setAutomationSelectedIdx(0); }}
        >
          <text
            content={` SCANNER (${alerts().length}) `}
            fg={automationTab() === "alerts" ? theme.background : theme.textMuted}
          />
        </box>
        <Show when={alerts().filter(a => a.severity === "high").length > 0}>
          <box paddingLeft={2}>
            <text content={`⚠ ${alerts().filter(a => a.severity === "high").length} high sev`} fg={theme.error} />
          </box>
        </Show>
      </box>

      {/* Separator */}
      <Separator type="heavy" />

      {/* Rules tab */}
      <Show when={automationTab() === "rules"}>
        <box flexGrow={1} flexDirection="column" paddingLeft={1}>
          {/* Column headers */}
          <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
            <text content="   " width={3} fg={theme.textMuted} />
            <text content={"EN".padEnd(4)} width={4} fg={theme.textMuted} />
            <text content={"NAME".padEnd(22)} width={22} fg={theme.textMuted} />
            <text content={"TRIGGER".padEnd(14)} width={14} fg={theme.textMuted} />
            <text content={"ACTION".padEnd(14)} width={14} fg={theme.textMuted} />
            <text content="LAST FIRED" fg={theme.textMuted} />
          </box>

          <Show
            when={rules().length > 0}
            fallback={
              <box flexGrow={1} paddingTop={2} paddingLeft={2}>
                <text content="No automation rules configured." fg={theme.textMuted} />
                <text content="" />
                <text content="Edit ~/.polymarket-tui/rules.json to add rules." fg={theme.textMuted} />
                <text content="Rules run automatically on each market refresh." fg={theme.textMuted} />
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
                        content={rule.enabled ? " ✓  " : " ✗  "}
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
                        fg={rule.lastTriggered ? theme.success : theme.textMuted}
                      />
                    </box>
                  );
                }}
              </For>
            </scrollbox>
          </Show>
        </box>

        {/* Rules footer */}
        <Separator type="light" />
        <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={2} flexDirection="row">
          <text content="[Space/Enter] Toggle  " fg={theme.textMuted} />
          <text content="[D] Delete  " fg={theme.textMuted} />
          <text content="[Tab] Scanner Alerts  " fg={theme.textMuted} />
          <text content="[B] Close" fg={theme.textMuted} />
        </box>
      </Show>

      {/* Scanner Alerts tab */}
      <Show when={automationTab() === "alerts"}>
        <box flexGrow={1} flexDirection="column" paddingLeft={1}>
          {/* Column headers */}
          <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
            <text content="   " width={3} fg={theme.textMuted} />
            <text content={"TYPE".padEnd(12)} width={12} fg={theme.textMuted} />
            <text content={"SEV".padEnd(8)} width={8} fg={theme.textMuted} />
            <text content={"MARKET".padEnd(25)} width={25} fg={theme.textMuted} />
            <text content="MESSAGE" fg={theme.textMuted} />
          </box>

          <Show
            when={alerts().length > 0}
            fallback={
              <box flexGrow={1} paddingTop={2} paddingLeft={2}>
                <text content="No scanner alerts triggered yet." fg={theme.textMuted} />
                <text content="" />
                <text content="Alerts appear after each market data refresh." fg={theme.textMuted} />
                <text content="The scanner watches for: volume spikes, price moves, arbitrage, low liquidity." fg={theme.textMuted} />
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
                      backgroundColor={isSelected() ? theme.highlight : alert.severity === "high" ? theme.errorMuted : undefined}
                      onMouseDown={() => setAutomationSelectedIdx(i())}
                    >
                      <text content={isSelected() ? " ▶ " : "   "} fg={theme.warning} width={3} />
                      <text
                        content={typeLabel(alert.type).padEnd(11, " ")}
                        fg={isSelected() ? theme.highlightText : severityColor(alert.severity)}
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
                        content={truncate(alert.message, 58)}
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
        <Separator type="light" />
        <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={2} flexDirection="row">
          <text content="[C] Clear All  " fg={theme.textMuted} />
          <text content="[D] Delete Selected  " fg={theme.textMuted} />
          <text content="[Tab] Rules Tab  " fg={theme.textMuted} />
          <text content="[B] Close" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );
}
