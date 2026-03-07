/**
 * EnterpriseChat - full-screen AI agent overlay.
 * Integrated stream timeline + live tool call cards.
 */

import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useTheme } from "../context/theme";
import {
  PanelHeader,
  SectionTitle,
  DataRow,
  Separator,
  LoadingState,
  PriceChange,
  PriceDisplay,
  ToolCallList,
  ChatMessageItem,
} from "./ui/panel-components";
import {
  assistantGuardReason,
  assistantMode,
  chatMessages,
  chatLoading,
  chatInputValue,
  setChatInputValue,
  chatInputFocused,
  streamingMessage,
  streamingTools,
  currentSessionId,
  sessionTokens,
  appState,
  walletState,
  getTradingBalance,
  enterpriseRunPhase,
  enterpriseToolSelectedId,
  setEnterpriseToolSelectedId,
  enterpriseToolExpandedIds,
  toggleEnterpriseToolExpanded,
  pendingApproval,
  ToolCall,
} from "../state";
import { getSelectedMarket, getActiveAIProvider } from "../state";
import { Market } from "../types/market";
import { positionsState } from "../hooks/usePositions";
import { calculatePortfolioSummary } from "../api/positions";
import { getTool as getAgentTool } from "../agent/tools";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 3))}...`;
}

function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const safeWidth = Math.max(16, maxWidth);
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(" ");
    let current = "";

    for (const word of words) {
      if ((current + (current ? " " : "") + word).length <= safeWidth) {
        current = current ? `${current} ${word}` : word;
      } else {
        if (current) lines.push(current);
        let pending = word;
        while (pending.length > safeWidth) {
          lines.push(pending.slice(0, safeWidth));
          pending = pending.slice(safeWidth);
        }
        current = pending;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

function makeRule(title: string, width: number): string {
  const cleanTitle = title.trim();
  if (!cleanTitle) return "-".repeat(Math.max(4, width));

  const body = ` ${cleanTitle} `;
  const safeWidth = Math.max(body.length + 2, width);
  const dashCount = safeWidth - body.length;
  const left = Math.floor(dashCount / 2);
  const right = dashCount - left;

  return `${"-".repeat(left)}${body}${"-".repeat(right)}`;
}

function toolCategoryFromName(name: string): string {
  return getAgentTool(name)?.category ?? "unknown";
}

function statusFromToolResult(result: unknown): "done" | "error" {
  if (typeof result !== "object" || result === null || Array.isArray(result)) return "done";
  const record = result as Record<string, unknown>;
  if ("success" in record && record.success === false) return "error";
  if ("error" in record && record.error) return "error";
  return "done";
}

export function EnterpriseChat() {
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

  const showInspector = createMemo(() => columns() >= 120);
  const streamWrapWidth = createMemo(() => (showInspector() ? 72 : Math.max(38, columns() - 12)));
  const introRuleWidth = createMemo(() => {
    if (showInspector()) return 56;
    if (columns() >= 100) return 46;
    return 38;
  });

  const provider = createMemo(() => getActiveAIProvider());
  const resolvedModel = createMemo(() => {
    const activeProvider = provider();
    return activeProvider ? `${activeProvider.model}` : "no provider";
  });

  const sessionLabel = createMemo(() => {
    const id = currentSessionId();
    return id ? id.slice(0, 14) : "new-session";
  });

  const tokenLabel = createMemo(() => {
    const total = sessionTokens();
    return total >= 1000 ? `${(total / 1000).toFixed(1)}k tok` : `${total} tok`;
  });

  const providerLabel = createMemo(() => provider()?.name ?? "none");

  const providerKindLabel = createMemo(() => provider()?.kind.toUpperCase() ?? "none");

  const phaseLabel = createMemo(() => enterpriseRunPhase().toUpperCase());
  const assistantModeLabel = createMemo(() => assistantMode().toUpperCase());
  const liveApproval = createMemo(() => pendingApproval());

  const phaseColor = createMemo(() => {
    const phase = enterpriseRunPhase();
    if (phase === "tool_error") return theme.error;
    if (phase === "awaiting_approval") return theme.accent;
    if (phase === "tool_calling" || phase === "finalizing") return theme.warning;
    if (phase === "streaming_text") return theme.primary;
    return theme.textMuted;
  });

  const effortLabel = createMemo(() => {
    const phase = enterpriseRunPhase();
    if (phase === "tool_calling" || phase === "finalizing") return "xhigh";
    if (phase === "streaming_text") return "high";
    return "standard";
  });

  const promptMode = createMemo(() => {
    const value = chatInputValue().trim();
    if (value.startsWith("/")) return "COMMAND";
    return "PLAN";
  });

  const promptProfile = createMemo(() => {
    const cols = columns();
    if (cols >= 130) return "wide" as const;
    if (cols >= 100) return "medium" as const;
    return "narrow" as const;
  });

  const promptHeight = createMemo(() => (promptProfile() === "narrow" ? 4 : 5));

  const showMetaRow = createMemo(() => promptProfile() !== "narrow");

  const isNarrow = createMemo(() => promptProfile() === "narrow");

  const promptWidthBudget = createMemo(() => {
    const cols = columns();
    if (showInspector()) return Math.max(42, Math.floor(cols * 0.65) - 8);
    return Math.max(42, cols - 8);
  });

  const modelLabel = createMemo(() => {
    if (promptProfile() === "wide") return truncate(resolvedModel(), 34);
    if (promptProfile() === "medium") return truncate(resolvedModel(), 24);
    return truncate(resolvedModel(), 16);
  });

  const headerSubtitle = createMemo(() => {
    if (promptProfile() === "wide") {
      return `${assistantModeLabel()} | ${resolvedModel()} | ${sessionLabel()} | ${tokenLabel()} | ${phaseLabel()}`;
    }
    if (promptProfile() === "medium") {
      return `${assistantModeLabel()} | ${modelLabel()} | ${tokenLabel()} | ${phaseLabel()}`;
    }
    return `${assistantModeLabel()} | ${phaseLabel()} | ${tokenLabel()}`;
  });

  const selectedMarket = createMemo(() => getSelectedMarket());

  const lastAssistantToolCalls = createMemo(() => {
    const messages = chatMessages();
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const entry = messages[index];
      if (entry.role === "assistant" && entry.toolCalls?.length) {
        return entry.toolCalls;
      }
    }
    return [] as ToolCall[];
  });

  const liveToolCalls = createMemo(() =>
    streamingTools().map((tool) => ({
      ...tool,
      category: tool.category ?? toolCategoryFromName(tool.name),
    })),
  );

  const historicalToolCalls = createMemo(() =>
    lastAssistantToolCalls().map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.name,
      args: toolCall.arguments,
      result: toolCall.result,
      status: statusFromToolResult(toolCall.result),
      category: toolCall.category ?? toolCategoryFromName(toolCall.name),
    })),
  );

  const selectedToolId = createMemo(() => {
    const selected = enterpriseToolSelectedId();
    if (selected) return selected;
    return liveToolCalls()[0]?.id ?? historicalToolCalls()[0]?.id ?? "";
  });

  const inputHints = createMemo(() => {
    if (liveApproval()) {
      if (promptProfile() === "narrow") return "[Y] approve [N] reject";
      return "[Y] approve [N] reject [I/Enter] focus [Esc] close";
    }

    if (chatInputFocused()) {
      if (promptProfile() === "narrow") return "[Enter] send [Esc] blur";
      if (!chatInputValue()) return "[Enter] send [Up/Down] history(empty) [Ctrl+U] line [Ctrl+L] chat [Esc] blur";
      return "[Enter] send [Ctrl+U] line [Ctrl+L] chat [Esc] blur";
    }

    if (showInspector()) {
      if (promptProfile() === "medium") return "[I/Enter] focus [Up/Down] tools [Esc] close";
      return "[I/Enter] focus [Up/Down] tools [Space] expand [Esc] close";
    }

    return "[I/Enter] focus [Esc] close";
  });

  const hintLabel = createMemo(() => {
    const maxLen = promptProfile() === "wide" ? 86 : promptProfile() === "medium" ? 62 : 28;
    return truncate(inputHints(), maxLen);
  });

  const promptSupportLine = createMemo(() => {
    const value = chatInputValue();
    if (liveApproval()) {
      return "Pending approval - review the action card and press Y to execute or N to reject";
    }
    if (isNarrow()) {
      if (value.startsWith("/")) return "Command mode";
      if (chatLoading()) return "Assistant running";
      if (!value.trim()) return "Press I or Enter to type";
      return `${value.length} chars in prompt`;
    }

    if (value.startsWith("/")) return "Slash command mode - Enter to execute";
    if (chatLoading()) return "Assistant run in progress";
    if (!value.trim()) return "Type your request or /help for commands";
    return `${value.length} chars in prompt`;
  });

  const promptSupportMaxChars = createMemo(() => {
    if (isNarrow()) return Math.max(18, promptWidthBudget() - 16);
    const reserve = promptProfile() === "wide" ? 28 : 22;
    return Math.max(20, promptWidthBudget() - reserve);
  });

  const inputStatus = createMemo(() => {
    if (chatLoading()) return "RUNNING";
    if (chatInputFocused()) return "FOCUSED";
    return "READY";
  });

  const inputStatusColor = createMemo(() => {
    const status = inputStatus();
    if (status === "RUNNING") return theme.warning;
    if (status === "FOCUSED") return theme.accent;
    return theme.success;
  });

  const inputStatusLabel = createMemo(() => {
    const status = inputStatus();
    if (!isNarrow()) return status;
    if (status === "RUNNING") return "RUN";
    if (status === "FOCUSED") return "FOC";
    return "RDY";
  });

  const promptModeColor = createMemo(() =>
    promptMode() === "COMMAND" ? theme.warning : theme.primary,
  );

  const promptPrefix = createMemo(() => (promptMode() === "COMMAND" ? "/" : ">"));

  const promptPrefixColor = createMemo(() =>
    promptMode() === "COMMAND" ? theme.warning : theme.accent,
  );

  const promptPlaceholder = createMemo(() =>
    promptMode() === "COMMAND"
      ? isNarrow()
        ? "/help /clear /sessions"
        : "type slash command..."
      : isNarrow()
        ? "type request..."
        : "ask for market analysis, portfolio or order flow...",
  );

  const toolQueueLabel = createMemo(() => {
    const count = liveToolCalls().length;
    if (chatLoading()) {
      return count > 0 ? `RUN ${count} TOOL${count > 1 ? "S" : ""}` : "RUN";
    }
    return count > 0 ? `${count} TOOL${count > 1 ? "S" : ""} READY` : "IDLE";
  });

  const toolQueueColor = createMemo(() => {
    const count = liveToolCalls().length;
    if (chatLoading()) return theme.warning;
    if (count > 0) return theme.accent;
    return theme.textMuted;
  });

  const phaseShortLabel = createMemo(() => {
    const phase = enterpriseRunPhase();
    if (phase === "streaming_text") return "STRM";
    if (phase === "tool_calling") return "TOOL";
    if (phase === "tool_done") return "DONE";
    if (phase === "tool_error") return "ERR";
    if (phase === "awaiting_approval") return "WAIT";
    if (phase === "finalizing") return "FIN";
    return "IDLE";
  });

  const streamTitleLabel = createMemo(() => (isNarrow() ? "STRM" : "STREAM"));

  const toolQueueCompactLabel = createMemo(() => {
    const count = liveToolCalls().length;
    if (chatLoading()) return count > 0 ? `RUN/${count}T` : "RUN";
    return count > 0 ? `${count}T` : "IDLE";
  });

  const streamHeaderLeft = createMemo(() => {
    const tools = liveToolCalls().length;
    if (promptProfile() === "narrow") {
      return `p=${phaseShortLabel()} t=${tools}`;
    }
    if (promptProfile() === "medium") {
      return `phase=${phaseLabel()} | tools=${tools}${liveApproval() ? " | approval" : chatLoading() ? " | running" : ""}`;
    }
    return `phase=${phaseLabel()} | tools=${tools}${liveApproval() ? " | awaiting_approval" : chatLoading() ? " | status=running" : ""}`;
  });

  const metaPrimaryLabel = createMemo(() => {
    const parts = [`PROMPT:${promptMode()}`, `AST:${assistantModeLabel()}`, `MODEL:${modelLabel()}`];

    if (promptProfile() === "wide") {
      parts.push(`PROVIDER:${providerLabel()}`);
      parts.push(`KIND:${providerKindLabel()}`);
    }

    parts.push(`EFFORT:${effortLabel()}`);
    const joined = parts.join("  ");
    const maxLen = promptProfile() === "wide" ? Math.max(26, promptWidthBudget() - 26) : Math.max(26, promptWidthBudget() - 20);
    return truncate(joined, maxLen);
  });

  const metaRightLabel = createMemo(() => {
    if (promptProfile() === "wide") return `TOK:${tokenLabel()} SID:${sessionLabel()}`;
    return `TOK:${tokenLabel()}`;
  });

  const streamActive = createMemo(() => Boolean(streamingMessage() || liveToolCalls().length > 0));

  const lastUserMessageId = createMemo(() => {
    const items = chatMessages();
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i]?.role === "user") {
        return items[i]?.id ?? "";
      }
    }
    return "";
  });

  const renderApprovalBlock = () => (
    <Show when={liveApproval()}>
      {(() => {
        const approval = liveApproval();
        if (!approval) return null;
        return (
        <box width="100%" flexDirection="column" paddingTop={1} paddingBottom={1}>
          <box flexDirection="row" width="100%" paddingLeft={1} paddingRight={1}>
            <text content="APPROVAL" fg={theme.accent} />
            <text content=" | " fg={theme.textMuted} />
            <text content={approval.title.toUpperCase()} fg={theme.warning} />
            <box flexGrow={1} />
            <text content={approval.riskLevel.toUpperCase()} fg={approval.riskLevel === "critical" ? theme.error : theme.warning} />
          </box>
          <box height={1} width="100%" backgroundColor={theme.borderSubtle} />
          <box flexDirection="column" paddingLeft={2} paddingRight={1}>
            <For each={wrapText(approval.summary, streamWrapWidth())}>
              {(line) => <text content={line} fg={theme.text} />}
            </For>
            <Show when={assistantGuardReason()}>
              <text content={`Guard: ${assistantGuardReason()}`} fg={theme.warning} />
            </Show>
            <Show when={approval.warnings.length > 0}>
              <box flexDirection="column" paddingTop={1}>
                <For each={approval.warnings.slice(0, 4)}>
                  {(warning) => <text content={`- ${truncate(warning, streamWrapWidth())}`} fg={theme.warning} />}
                </For>
              </box>
            </Show>
            <text content={`Press Y to approve or N to reject before ${new Date(approval.expiresAt).toLocaleTimeString()}.`} fg={theme.textMuted} />
          </box>
        </box>
        );
      })()}
    </Show>
  );

  const renderLiveStreamBlock = () => (
    <box width="100%" flexDirection="column" paddingTop={1} paddingBottom={1}>
      <box flexDirection="row" width="100%" paddingLeft={1} paddingRight={1}>
        <text content={streamTitleLabel()} fg={theme.accent} />
        <text content=" | " fg={theme.textMuted} />
        <text content={streamHeaderLeft()} fg={phaseColor()} />
        <box flexGrow={1} />
        <Show when={promptProfile() !== "narrow"}>
          <text content={`model=${modelLabel()}`} fg={theme.textMuted} />
        </Show>
      </box>
      <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

      <Show when={streamingMessage()}>
        <box flexDirection="column" paddingLeft={2} paddingRight={1}>
          <For each={wrapText(streamingMessage(), streamWrapWidth())}>
            {(line) => <text content={line} fg={theme.text} />}
          </For>
          <text content="_" fg={theme.primary} />
        </box>
      </Show>

      <Show when={!streamingMessage() && chatLoading()}>
        <box flexDirection="row" paddingLeft={2}>
          <text content="processing tool output..." fg={theme.textMuted} />
        </box>
      </Show>

      <Show when={liveToolCalls().length > 0}>
        <box paddingLeft={1} paddingRight={1} paddingTop={1}>
          <ToolCallList
            tools={liveToolCalls()}
            title="Live Tool Calls"
            selectedId={selectedToolId()}
            expandedIds={enterpriseToolExpandedIds()}
            collapseByDefault
            compact={!showInspector()}
            onSelect={(id) => setEnterpriseToolSelectedId(id)}
            onToggleExpand={(id) => toggleEnterpriseToolExpanded(id)}
          />
        </box>
      </Show>
    </box>
  );

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      backgroundColor={theme.background}
      zIndex={200}
      flexDirection="column"
    >
      <PanelHeader
        title="POLYMARKET AGENT"
        icon="|"
        subtitle={headerSubtitle()}
      />

      <Separator />

      <box flexGrow={1} width="100%" flexDirection="row">
        <box width={showInspector() ? "65%" : "100%"} flexDirection="column">
          <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="bottom">
            <box width="100%" flexDirection="column">
              <Show when={chatMessages().length === 0 && !chatLoading() && !streamingMessage()}>
                <box flexDirection="column" paddingLeft={2} paddingTop={2}>
                  <text content={makeRule("POLYMARKET AI AGENT", introRuleWidth())} fg={theme.borderSubtle} />
                  <text content="" />
                  <text content={truncate("  * Intelligent assistant for Polymarket prediction markets", introRuleWidth())} fg={theme.primary} />
                  <text content="" />
                  <text content={makeRule("SLASH COMMANDS", introRuleWidth())} fg={theme.borderSubtle} />
                  <text content="  /help       list all available commands" fg={theme.textMuted} />
                  <text content="  /clear      start a fresh session" fg={theme.textMuted} />
                  <text content="  /sessions   browse conversation history" fg={theme.textMuted} />
                  <text content="" />
                  <text content={makeRule("EXAMPLE QUERIES", introRuleWidth())} fg={theme.borderSubtle} />
                  <text content={truncate("  What are the trending markets right now?", introRuleWidth())} fg={theme.accent} />
                  <text content={truncate("  Analyze the selected market and suggest a trade", introRuleWidth())} fg={theme.accent} />
                  <Show when={!isNarrow()}>
                    <>
                      <text content="  Show my portfolio P&L and top positions" fg={theme.accent} />
                      <text content="  Compare sports vs crypto market volumes" fg={theme.accent} />
                    </>
                  </Show>
                  <text content="" />
                  <text content={truncate("  Press [I] or [Enter] to focus the input below.", introRuleWidth())} fg={theme.textMuted} />
                </box>
              </Show>

              {renderApprovalBlock()}

              <For each={chatMessages()}>
                {(message) => (
                  <>
                    <ChatMessageItem
                      role={message.role}
                      content={message.content}
                      timestamp={message.timestamp}
                      toolCalls={(message.toolCalls ?? []).map((toolCall) => ({
                        id: toolCall.id,
                        name: toolCall.name,
                        args: toolCall.arguments,
                        result: toolCall.result,
                        status: statusFromToolResult(toolCall.result),
                        category: toolCall.category ?? toolCategoryFromName(toolCall.name),
                      }))}
                    />

                    <Show when={streamActive() && message.id === lastUserMessageId()}>
                      {renderLiveStreamBlock()}
                    </Show>
                  </>
                )}
              </For>

              <Show when={streamActive() && !lastUserMessageId()}>
                {renderLiveStreamBlock()}
              </Show>

              <Show when={chatLoading() && !streamingMessage() && liveToolCalls().length === 0}>
                <LoadingState message="Thinking..." />
              </Show>
            </box>
          </scrollbox>
        </box>

        <Show when={showInspector()}>
          <>
            <box width={1} backgroundColor={theme.border} />

            <box flexGrow={1} flexDirection="column">
              <SectionTitle title="Tool Inspector" icon="|" />

              <scrollbox height={15} width="100%">
                <box width="100%" flexDirection="column" paddingTop={1}>
                  <Show when={liveToolCalls().length === 0 && historicalToolCalls().length === 0}>
                    <box paddingLeft={2}>
                      <text content="No tools called yet" fg={theme.textMuted} />
                    </box>
                  </Show>

                  <Show when={liveToolCalls().length > 0}>
                    <ToolCallList
                      tools={liveToolCalls()}
                      selectedId={selectedToolId()}
                      expandedIds={enterpriseToolExpandedIds()}
                      collapseByDefault
                      compact
                      onSelect={(id) => setEnterpriseToolSelectedId(id)}
                      onToggleExpand={(id) => toggleEnterpriseToolExpanded(id)}
                    />
                  </Show>

                  <Show when={liveToolCalls().length === 0 && historicalToolCalls().length > 0}>
                    <ToolCallList
                      tools={historicalToolCalls()}
                      title="Last Assistant Tools"
                      selectedId={selectedToolId()}
                      expandedIds={enterpriseToolExpandedIds()}
                      collapseByDefault
                      compact
                      onSelect={(id) => setEnterpriseToolSelectedId(id)}
                      onToggleExpand={(id) => toggleEnterpriseToolExpanded(id)}
                    />
                  </Show>
                </box>
              </scrollbox>

              <Separator />

              <SectionTitle title="Context" icon="|" />

              <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingTop={1}>
                <Show
                  when={selectedMarket()}
                  fallback={<text content="No market selected" fg={theme.textMuted} />}
                >
                  {(market: () => Market) => (
                    <>
                      <DataRow label="Market" value={truncate(market().title, 32)} valueColor="text" />
                      <box flexDirection="row" paddingLeft={1}>
                        <text content="Price:  " fg={theme.textMuted} />
                        <PriceDisplay price={market().outcomes[0]?.price || 0} showCents />
                        <box paddingLeft={1}>
                          <PriceChange value={market().change24h} showSign />
                        </box>
                      </box>
                      <DataRow label="Volume" value={`$${(market().volume24h / 1000).toFixed(1)}K`} valueColor="muted" />
                      <DataRow label="Liquidity" value={`$${(market().liquidity / 1000).toFixed(1)}K`} valueColor="muted" />
                    </>
                  )}
                </Show>

                <Separator type="light" />
                <box height={1} />

                <box flexDirection="row">
                  <text content="Wallet: " fg={theme.textMuted} />
                  <Show
                    when={walletState.connected}
                    fallback={<text content="not connected" fg={theme.error} />}
                  >
                    <text
                      content={walletState.address ? `${walletState.address.slice(0, 8)}...${walletState.address.slice(-4)}` : "connected"}
                      fg={theme.success}
                    />
                  </Show>
                </box>

                <Show when={walletState.connected}>
                  <DataRow
                    label="Balance"
                    value={`$${getTradingBalance().toFixed(2)}`}
                    valueColor="success"
                  />
                </Show>

                <box height={1} />

                <DataRow label="Assistant" value={assistantModeLabel()} valueColor="text" />
                <Show when={assistantGuardReason()}>
                  <text content={truncate(`Guard: ${assistantGuardReason()}`, 40)} fg={theme.warning} />
                </Show>

                <box height={1} />

                <DataRow
                  label="Markets"
                  value={`${appState.markets.length} loaded`}
                  valueColor="muted"
                />

                <Show when={positionsState.positions.length > 0}>
                  <Separator type="light" />
                  <text content="--- PORTFOLIO ---" fg={theme.borderSubtle} />
                  {(() => {
                    const portfolioSummary = calculatePortfolioSummary(positionsState.positions);
                    const topPosition = [...positionsState.positions].sort((a, b) => Math.abs(b.cashPnl) - Math.abs(a.cashPnl))[0] ?? null;
                    return (
                      <>
                        <DataRow label="Value" value={`$${portfolioSummary.totalValue.toFixed(2)}`} />
                        <box flexDirection="row" gap={1}>
                          <text content="P&L: " fg={theme.textMuted} />
                          <text
                            content={`${portfolioSummary.totalCashPnl >= 0 ? "+" : ""}$${portfolioSummary.totalCashPnl.toFixed(2)}`}
                            fg={portfolioSummary.totalCashPnl >= 0 ? theme.success : theme.error}
                          />
                        </box>
                        <DataRow label="Positions" value={`${portfolioSummary.positionCount}`} valueColor="muted" />
                        <Show when={topPosition !== null}>
                          <box flexDirection="row" gap={1}>
                            <text content="Top: " fg={theme.textMuted} />
                            <text content={topPosition!.title.slice(0, 16)} fg={theme.text} />
                            <text
                              content={`${topPosition!.cashPnl >= 0 ? "+" : ""}$${topPosition!.cashPnl.toFixed(2)}`}
                              fg={topPosition!.cashPnl >= 0 ? theme.success : theme.error}
                            />
                          </box>
                        </Show>
                      </>
                    );
                  })()}
                </Show>
              </box>
            </box>
          </>
        </Show>
      </box>

      <box height={promptHeight()} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="column">
        <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

        <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
          <box width={1} backgroundColor={theme.accent} />
          <box flexGrow={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
            <text content="PROMPT" fg={theme.accent} />
            <text content=" " />
            <text content={promptMode()} fg={promptModeColor()} />
            <box flexGrow={1} />
            <text content={hintLabel()} fg={theme.textMuted} />
          </box>
        </box>

        <box
          flexDirection="row"
          width="100%"
          backgroundColor={chatInputFocused() ? theme.background : theme.backgroundPanel}
        >
          <box width={1} backgroundColor={theme.accent} />
          <box flexGrow={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
            <text content={chatInputFocused() ? promptPrefix() : "|"} fg={chatInputFocused() ? promptPrefixColor() : theme.accent} />
            <text content=" " />
            <input
              flexGrow={1}
              value={chatInputValue()}
              onInput={setChatInputValue}
              placeholder={promptPlaceholder()}
              focused={chatInputFocused()}
            />
            <text content={` ${inputStatusLabel()}`} fg={inputStatusColor()} />
          </box>
        </box>

        <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
          <box width={1} backgroundColor={theme.accent} />
          <box flexGrow={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
            <text content={truncate(promptSupportLine(), promptSupportMaxChars())} fg={theme.textMuted} />
            <box flexGrow={1} />
            <Show
              when={!isNarrow()}
              fallback={
                <>
                  <text content={`${toolQueueCompactLabel()} `} fg={toolQueueColor()} />
                  <text content={phaseShortLabel()} fg={phaseColor()} />
                </>
              }
            >
              <text content={`${toolQueueLabel()} `} fg={toolQueueColor()} />
              <text content={`PHASE ${phaseLabel()}`} fg={phaseColor()} />
            </Show>
          </box>
        </box>

        <Show when={showMetaRow()}>
          <box flexDirection="row" width="100%" backgroundColor={theme.backgroundPanel}>
            <box width={1} backgroundColor={theme.accent} />
            <box flexGrow={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
              <text content={metaPrimaryLabel()} fg={theme.text} />
              <box flexGrow={1} />
              <text content={metaRightLabel()} fg={theme.textMuted} />
            </box>
          </box>
        </Show>
      </box>
    </box>
  );
}
