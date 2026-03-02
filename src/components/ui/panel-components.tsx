/**
 * UI Components — Enterprise panel building blocks
 * Provides consistent, professional styling across all panels
 */

import { For, Show } from "solid-js";
import { useTheme } from "../../context/theme";

interface PanelHeaderProps {
  title: string;
  icon?: string;
  shortcut?: string;
  subtitle?: string;
  onClose?: () => void;
  children?: any;
}

export function PanelHeader(props: PanelHeaderProps) {
  const { theme } = useTheme();

  return (
    <>
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <Show when={props.icon}>
          <text content={` ${props.icon} `} fg={theme.highlightText} />
        </Show>
        <text content={props.title.toUpperCase()} fg={theme.highlightText} />
        
        <Show when={props.subtitle}>
          <text content={` │ ${props.subtitle}`} fg={theme.primaryMuted} />
        </Show>
        
        <Show when={props.shortcut}>
          <box flexGrow={1} />
          <text content={`[${props.shortcut}] `} fg={theme.primaryMuted} />
        </Show>
        
        <Show when={props.onClose}>
          <text content="[ESC] " fg={theme.primaryMuted} />
          <text content="close" fg={theme.highlightText} />
        </Show>
      </box>
      
      <Show when={props.children}>
        <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
          {props.children}
        </box>
      </Show>
    </>
  );
}

interface SectionTitleProps {
  title: string;
  icon?: string;
}

export function SectionTitle(props: SectionTitleProps) {
  const { theme } = useTheme();

  return (
    <box flexDirection="row" paddingTop={1} paddingBottom={1} paddingLeft={1}>
      <Show when={props.icon}>
        <text content={`${props.icon} `} fg={theme.accent} />
      </Show>
      <text content={props.title.toUpperCase()} fg={theme.accent} />
    </box>
  );
}

interface DataRowProps {
  label: string;
  value: string;
  valueColor?: "text" | "accent" | "success" | "error" | "warning" | "muted";
  highlight?: boolean;
  compact?: boolean;
}

export function DataRow(props: DataRowProps) {
  const { theme } = useTheme();

  const getValueColor = () => {
    switch (props.valueColor) {
      case "success": return theme.success;
      case "error": return theme.error;
      case "warning": return theme.warning;
      case "accent": return theme.accent;
      case "muted": return theme.textMuted;
      default: return theme.text;
    }
  };

  return (
    <box 
      flexDirection="row" 
      paddingLeft={props.compact ? 0 : 1}
      paddingRight={1}
      paddingTop={props.compact ? 0 : 0}
      paddingBottom={props.compact ? 0 : 0}
    >
      <text content={props.label} fg={theme.textMuted} />
      <box flexGrow={1} />
      <text 
        content={props.highlight ? props.value.toUpperCase() : props.value} 
        fg={getValueColor()}
      />
    </box>
  );
}

interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "success" | "error" | "warning";
  label: string;
}

export function StatusBadge(props: StatusBadgeProps) {
  const { theme } = useTheme();

  const getStatusColor = () => {
    switch (props.status) {
      case "active":
      case "success": return theme.success;
      case "inactive":
      case "error": return theme.error;
      case "pending":
      case "warning": return theme.warning;
      default: return theme.textMuted;
    }
  };

  const getStatusIcon = () => {
    switch (props.status) {
      case "active":
      case "success": return "●";
      case "inactive":
      case "error": return "○";
      case "pending": return "◐";
      case "warning": return "⚠";
      default: return "·";
    }
  };

  return (
    <box flexDirection="row">
      <text content={getStatusIcon()} fg={getStatusColor()} />
      <text content={` ${props.label.toUpperCase()}`} fg={getStatusColor()} />
    </box>
  );
}

interface ShortcutHintProps {
  keys: string[];
  description?: string;
}

export function ShortcutHint(props: ShortcutHintProps) {
  const { theme } = useTheme();

  return (
    <box flexDirection="row">
      <For each={props.keys}>
        {(key, idx) => (
          <>
            <text content="[" fg={theme.textMuted} />
            <text content={key} fg={theme.accent} />
            <text content="]" fg={theme.textMuted} />
            <Show when={idx() < props.keys.length - 1}>
              <text content=" + " fg={theme.textMuted} />
            </Show>
          </>
        )}
      </For>
      <Show when={props.description}>
        <text content={` ${props.description}`} fg={theme.textMuted} />
      </Show>
    </box>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
}

export function EmptyState(props: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <box flexDirection="column" paddingLeft={2} paddingTop={2}>
      <Show when={props.icon}>
        <text content={props.icon} fg={theme.textMuted} />
      </Show>
      <text content={props.title} fg={theme.textMuted} />
      <Show when={props.description}>
        <text content={props.description} fg={theme.textMuted} />
      </Show>
    </box>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState(props: LoadingStateProps) {
  const { theme } = useTheme();

  return (
    <box flexDirection="row" paddingLeft={2} paddingTop={1}>
      <text content="◐" fg={theme.accent} />
      <text content={` ${props.message || "Loading..."}`} fg={theme.textMuted} />
    </box>
  );
}

interface SeparatorProps {
  type?: "light" | "heavy";
}

export function Separator(props: SeparatorProps) {
  const { theme } = useTheme();
  
  const getColor = () => {
    return props.type === "heavy" ? theme.border : theme.borderSubtle;
  };

  return (
    <box height={1} width="100%" backgroundColor={getColor()} />
  );
}

interface PriceChangeProps {
  value: number;
  showSign?: boolean;
}

export function PriceChange(props: PriceChangeProps) {
  const { theme } = useTheme();

  const getColor = () => {
    if (props.value > 0) return theme.success;
    if (props.value < 0) return theme.error;
    return theme.textMuted;
  };

  const formatValue = () => {
    const sign = props.showSign && props.value > 0 ? "+" : "";
    return `${sign}${props.value.toFixed(2)}%`;
  };

  const getIcon = () => {
    if (props.value > 0) return "▲";
    if (props.value < 0) return "▼";
    return "·";
  };

  return (
    <text content={`${getIcon()} ${formatValue()}`} fg={getColor()} />
  );
}

interface PriceDisplayProps {
  price: number;
  previousPrice?: number;
  showCents?: boolean;
}

export function PriceDisplay(props: PriceDisplayProps) {
  const { theme } = useTheme();

  const getColor = () => {
    if (!props.previousPrice) return theme.text;
    if (props.price > props.previousPrice) return theme.success;
    if (props.price < props.previousPrice) return theme.error;
    return theme.text;
  };

  const formatPrice = () => {
    const val = props.showCents ? props.price * 100 : props.price;
    return props.showCents ? `${val.toFixed(1)}¢` : val.toFixed(4);
  };

  return (
    <text content={formatPrice()} fg={getColor()} />
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  width?: number;
  showLabel?: boolean;
}

export function ProgressBar(props: ProgressBarProps) {
  const { theme } = useTheme();
  
  const percentage = () => Math.min(100, Math.max(0, (props.value / props.max) * 100));
  const barWidth = () => props.width || 20;
  const filled = () => Math.floor((percentage() / 100) * barWidth());
  const empty = () => barWidth() - filled();

  const getBarColor = () => {
    if (percentage() >= 80) return theme.success;
    if (percentage() >= 50) return theme.warning;
    return theme.error;
  };

  return (
    <box flexDirection="row">
      <text content="[" fg={theme.textMuted} />
      <text content={Array(filled()).fill("#").join("")} fg={getBarColor()} />
      <text content={Array(empty()).fill("-").join("")} fg={theme.textMuted} />
      <text content="]" fg={theme.textMuted} />
      <Show when={props.showLabel}>
        <text content={` ${percentage().toFixed(0)}%`} fg={theme.textMuted} />
      </Show>
    </box>
  );
}

interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabBar(props: TabBarProps) {
  const { theme } = useTheme();

  return (
    <box flexDirection="row" height={1} width="100%">
      <For each={props.tabs}>
        {(tab) => (
          <box 
            flexDirection="row" 
            paddingLeft={1} 
            paddingRight={1}
            onMouseDown={() => props.onTabChange(tab)}
          >
            <Show
              when={props.activeTab === tab}
              fallback={<text content={tab} fg={theme.textMuted} />}
            >
              <text content={">"} fg={theme.accent} />
              <text content={` ${tab} `} fg={theme.accent} />
              <text content={">"} fg={theme.accent} />
            </Show>
          </box>
        )}
      </For>
    </box>
  );
}
