/**
 * Alerts management panel — list active/triggered alerts, add new, dismiss/delete
 * All keyboard handling lives in app.tsx intercept block.
 */

import { For, Show } from "solid-js";
import { useTheme } from "../context/theme";
import { alertsState, setAlertsState, deleteAlert, dismissAlert } from "../hooks/useAlerts";
import { PriceAlert, AlertMetric } from "../types/alerts";

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str.padEnd(len, " ");
}

function metricLabel(metric: AlertMetric): string {
  switch (metric) {
    case "price":
      return "PRICE";
    case "change24h":
      return "24H%";
    case "volume24h":
      return "VOLUME";
    case "liquidity":
      return "LIQUID";
    default:
      return "PRICE";
  }
}

function formatThreshold(alert: Pick<PriceAlert, "metric" | "threshold">): string {
  if (alert.metric === "price") {
    return `${(alert.threshold * 100).toFixed(1)}¢`;
  }
  if (alert.metric === "change24h") {
    const sign = alert.threshold >= 0 ? "+" : "";
    return `${sign}${alert.threshold.toFixed(2)}%`;
  }
  if (alert.metric === "volume24h" || alert.metric === "liquidity") {
    if (alert.threshold >= 1_000_000) return `$${(alert.threshold / 1_000_000).toFixed(2)}M`;
    if (alert.threshold >= 1_000) return `$${(alert.threshold / 1_000).toFixed(1)}K`;
    return `$${alert.threshold.toFixed(0)}`;
  }
  return String(alert.threshold);
}

export function AlertsPanel() {
  const { theme } = useTheme();

  const visibleAlerts = () =>
    alertsState.alerts.filter((a) => a.status !== "dismissed");

  function statusColor(status: PriceAlert["status"]) {
    switch (status) {
      case "active":    return theme.warning;
      case "triggered": return theme.success;
      default:          return theme.textMuted;
    }
  }

  const handleClose = () => setAlertsState("panelOpen", false);

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.warning} flexDirection="row">
        <text content=" ◈ PRICE ALERTS " fg={theme.highlightText} />
        <box flexGrow={1} />
        <text content={` ${visibleAlerts().length} active `} fg={theme.highlightText} />
        <box onMouseDown={handleClose}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.warningMuted} />

      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>

        {/* Column headers */}
        <box flexDirection="row" width="100%">
          <text content="   " fg={theme.textMuted} width={3} />
          <text content="TIME         " fg={theme.textMuted} width={14} />
          <text content="METRIC " fg={theme.textMuted} width={8} />
          <text content="COND  " fg={theme.textMuted} width={7} />
          <text content="THRESHOLD     " fg={theme.textMuted} width={14} />
          <text content="STATUS    " fg={theme.textMuted} width={11} />
          <text content="MARKET / OUTCOME" fg={theme.textMuted} />
        </box>

        <Show
          when={visibleAlerts().length > 0}
          fallback={<text content="No active alerts — press [A] to add one" fg={theme.textMuted} />}
        >
          <scrollbox height={10} width="100%">
            <For each={visibleAlerts()}>
              {(alert, i) => {
                const isSelected = () => alertsState.selectedIdx === i();
                return (
                  <box
                    flexDirection="row"
                    width="100%"
                    backgroundColor={isSelected() ? theme.highlight : undefined}
                    onMouseDown={() => setAlertsState("selectedIdx", i())}
                  >
                    <text content={isSelected() ? " ▶ " : "   "} fg={theme.warning} width={3} />
                    <text content={fmtTime(alert.createdAt).padEnd(13, " ")} fg={isSelected() ? theme.highlightText : theme.textMuted} width={14} />
                    <text
                      content={metricLabel(alert.metric).padEnd(7, " ")}
                      fg={isSelected() ? theme.highlightText : theme.accent}
                      width={8}
                    />
                    <text
                      content={(alert.condition + " ").padEnd(6, " ")}
                      fg={alert.condition === "above" ? theme.success : theme.error}
                      width={7}
                    />
                    <text
                      content={formatThreshold(alert).padStart(13, " ")}
                      fg={isSelected() ? theme.highlightText : theme.text}
                      width={14}
                    />
                    <text
                      content={alert.status.padEnd(10, " ")}
                      fg={statusColor(alert.status)}
                      width={11}
                    />
                    <text content={truncate(alert.marketTitle, 24)} fg={isSelected() ? theme.highlightText : theme.textMuted} width={25} />
                    <text content={alert.outcomeTitle.slice(0, 6)} fg={theme.accent} />
                  </box>
                );
              }}
            </For>
          </scrollbox>
        </Show>

        <text content="" />

        {/* Add form */}
        <Show when={alertsState.adding}>
          <box flexDirection="column" paddingLeft={1}>
            <text content="ADD ALERT — selected market's first outcome" fg={theme.primary} />
            <text content="" />
            <box flexDirection="row" gap={2}>
              <text content={alertsState.addFocus === "condition" ? "▶ Metric: " : "  Metric: "} fg={alertsState.addFocus === "condition" ? theme.accent : theme.textMuted} width={14} />
              <text content={`${metricLabel(alertsState.addMetric)}  (M to cycle)`} fg={theme.textBright} />
            </box>
            <box flexDirection="row" gap={2}>
              <text
                content={alertsState.addFocus === "condition" ? "▶ Condition: " : "  Condition: "}
                fg={alertsState.addFocus === "condition" ? theme.accent : theme.textMuted}
                width={14}
              />
              <text
                content={alertsState.addCondition === "above" ? "[ABOVE]  below " : " above  [BELOW]"}
                fg={theme.textBright}
              />
              <text content="  (C to toggle)" fg={theme.textMuted} />
            </box>
            <box flexDirection="row" gap={2}>
              <text
                content={alertsState.addFocus === "threshold" ? "▶ Threshold: " : "  Threshold: "}
                fg={alertsState.addFocus === "threshold" ? theme.accent : theme.textMuted}
                width={14}
              />
              <input
                width={10}
                value={alertsState.addThreshold}
                focused={alertsState.addFocus === "threshold"}
              />
              <text
                content={
                  alertsState.addMetric === "price"
                    ? "  (0-1)"
                    : alertsState.addMetric === "change24h"
                      ? "  (percent)"
                      : "  (USD)"
                }
                fg={theme.textMuted}
              />
            </box>
            <Show when={alertsState.addError !== ""}>
              <text content={`✗ ${alertsState.addError}`} fg={theme.error} />
            </Show>
            <text content="[ENTER] Save  [TAB] Switch  [M] Metric  [C] Condition  [ESC] Cancel" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={!alertsState.adding}>
          <box flexDirection="row" gap={3}>
            <box onMouseDown={() => { setAlertsState("adding", true); setAlertsState("addFocus", "threshold"); setAlertsState("addThreshold", ""); setAlertsState("addError", ""); }}>
              <text content="[A] Add" fg={theme.success} />
            </box>
            <box onMouseDown={() => {
              const alert = visibleAlerts()[alertsState.selectedIdx];
              if (alert) { deleteAlert(alert.id); setAlertsState("selectedIdx", Math.max(0, alertsState.selectedIdx - 1)); }
            }}>
              <text content="[D] Delete" fg={theme.error} />
            </box>
            <box onMouseDown={() => {
              const alert = visibleAlerts()[alertsState.selectedIdx];
              if (alert) dismissAlert(alert.id);
            }}>
              <text content="[X] Dismiss" fg={theme.textMuted} />
            </box>
            <text content="[↑↓] Navigate" fg={theme.textMuted} />
            <box onMouseDown={handleClose}>
              <text content="[ESC] Close" fg={theme.textMuted} />
            </box>
          </box>
        </Show>

      </box>
    </box>
  );
}
