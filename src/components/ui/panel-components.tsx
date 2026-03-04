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
      <text content="◌" fg={theme.accent} />
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
      <text content={Array(filled()).fill("█").join("")} fg={getBarColor()} />
      <text content={Array(empty()).fill("░").join("")} fg={theme.textMuted} />
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

interface PanelFooterProps {
  shortcuts?: Array<{ key: string; label: string; color?: "text" | "accent" | "success" | "error" | "warning" }>;
  children?: any;
}

export function PanelFooter(props: PanelFooterProps) {
  const { theme } = useTheme();

  const getColor = (c?: string) => {
    switch (c) {
      case "success": return theme.success;
      case "error": return theme.error;
      case "warning": return theme.warning;
      case "accent": return theme.accent;
      default: return theme.textMuted;
    }
  };

  return (
    <box 
      height={1} 
      width="100%" 
      backgroundColor={theme.backgroundPanel} 
      flexDirection="row"
      paddingLeft={1}
    >
      <Show when={props.shortcuts}>
        <For each={props.shortcuts}>
          {(shortcut, idx) => (
            <>
              <text content={`[${shortcut.key}]`} fg={getColor(shortcut.color)} />
              <text content={` ${shortcut.label}`} fg={theme.textMuted} />
              <Show when={idx() < props.shortcuts!.length - 1}>
                <text content="  " />
              </Show>
            </>
          )}
        </For>
      </Show>
      <Show when={props.children}>
        {props.children}
      </Show>
    </box>
  );
}

interface ActionButtonProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  color?: "text" | "accent" | "success" | "error" | "warning";
}

export function ActionButton(props: ActionButtonProps) {
  const { theme } = useTheme();

  const getColor = () => {
    switch (props.color) {
      case "success": return theme.success;
      case "error": return theme.error;
      case "warning": return theme.warning;
      case "accent": return theme.accent;
      default: return theme.text;
    }
  };

  return (
    <box onMouseDown={props.onClick}>
      <text 
        content={props.shortcut ? `[${props.shortcut}] ${props.label}` : props.label} 
        fg={props.active ? theme.accent : getColor()} 
      />
    </box>
  );
}

interface ActionBarProps {
  actions: Array<{
    label: string;
    shortcut?: string;
    onClick: () => void;
    active?: boolean;
    color?: "text" | "accent" | "success" | "error" | "warning";
  }>;
}

export function ActionBar(props: ActionBarProps) {
  const { theme } = useTheme();

  const getColor = (c?: string) => {
    switch (c) {
      case "success": return theme.success;
      case "error": return theme.error;
      case "warning": return theme.warning;
      case "accent": return theme.accent;
      default: return theme.text;
    }
  };

  return (
    <box flexDirection="row" gap={2} paddingTop={1}>
      <For each={props.actions}>
        {(action) => (
          <box onMouseDown={action.onClick}>
            <text 
              content={action.shortcut ? `[${action.shortcut}] ${action.label}` : action.label} 
              fg={action.active ? theme.accent : getColor(action.color)} 
            />
          </box>
        )}
      </For>
    </box>
  );
}

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
  color?: "text" | "accent" | "success" | "error" | "warning" | "muted";
}

interface DataTableRow {
  key: string;
  cells: Record<string, { content: string; color?: "text" | "success" | "error" | "accent" | "warning" | "muted" }>;
}

interface DataTableProps {
  columns: ColumnDef[];
  rows: DataTableRow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function DataTable(props: DataTableProps) {
  const { theme } = useTheme();

  const getColor = (c?: string) => {
    switch (c) {
      case "success": return theme.success;
      case "error": return theme.error;
      case "warning": return theme.warning;
      case "accent": return theme.accent;
      case "muted": return theme.textMuted;
      default: return theme.text;
    }
  };

  const alignContent = (content: string, width: number, align?: "left" | "right" | "center") => {
    if (align === "right") return content.padStart(width, " ");
    if (align === "center") {
      const pad = Math.floor((width - content.length) / 2);
      return " ".repeat(pad) + content + " ".repeat(width - pad - content.length);
    }
    return content.padEnd(width, " ");
  };

  return (
    <scrollbox flexGrow={1} width="100%">
      <For each={props.rows}>
        {(row, idx) => (
          <box 
            flexDirection="row" 
            width="100%"
            backgroundColor={props.selectedIndex === idx() ? theme.highlight : undefined}
            onMouseDown={() => props.onSelect(idx())}
          >
            <For each={props.columns}>
              {(col) => {
                const cell = row.cells[col.key];
                return (
                  <text 
                    content={alignContent(cell?.content || "", col.width, col.align)}
                    fg={getColor(cell?.color || col.color)}
                    width={col.width}
                  />
                );
              }}
            </For>
          </box>
        )}
      </For>
    </scrollbox>
  );
}

interface ColumnHeaderProps {
  columns: ColumnDef[];
}

export function ColumnHeaders(props: ColumnHeaderProps) {
  const { theme } = useTheme();

  return (
    <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
      <For each={props.columns}>
        {(col) => (
          <text content={col.label.padEnd(col.width, " ")} fg={theme.textMuted} width={col.width} />
        )}
      </For>
    </box>
  );
}

interface PanelContainerProps {
  title: string;
  icon?: string;
  subtitle?: string;
  shortcut?: string;
  onClose?: () => void;
  children?: any;
  position?: "absolute" | "relative";
  top?: number | `${number}%`;
  left?: number | `${number}%`;
  width?: number | `${number}%`;
  height?: number;
  zIndex?: number;
}

export function PanelContainer(props: PanelContainerProps) {
  const { theme } = useTheme();

  return (
    <box
      position={props.position || "absolute"}
      top={props.top ?? 2}
      left={props.left ?? "10%"}
      width={props.width ?? "80%"}
      height={props.height ?? 24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={props.zIndex ?? 100}
    >
      <PanelHeader
        title={props.title}
        icon={props.icon}
        subtitle={props.subtitle}
        shortcut={props.shortcut}
        onClose={props.onClose}
      />
      {props.children}
    </box>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  color?: "text" | "accent" | "success" | "error" | "warning";
}

export function StatCard(props: StatCardProps) {
  const { theme } = useTheme();

  const getColor = () => {
    switch (props.color) {
      case "success": return theme.success;
      case "error": return theme.error;
      case "warning": return theme.warning;
      case "accent": return theme.accent;
      default: return theme.text;
    }
  };

  return (
    <box flexDirection="column" paddingRight={3}>
      <text content={props.label} fg={theme.textMuted} />
      <text content={props.value} fg={getColor()} />
      <Show when={props.subValue}>
        <text content={props.subValue!} fg={theme.textMuted} />
      </Show>
    </box>
  );
}

interface MetricGridProps {
  items: Array<{ label: string; value: string; color?: "text" | "accent" | "success" | "error" | "warning" | "muted" }>;
  columns?: number;
}

export function MetricGrid(props: MetricGridProps) {
  const { theme } = useTheme();

  const getColor = (c?: string) => {
    switch (c) {
      case "success": return theme.success;
      case "error": return theme.error;
      case "warning": return theme.warning;
      case "accent": return theme.accent;
      case "muted": return theme.textMuted;
      default: return theme.text;
    }
  };

  return (
    <box flexDirection="column" paddingTop={1}>
      <For each={props.items}>
        {(item) => (
          <box flexDirection="row" width="100%">
            <text content={item.label} fg={theme.textMuted} />
            <box flexGrow={1} />
            <text content={item.value} fg={getColor(item.color)} />
          </box>
        )}
      </For>
    </box>
  );
}

interface PromptInputProps {
  value: string;
  onInput: (value: string) => void;
  focused: boolean;
  loading?: boolean;
  placeholder?: string;
}

export function PromptInput(props: PromptInputProps) {
  const { theme } = useTheme();

  return (
    <box height={2} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="column">
      <box flexDirection="row" width="100%">
        <text content=" > " fg={theme.accent} />
        <text content="MESSAGE" fg={theme.primary} />
        <box flexGrow={1} />
        <text content="[Up/Down]:history [Ctrl+L]:clear" fg={theme.textMuted} />
      </box>
      <box flexDirection="row" width="100%" paddingTop={0}>
        <text content=" " width={3} />
        <input 
          flexGrow={1}
          value={props.value}
          placeholder={props.placeholder || "type message..."}
          focused={props.focused}
        />
        <Show when={props.loading}>
          <text content=" ..." fg={theme.warning} />
        </Show>
      </box>
    </box>
  );
}

interface StreamingMessageProps {
  content: string;
  role?: "user" | "assistant";
}

export function StreamingMessage(props: StreamingMessageProps) {
  const { theme } = useTheme();

  function wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split("\n");
    for (const para of paragraphs) {
      if (para.length === 0) { lines.push(""); continue; }
      const words = para.split(" ");
      let current = "";
      for (const word of words) {
        if ((current + (current ? " " : "") + word).length <= maxWidth) {
          current = current ? current + " " + word : word;
        } else {
          if (current) lines.push(current);
          let w = word;
          while (w.length > maxWidth) {
            lines.push(w.slice(0, maxWidth));
            w = w.slice(maxWidth);
          }
          current = w;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }

  const lines = () => wrapText(props.content, 70);

  return (
    <box width="100%" flexDirection="column" paddingTop={1}>
      <box flexDirection="row" paddingLeft={1}>
        <text content={props.role === "user" ? "▶ You" : "◈ Agent"} fg={props.role === "user" ? theme.accent : theme.primary} />
        <text content=" | " fg={theme.textMuted} />
        <text content="generating..." fg={theme.warning} />
      </box>
      <box flexDirection="column" paddingLeft={2} paddingRight={1}>
        <For each={lines()}>
          {(line) => <text content={line} fg={theme.text} />}
        </For>
        <text content="_" fg={theme.primary} />
      </box>
    </box>
  );
}

interface ToolCall {
  id?: string;
  name: string;
  args?: unknown;
  result?: unknown;
  status: "calling" | "done" | "error";
  category?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

interface ToolCallListProps {
  tools: ToolCall[];
  title?: string;
  selectedId?: string;
  expandedIds?: string[];
  collapseByDefault?: boolean;
  compact?: boolean;
  onSelect?: (id: string) => void;
  onToggleExpand?: (id: string) => void;
}

export function ToolCallList(props: ToolCallListProps) {
  const { theme } = useTheme();

  const collapseByDefault = () => props.collapseByDefault ?? true;
  const maxCollapsedLines = () => (props.compact ? 1 : 2);
  const maxExpandedArgLines = () => (props.compact ? 3 : 6);
  const maxExpandedResultLines = () => (props.compact ? 4 : 10);

  const normalizeArgs = (args: unknown): Record<string, unknown> => {
    if (typeof args === "object" && args !== null && !Array.isArray(args)) {
      return args as Record<string, unknown>;
    }
    if (args === undefined) return {};
    return { value: args };
  };

  const summarizeValue = (value: unknown, maxLen: number): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value.length > maxLen ? `${value.slice(0, maxLen - 3)}...` : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      const json = JSON.stringify(value);
      return json.length > maxLen ? `${json.slice(0, maxLen - 3)}...` : json;
    } catch {
      return String(value);
    }
  };

  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  };

  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const formatMoney = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatProbability = (value: number): string => {
    if (value >= 0 && value <= 1) return `${(value * 100).toFixed(1)}c`;
    return `${value.toFixed(4)}`;
  };

  const formatDuration = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms}ms`;
  };

  const getToolCategory = (tool: ToolCall): string => {
    if (tool.category) return tool.category;
    const name = tool.name;
    if (["get_market_details", "get_market_price", "get_order_book", "analyze_market", "compare_outcomes", "search_markets"].includes(name)) return "market";
    if (["get_portfolio", "get_balance", "get_positions_details", "get_trade_history", "get_open_orders"].includes(name)) return "portfolio";
    if (["place_order", "cancel_order"].includes(name)) return "order";
    if (["get_categories", "search_by_category", "get_trending_markets", "get_sports_markets", "get_live_events", "get_events", "get_series_markets", "get_all_series", "get_all_tags", "get_markets_by_tag"].includes(name)) return "discovery";
    if (["navigate_to_market", "set_timeframe", "set_sort_by", "refresh_markets"].includes(name)) return "navigation";
    if (["open_wallet_modal", "open_portfolio", "open_order_form", "get_watchlist", "add_watchlist", "remove_watchlist", "get_alerts"].includes(name)) return "ui";
    return "unknown";
  };

  const getStatusColor = (status: ToolCall["status"]) => {
    if (status === "calling") return theme.accent;
    if (status === "error") return theme.error;
    return theme.success;
  };

  const getStatusToken = (status: ToolCall["status"]): string => {
    if (status === "calling") return "[>]";
    if (status === "error") return "[x]";
    return "[+]";
  };

  const getStatusLabel = (status: ToolCall["status"]): string => {
    if (status === "calling") return "RUN";
    if (status === "error") return "ERR";
    return "OK";
  };

  const getToolDuration = (tool: ToolCall): string => {
    if (!tool.startedAt) return "";
    const end = tool.completedAt ?? Date.now();
    const delta = Math.max(0, end - tool.startedAt);
    return formatDuration(delta);
  };

  const getPayload = (result: unknown): unknown => {
    if (typeof result !== "object" || result === null || Array.isArray(result)) return result;
    const record = result as Record<string, unknown>;
    if ("success" in record && "data" in record) {
      return record.data ?? record;
    }
    return record;
  };

  const summarizeArgs = (args: unknown): string => {
    const normalized = normalizeArgs(args);
    const entries = Object.entries(normalized).slice(0, 3);
    if (entries.length === 0) return "none";
    return entries.map(([key, value]) => `${key}=${summarizeValue(value, 20)}`).join("  ");
  };

  const argsLines = (tool: ToolCall): string[] => {
    const args = normalizeArgs(tool.args);
    const entries = Object.entries(args);
    if (entries.length === 0) return ["none"];

    const maxKey = Math.min(
      14,
      entries.reduce((max, [key]) => Math.max(max, key.length), 0),
    );

    const lines = entries
      .slice(0, maxExpandedArgLines())
      .map(([key, value]) => `${key.padEnd(maxKey)} : ${summarizeValue(value, 80)}`);

    if (entries.length > maxExpandedArgLines()) {
      lines.push(`... ${entries.length - maxExpandedArgLines()} more args`);
    }

    return lines;
  };

  const formatOrderBookLines = (record: Record<string, unknown>): string[] => {
    const lines: string[] = [];
    const bids = Array.isArray(record.bids) ? record.bids : [];
    const asks = Array.isArray(record.asks) ? record.asks : [];
    const levels = Math.max(bids.length, asks.length);

    if (levels === 0) {
      lines.push("orderbook empty");
      return lines;
    }

    lines.push("book top levels (bid | ask)");
    const maxRows = Math.min(props.compact ? 3 : 5, levels);

    for (let index = 0; index < maxRows; index += 1) {
      const bid = asRecord(bids[index]);
      const ask = asRecord(asks[index]);

      const bidPx = bid ? toNumber(bid.price) : null;
      const bidSz = bid ? toNumber(bid.size) : null;
      const askPx = ask ? toNumber(ask.price) : null;
      const askSz = ask ? toNumber(ask.size) : null;

      const bidLabel = bidPx !== null ? `${formatProbability(bidPx)} x ${bidSz?.toFixed(0) ?? "-"}` : "-";
      const askLabel = askPx !== null ? `${formatProbability(askPx)} x ${askSz?.toFixed(0) ?? "-"}` : "-";

      lines.push(`lvl${index + 1}  ${bidLabel.padEnd(20)} | ${askLabel}`);
    }

    if ("spread" in record) {
      lines.push(`spread=${summarizeValue(record.spread, 24)}`);
    }
    if ("bestBid" in record || "bestAsk" in record) {
      lines.push(
        `best=${summarizeValue(record.bestBid, 16)} / ${summarizeValue(record.bestAsk, 16)}`,
      );
    }

    return lines;
  };

  const formatListSampleLines = (record: Record<string, unknown>): string[] => {
    const key = ["markets", "events", "series", "tags", "categories", "positions", "orders", "trades"].find(
      (candidate) => Array.isArray(record[candidate]),
    );

    if (!key) return [];
    const list = record[key] as unknown[];
    const lines: string[] = [];

    lines.push(`${key}=${list.length}`);

    const maxRows = Math.min(props.compact ? 2 : 4, list.length);
    for (let index = 0; index < maxRows; index += 1) {
      const entry = list[index];
      const entryRecord = asRecord(entry);
      if (!entryRecord) {
        lines.push(`item${index + 1}=${summarizeValue(entry, 72)}`);
        continue;
      }

      const title = entryRecord.title ?? entryRecord.name ?? entryRecord.id ?? `item${index + 1}`;
      const price = toNumber(entryRecord.price);
      const change = toNumber(entryRecord.change24h);
      const volume = toNumber(entryRecord.volume24h ?? entryRecord.volume);

      const extraParts: string[] = [];
      if (price !== null) extraParts.push(`p=${formatProbability(price)}`);
      if (change !== null) extraParts.push(`chg=${change >= 0 ? "+" : ""}${change.toFixed(2)}%`);
      if (volume !== null) extraParts.push(`vol=${formatMoney(volume)}`);

      const suffix = extraParts.length > 0 ? ` ${extraParts.join(" ")}` : "";
      lines.push(`${summarizeValue(title, 48)}${suffix}`);
    }

    if (list.length > maxRows) {
      lines.push(`... ${list.length - maxRows} more ${key}`);
    }

    return lines;
  };

  const resultLines = (tool: ToolCall): string[] => {
    if (tool.status === "calling") return ["calling..."];
    if (tool.error) return [`error=${tool.error}`];
    if (!tool.result) return ["no result"];

    const payload = getPayload(tool.result);
    const category = getToolCategory(tool);

    if (typeof payload !== "object" || payload === null) {
      return [summarizeValue(payload, 96)];
    }

    const record = payload as Record<string, unknown>;

    if (tool.name === "get_order_book" || "bids" in record || "asks" in record) {
      return formatOrderBookLines(record);
    }

    if (category === "market") {
      if ("price" in record || "bid" in record || "ask" in record) {
        const price = toNumber(record.price);
        const bid = toNumber(record.bid);
        const ask = toNumber(record.ask);

        return [
          `price=${price !== null ? formatProbability(price) : summarizeValue(record.price, 16)}  bid=${bid !== null ? formatProbability(bid) : summarizeValue(record.bid, 16)}  ask=${ask !== null ? formatProbability(ask) : summarizeValue(record.ask, 16)}`,
          `spread=${summarizeValue(record.spread, 16)}`,
        ];
      }
      if ("bestBid" in record || "bestAsk" in record) {
        return [
          `bestBid=${summarizeValue(record.bestBid, 16)}  bestAsk=${summarizeValue(record.bestAsk, 16)}`,
          `spread=${summarizeValue(record.spread, 16)}`,
        ];
      }
      if ("count" in record) {
        return [
          `markets=${summarizeValue(record.count, 16)} returned=${summarizeValue(record.returned, 16)}`,
          ...formatListSampleLines(record),
        ];
      }

      const samples = formatListSampleLines(record);
      if (samples.length > 0) return samples;
    }

    if (category === "portfolio") {
      if ("balance" in record) {
        const balance = toNumber(record.balance);
        return [`balance=${balance !== null ? formatMoney(balance) : summarizeValue(record.balance, 18)}  wallet=${summarizeValue(record.address, 24)}`];
      }
      if ("positionsCount" in record || "totalPnL" in record) {
        const totalPnl = toNumber(record.totalPnL);
        const totalPnlLabel = totalPnl !== null
          ? `${totalPnl >= 0 ? "+" : ""}${formatMoney(totalPnl)}`
          : summarizeValue(record.totalPnL, 18);

        return [
          `positions=${summarizeValue(record.positionsCount ?? record.count, 12)}  totalPnl=${totalPnlLabel}`,
          `value=${summarizeValue(record.totalValue ?? record.summary, 28)}`,
          ...formatListSampleLines(record),
        ];
      }
      if ("count" in record) {
        return [`count=${summarizeValue(record.count, 16)}`, ...formatListSampleLines(record)];
      }

      const samples = formatListSampleLines(record);
      if (samples.length > 0) return samples;
    }

    if (category === "order") {
      if ("order" in record && typeof record.order === "object" && record.order !== null) {
        const order = record.order as Record<string, unknown>;
        return [
          `id=${summarizeValue(order.orderId, 20)}  side=${summarizeValue(order.side, 8)}  status=${summarizeValue(order.status, 12)}`,
          `price=${summarizeValue(order.price, 16)}  shares=${summarizeValue(order.shares, 16)}  total=${summarizeValue(order.totalCost, 16)}`,
        ];
      }
      if ("message" in record) {
        return [summarizeValue(record.message, 96)];
      }
    }

    if (category === "discovery") {
      const count = "count" in record ? summarizeValue(record.count, 16) : "n/a";
      const samples = formatListSampleLines(record);
      return samples.length > 0 ? [`count=${count}`, ...samples] : [`count=${count}`];
    }

    if (category === "navigation" || category === "ui") {
      if ("message" in record) return [summarizeValue(record.message, 96)];
    }

    if ("error" in record) {
      return [`error=${summarizeValue(record.error, 96)}`];
    }

    return Object.entries(record)
      .slice(0, 4)
      .map(([key, value]) => `${key}=${summarizeValue(value, 72)}`);
  };

  return (
    <box flexDirection="column" width="100%">
      <Show when={props.title}>
        <box flexDirection="row" paddingTop={1} paddingBottom={0} paddingLeft={1}>
          <text content={`─── ${props.title} ───`} fg={theme.textMuted} />
        </box>
      </Show>
      <For each={props.tools}>
        {(tool, idx) => {
          const toolId = tool.id ?? `${tool.name}-${idx()}`;
          const category = getToolCategory(tool).toUpperCase();
          const details = resultLines(tool);
          const maxLines = maxExpandedResultLines();
          const isSelected = () => props.selectedId === toolId;
          const isExpanded = () => {
            if (props.expandedIds) return props.expandedIds.includes(toolId);
            return !collapseByDefault();
          };

          return (
            <>
              <box height={1} width="100%" backgroundColor={theme.borderSubtle} />
              <box
                flexDirection="column"
                width="100%"
                backgroundColor={isSelected() ? theme.highlight : undefined}
                onMouseDown={() => props.onSelect?.(toolId)}
              >
                <box flexDirection="row" width="100%" paddingLeft={1} paddingRight={1}>
                  <text content={getStatusToken(tool.status)} fg={getStatusColor(tool.status)} />
                  <text content={` ${tool.name}`} fg={getStatusColor(tool.status)} />
                  <text content={` [${category}]`} fg={theme.textMuted} />
                  <box flexGrow={1} />
                  <text content={getStatusLabel(tool.status)} fg={getStatusColor(tool.status)} />
                  <Show when={getToolDuration(tool)}>
                    <text content={` ${getToolDuration(tool)}`} fg={theme.textMuted} />
                  </Show>
                  <Show when={props.onToggleExpand}>
                    <text
                      content={isExpanded() ? " [-]" : " [+]"}
                      fg={theme.textMuted}
                      onMouseDown={() => props.onToggleExpand?.(toolId)}
                    />
                  </Show>
                </box>

                <box flexDirection="row" width="100%" paddingLeft={2} paddingRight={1}>
                  <text content="A: " fg={theme.textMuted} />
                  <text content={summarizeArgs(tool.args)} fg={theme.textMuted} />
                </box>

                <Show
                  when={isExpanded()}
                  fallback={
                    <box flexDirection="column" width="100%" paddingLeft={2} paddingRight={1}>
                      <For each={details.slice(0, maxCollapsedLines())}>
                        {(line) => (
                          <box flexDirection="row" width="100%">
                            <text content="R: " fg={theme.textMuted} />
                            <text content={line} fg={theme.text} />
                          </box>
                        )}
                      </For>
                    </box>
                  }
                >
                  <box flexDirection="column" width="100%" paddingLeft={2} paddingRight={1}>
                    <box flexDirection="row" width="100%">
                      <text content="A: " fg={theme.textMuted} />
                      <text content="ARGS" fg={theme.textMuted} />
                    </box>
                    <For each={argsLines(tool)}>
                      {(line) => (
                        <box flexDirection="row" width="100%">
                          <text content="A: " fg={theme.textMuted} />
                          <text content={line} fg={theme.textMuted} />
                        </box>
                      )}
                    </For>

                    <box flexDirection="row" width="100%" paddingTop={0}>
                      <text content="R: " fg={theme.textMuted} />
                      <text content="RESULT" fg={theme.textMuted} />
                    </box>

                    <For each={details.slice(0, maxLines)}>
                      {(line) => (
                        <box flexDirection="row" width="100%">
                          <text content="R: " fg={theme.textMuted} />
                          <text content={line} fg={theme.text} />
                        </box>
                      )}
                    </For>
                    <Show when={details.length > maxLines}>
                      <text content={`R: ... ${details.length - maxLines} more lines`} fg={theme.textMuted} />
                    </Show>
                  </box>
                </Show>
              </box>
            </>
          );
        }}
      </For>
    </box>
  );
}

interface ChatMessageItemProps {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export function ChatMessageItem(props: ChatMessageItemProps) {
  const { theme } = useTheme();

  function wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split("\n");
    for (const para of paragraphs) {
      if (para.length === 0) { lines.push(""); continue; }
      const words = para.split(" ");
      let current = "";
      for (const word of words) {
        if ((current + (current ? " " : "") + word).length <= maxWidth) {
          current = current ? current + " " + word : word;
        } else {
          if (current) lines.push(current);
          let w = word;
          while (w.length > maxWidth) {
            lines.push(w.slice(0, maxWidth));
            w = w.slice(maxWidth);
          }
          current = w;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }

  const isUser = () => props.role === "user";
  const lines = () => wrapText(props.content, 70);
  
  const fmtTime = (d: Date): string => {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <box width="100%" flexDirection="column" paddingTop={1} paddingBottom={1}>
      <box flexDirection="row" paddingLeft={1}>
        <text content={isUser() ? "▶ You" : "◈ Agent"} fg={isUser() ? theme.accent : theme.primary} />
        <text content=" | " fg={theme.textMuted} />
        <text content={fmtTime(props.timestamp)} fg={theme.textMuted} />
      </box>
      <box flexDirection="column" paddingLeft={2} paddingRight={1}>
        <For each={lines()}>
          {(line) => <text content={line} fg={theme.text} />}
        </For>
      </box>
      <Show when={props.toolCalls && props.toolCalls.length > 0}>
        <box paddingLeft={2} paddingTop={1}>
          <ToolCallList tools={props.toolCalls ?? []} collapseByDefault />
        </box>
      </Show>
    </box>
  );
}
