/**
 * Alerts management panel — list active/triggered alerts, add new, dismiss/delete
 * All keyboard handling lives in app.tsx intercept block.
 */

import { For, Show } from "solid-js";
import { useTheme } from "../context/theme";
import { alertsState } from "../hooks/useAlerts";
import { PriceAlert } from "../types/alerts";

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

  return (
    <box
      position="absolute"
      top={2}
      left="10%"
      width="80%"
      height={24}
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" PRICE ALERTS " fg={theme.highlightText} width={15} />
        <box flexGrow={1} />
        <text content={` ${visibleAlerts().length} alerts `} fg={theme.highlightText} />
        <text content=" [ESC] Close " fg={theme.highlightText} width={14} />
      </box>

      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingTop={1}>

        {/* Column headers */}
        <box flexDirection="row" width="100%">
          <text content="TIME          " fg={theme.textMuted} width={14} />
          <text content="COND  " fg={theme.textMuted} width={7} />
          <text content="THRESH " fg={theme.textMuted} width={8} />
          <text content="STATUS    " fg={theme.textMuted} width={11} />
          <text content="MARKET / OUTCOME" fg={theme.textMuted} />
        </box>

        <Show
          when={visibleAlerts().length > 0}
          fallback={<text content="  No active alerts" fg={theme.textMuted} />}
        >
          <scrollbox height={10} width="100%">
            <For each={visibleAlerts()}>
              {(alert, i) => (
                <box flexDirection="row" width="100%">
                  <text
                    content={alertsState.selectedIdx === i() ? "▶" : " "}
                    fg={theme.primary}
                    width={2}
                  />
                  <text content={fmtTime(alert.createdAt).padEnd(13, " ")} fg={theme.textMuted} width={14} />
                  <text
                    content={(alert.condition + " ").padEnd(6, " ")}
                    fg={alert.condition === "above" ? theme.success : theme.error}
                    width={7}
                  />
                  <text content={`${(alert.threshold * 100).toFixed(1)}¢`.padStart(6, " ")} fg={theme.text} width={8} />
                  <text
                    content={alert.status.padEnd(10, " ")}
                    fg={statusColor(alert.status)}
                    width={11}
                  />
                  <text content={truncate(alert.marketTitle, 24)} fg={theme.textMuted} width={25} />
                  <text content={alert.outcomeTitle.slice(0, 6)} fg={theme.accent} />
                </box>
              )}
            </For>
          </scrollbox>
        </Show>

        <text content="" />

        {/* Add form */}
        <Show when={alertsState.adding}>
          <box flexDirection="column" paddingLeft={1}>
            <text content="ADD ALERT for selected market's first outcome" fg={theme.primary} />
            <text content="" />
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
                placeholder="0.00"
                value={alertsState.addThreshold}
                focused={alertsState.addFocus === "threshold"}
              />
              <text content="  (0-1)" fg={theme.textMuted} />
            </box>
            <Show when={alertsState.addError !== ""}>
              <text content={`  ✗ ${alertsState.addError}`} fg={theme.error} />
            </Show>
            <text content="  [ENTER] Save  [TAB] Switch  [C] Toggle condition  [ESC] Cancel" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={!alertsState.adding}>
          <text content="  [A] Add alert  [D] Delete  [X] Dismiss  ↑↓ Navigate" fg={theme.textMuted} />
        </Show>

      </box>
    </box>
  );
}
