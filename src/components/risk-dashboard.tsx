/**
 * Risk Dashboard Component
 * Enterprise-grade risk management interface
 */

import { createSignal, createEffect, For, Show, createMemo } from "solid-js";
import { RGBA } from "@opentui/core";
import { useTheme } from "../context/theme";
import { getRiskEngine, PortfolioRisk, PositionRisk, RiskAlert, formatRiskLevel, formatRiskScore } from "../oms/risk-engine";
import { getOMS } from "../oms/core";
import { PanelHeader, Separator, DataRow } from "./ui/panel-components";

type RiskCallback = () => PortfolioRisk;
type RiskCallback2 = () => PortfolioRisk;

const _unused = (() => {
  // Dummy to suppress unused warnings
  const _r: RiskCallback = () => ({} as PortfolioRisk);
  return _r;
})();

interface RiskDashboardProps {
  onClose: () => void;
}

const RISK_SEVERITY_COLORS = {
  INFO: "text",
  WARNING: "warning",
  CRITICAL: "error",
  EMERGENCY: "error",
} as const;

export function RiskDashboard(props: RiskDashboardProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = createSignal<"overview" | "positions" | "alerts" | "limits">("overview");
  
  const riskEngine = getRiskEngine();
  const oms = getOMS();
  
  // Reactive state
  const [portfolioRisk, setPortfolioRisk] = createSignal<PortfolioRisk | null>(null);
  const [positionRisks, setPositionRisks] = createSignal<PositionRisk[]>([]);
  const [alerts, setAlerts] = createSignal<RiskAlert[]>([]);
  const [lastUpdate, setLastUpdate] = createSignal<Date>(new Date());
  
  // Subscribe to updates
  createEffect(() => {
    const unsubRisk = riskEngine.subscribe((risk) => {
      setPortfolioRisk(risk);
      setPositionRisks(riskEngine.getAllPositionRisks());
      setLastUpdate(new Date());
    });
    
    const unsubAlerts = riskEngine.subscribeToAlerts((alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
    });
    
    // Periodic refresh
    const interval = setInterval(() => {
      const positions = oms.getAllPositions();
      const summary = oms.getPortfolioSummary();
      riskEngine.calculatePortfolioRisk(positions, summary);
    }, 5000);
    
    // Initial calculation
    const positions = oms.getAllPositions();
    const summary = oms.getPortfolioSummary();
    riskEngine.calculatePortfolioRisk(positions, summary);
    
    return () => {
      unsubRisk();
      unsubAlerts();
      clearInterval(interval);
    };
  });
  
  // Computed values
  const portfolio = createMemo(() => oms.getPortfolioSummary());
  
  // ─── Tab Renderers ─────────────────────────────────────────────────────────

  const renderOverviewTab = () => (
    <box flexDirection="column" flexGrow={1}>
      {/* Portfolio Summary */}
      <box flexDirection="column" paddingLeft={2}>
        <text content="─── PORTFOLIO VALUE ─────────────────────────────────────" fg={theme.borderSubtle} />
        <DataRow 
          label="Total Value" 
          value={`$${portfolio().totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          valueColor="text"
        />
        <DataRow 
          label="Total P&L" 
          value={`${portfolio().totalPnL >= 0 ? "+" : ""}$${portfolio().totalPnL.toFixed(2)}`}
          valueColor={portfolio().totalPnL >= 0 ? "success" : "error"}
        />
        <DataRow 
          label="Unrealized" 
          value={`${portfolio().totalUnrealizedPnL >= 0 ? "+" : ""}$${portfolio().totalUnrealizedPnL.toFixed(2)}`}
          valueColor={portfolio().totalUnrealizedPnL >= 0 ? "success" : "error"}
        />
        <DataRow 
          label="Realized" 
          value={`${portfolio().totalRealizedPnL >= 0 ? "+" : ""}$${portfolio().totalRealizedPnL.toFixed(2)}`}
          valueColor={portfolio().totalRealizedPnL >= 0 ? "success" : "error"}
        />
      </box>
      
      {/* VaR Metrics */}
      <Show when={portfolioRisk()}>
        {(risk: RiskCallback) => (
          <box flexDirection="column" paddingLeft={2} paddingTop={1}>
            <text content="─── VaR METRICS ───────────────────────────────────────────" fg={theme.borderSubtle} />
            <DataRow label="VaR (95%, 1-day)" value={`$${risk().var95.toFixed(2)}`} valueColor="warning" />
            <DataRow label="VaR (99%, 1-day)" value={`$${risk().var99.toFixed(2)}`} valueColor="warning" />
            <DataRow label="Expected Shortfall (95%)" value={`$${risk().expectedShortfall95.toFixed(2)}`} valueColor="error" />
            <DataRow label="Expected Shortfall (99%)" value={`$${risk().expectedShortfall99.toFixed(2)}`} valueColor="error" />
          </box>
        )}
      </Show>
      
      {/* Greeks */}
      <Show when={portfolioRisk()}>
        {(risk: RiskCallback) => (
          <box flexDirection="column" paddingLeft={2} paddingTop={1}>
            <text content="─── GREEKS ────────────────────────────────────────────────" fg={theme.borderSubtle} />
            <DataRow label="Portfolio Delta" value={risk().portfolioDelta.toFixed(4)} valueColor="text" />
            <DataRow label="Portfolio Gamma" value={risk().portfolioGamma.toFixed(4)} valueColor="text" />
            <DataRow label="Portfolio Theta" value={risk().portfolioTheta.toFixed(4)} valueColor="text" />
          </box>
        )}
      </Show>
      
      {/* Concentration */}
      <Show when={portfolioRisk()}>
        {(risk: RiskCallback) => (
          <box flexDirection="column" paddingLeft={2} paddingTop={1}>
            <text content="─── CONCENTRATION ────────────────────────────────────────" fg={theme.borderSubtle} />
            <DataRow 
              label="Largest Position" 
              value={`${(risk().largestPositionPct * 100).toFixed(1)}%`}
              valueColor={risk().largestPositionPct > 0.2 ? "error" : "text"}
            />
            <DataRow 
              label="Top 5 Concentration" 
              value={`${(risk().top5ConcentrationPct * 100).toFixed(1)}%`}
              valueColor={risk().top5ConcentrationPct > 0.5 ? "warning" : "text"}
            />
          </box>
        )}
      </Show>
      
      {/* Drawdown */}
      <Show when={portfolioRisk()}>
        {(risk: RiskCallback) => (
          <box flexDirection="column" paddingLeft={2} paddingTop={1}>
            <text content="─── DRAWDOWN ─────────────────────────────────────────────" fg={theme.borderSubtle} />
            <DataRow 
              label="Current Drawdown" 
              value={`${(risk().currentDrawdown * 100).toFixed(2)}%`}
              valueColor={risk().currentDrawdown > 0.1 ? "error" : risk().currentDrawdown > 0.05 ? "warning" : "text"}
            />
            <DataRow label="Peak Value" value={`$${risk().drawdownPeak.toFixed(2)}`} valueColor="text" />
            <DataRow label="Max Drawdown" value={`$${risk().maxDrawdown.toFixed(2)}`} valueColor="error" />
          </box>
        )}
      </Show>
    </box>
  );

  const renderPositionsTab = () => (
    <box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <box flexDirection="row" paddingLeft={2} paddingTop={0}>
        <text content={"TOKEN".padEnd(16)} fg={theme.textMuted} width={16} />
        <text content={"VALUE".padStart(12)} fg={theme.textMuted} width={12} />
        <text content={"DELTA".padStart(10)} fg={theme.textMuted} width={10} />
        <text content={"P&L".padStart(12)} fg={theme.textMuted} width={12} />
        <text content={"RISK".padStart(12)} fg={theme.textMuted} width={12} />
        <text content={"LEVEL".padStart(8)} fg={theme.textMuted} width={8} />
      </box>
      
      <Separator type="light" />
      
      {/* Position rows */}
      <For each={positionRisks().sort((a, b) => b.value - a.value)}>
        {(pos) => (
          <box flexDirection="row" paddingLeft={2} paddingTop={0}>
            <text content={pos.tokenId.slice(0, 14).padEnd(16)} fg={theme.text} width={16} />
            <text content={`$${pos.value.toFixed(0)}`.padStart(12)} fg={theme.text} width={12} />
            <text content={pos.delta.toFixed(2).padStart(10)} fg={theme.accent} width={10} />
            <text 
              content={`${pos.totalPnL >= 0 ? "+" : ""}$${pos.totalPnL.toFixed(2)}`.padStart(12)} 
              fg={pos.totalPnL >= 0 ? theme.success : theme.error} 
              width={12}
            />
            <text 
              content={formatRiskScore(pos.riskScore).padStart(12)} 
              fg={pos.riskScore >= 80 ? theme.error : pos.riskScore >= 60 ? theme.warning : theme.success}
              width={12}
            />
            <text 
              content={formatRiskLevel(pos.riskLevel).padStart(8)} 
              fg={pos.riskLevel === "CRITICAL" ? theme.error : pos.riskLevel === "HIGH" ? theme.warning : theme.text}
              width={8}
            />
          </box>
        )}
      </For>
      
      <Show when={positionRisks().length === 0}>
        <box paddingLeft={2} paddingTop={1}>
          <text content="No positions with risk data" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );

  const renderAlertsTab = () => (
    <box flexDirection="column" flexGrow={1}>
      <For each={alerts()}>
        {(alert) => (
          <box flexDirection="column" paddingLeft={2} paddingTop={0}>
            <box flexDirection="row">
              <text content={`[${alert.severity}]`} fg={RISK_SEVERITY_COLORS[alert.severity]} width={10} />
              <text content={alert.title} fg={theme.text} />
            </box>
            <text content={alert.description} fg={theme.textMuted} />
            <Show when={alert.recommendedAction}>
              <text content={`→ ${alert.recommendedAction}`} fg={theme.accent} />
            </Show>
            <Separator type="light" />
          </box>
        )}
      </For>
      
      <Show when={alerts().length === 0}>
        <box paddingLeft={2} paddingTop={1}>
          <text content="No risk alerts" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );

  const renderLimitsTab = () => (
    <box flexDirection="column" flexGrow={1} paddingLeft={2}>
      <text content="─── RISK LIMITS ───────────────────────────────────────────" fg={theme.borderSubtle} />
      
      <Show when={portfolioRisk()}>
        {(risk: RiskCallback) => (
          <>
            <DataRow 
              label="Position Count" 
              value={`${oms.getAllPositions().length} / ${riskEngine.getLimits().maxPositions}`}
              valueColor={oms.getAllPositions().length >= riskEngine.getLimits().maxPositions ? "error" : "text"}
            />
            <DataRow 
              label="Max Position Value" 
              value={`$${riskEngine.getLimits().maxPositionValue}`}
              valueColor="text"
            />
            <DataRow 
              label="Daily Loss Limit" 
              value={`$${riskEngine.getLimits().maxLossPerDay}`}
              valueColor="text"
            />
            <DataRow 
              label="Max Concentration" 
              value={`${(riskEngine.getLimits().maxSinglePositionPct * 100).toFixed(0)}%`}
              valueColor="text"
            />
            <DataRow 
              label="Max Drawdown" 
              value={`${(riskEngine.getLimits().maxDrawdownPct * 100).toFixed(0)}%`}
              valueColor="text"
            />
          </>
        )}
      </Show>
      
      <Show when={riskEngine.isCircuitBreakerActive()}>
        <box paddingTop={1}>
          <text content="⚠️ CIRCUIT BREAKER ACTIVE - Trading Paused" fg={theme.error} />
        </box>
      </Show>
    </box>
  );

  // ─── Main Render ───────────────────────────────────────────────────────────

  return (
    <box
      position="absolute"
      top={2}
      left="5%"
      width="90%"
      height={28}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={170}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ RISK DASHBOARD " fg={theme.highlightText} />
        <text content={` Updated: ${lastUpdate().toLocaleTimeString()} `} fg={theme.textMuted} />
        <box flexGrow={1} />
        <Show when={riskEngine.isCircuitBreakerActive()}>
          <text content=" 🔴 CB ACTIVE " fg={theme.error} />
        </Show>
        <box onMouseDown={props.onClose}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Tab bar */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel}>
        {(["overview", "positions", "alerts", "limits"] as const).map((tab) => (
          <box
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={activeTab() === tab ? theme.primary : undefined}
            onMouseDown={() => setActiveTab(tab)}
          >
            <text
              content={` ${tab.toUpperCase()} `}
              fg={activeTab() === tab ? theme.highlightText : theme.textMuted}
            />
          </box>
        ))}
        
        <box flexGrow={1} />
        <Show when={alerts().filter((a) => a.severity === "CRITICAL" || a.severity === "EMERGENCY").length > 0}>
          <text 
            content={` ${alerts().filter((a) => a.severity === "CRITICAL" || a.severity === "EMERGENCY").length} CRITICAL `} 
            fg={theme.error} 
          />
        </Show>
      </box>

      <Separator type="heavy" />

      {/* Tab content */}
      <Show when={activeTab() === "overview"}>{renderOverviewTab()}</Show>
      <Show when={activeTab() === "positions"}>{renderPositionsTab()}</Show>
      <Show when={activeTab() === "alerts"}>{renderAlertsTab()}</Show>
      <Show when={activeTab() === "limits"}>{renderLimitsTab()}</Show>

      {/* Footer */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel}>
        <text content=" [1]Overview [2]Positions [3]Alerts [4]Limits  [ESC]Close  Press 'R' to reset circuit breaker" fg={theme.textMuted} />
      </box>
    </box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini Risk Widget (for embedding)
// ─────────────────────────────────────────────────────────────────────────────

export function MiniRiskWidget() {
  const { theme } = useTheme();
  const riskEngine = getRiskEngine();
  
  const [risk, setRisk] = createSignal<PortfolioRisk | null>(null);
  
  createEffect(() => {
    const unsub = riskEngine.subscribe((r) => setRisk(r));
    return unsub;
  });
  
  return (
    <box flexDirection="column">
      <Show when={risk()}>
        {(r: RiskCallback2) => (
          <>
            <text content={` Portfolio: $${r().totalValue.toFixed(0)} `} fg={theme.text} />
            <text 
              content={` P&L: ${r().totalPnL >= 0 ? "+" : ""}$${r().totalPnL.toFixed(0)} `} 
              fg={r().totalPnL >= 0 ? theme.success : theme.error} 
            />
            <text 
              content={` VaR(95): $${r().var95.toFixed(0)} `} 
              fg={theme.warning} 
            />
            <Show when={r().breachedLimits.length > 0}>
              <text content=" ⚠️ LIMITS BREACHED " fg={theme.error} />
            </Show>
          </>
        )}
      </Show>
      
      <Show when={!risk()}>
        <text content=" Risk: Initializing... " fg={theme.textMuted} />
      </Show>
    </box>
  );
}