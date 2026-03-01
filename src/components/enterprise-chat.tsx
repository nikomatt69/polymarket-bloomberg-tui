/**
 * EnterpriseChat — full-screen OpenCode-style AI agent overlay.
 * Activated by Enter globally, closed by double-Escape.
 * Left pane: message history + streaming.
 * Right pane: live tool inspector + context.
 * Bottom: input bar with history hints.
 */

import { For, Show, createMemo } from "solid-js";
import { useTheme } from "../context/theme";
import {
  chatMessages,
  chatLoading,
  chatInputValue,
  chatInputFocused,
  streamingMessage,
  streamingTools,
  currentSessionId,
  sessionTokens,
  appState,
  walletState,
} from "../state";
import { getSelectedMarket, getActiveAIProvider } from "../state";
import { ChatMessage, ToolCall } from "../state";
import { Market } from "../types/market";

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push("");
      continue;
    }
    const words = para.split(" ");
    let current = "";
    for (const word of words) {
      if ((current + (current ? " " : "") + word).length <= maxWidth) {
        current = current ? current + " " + word : word;
      } else {
        if (current) lines.push(current);
        // long word: split at maxWidth
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

function ToolIcon(props: { status: "calling" | "done" | "error" }) {
  const { theme } = useTheme();
  return (
    <Show
      when={props.status === "done"}
      fallback={
        <Show
          when={props.status === "error"}
          fallback={<text content="⟳ " fg={theme.accent} />}
        >
          <text content="✗ " fg={theme.error} />
        </Show>
      }
    >
      <text content="✓ " fg={theme.success} />
    </Show>
  );
}

function ToolEntry(props: { name: string; args: unknown; result?: unknown; status: "calling" | "done" | "error" }) {
  const { theme } = useTheme();
  const resultSummary = createMemo(() => {
    if (!props.result) return "";
    const r = props.result as Record<string, unknown>;
    if (typeof r === "object" && r !== null) {
      if ("count" in r) return `→ ${r.count} results`;
      if ("balance" in r) return `→ $${r.balance}`;
      if ("message" in r) return `→ ${truncate(String(r.message), 30)}`;
      if ("error" in r) return `→ ${truncate(String(r.error), 30)}`;
    }
    return `→ ${truncate(JSON.stringify(props.result), 32)}`;
  });

  return (
    <box flexDirection="row" width="100%" paddingLeft={1}>
      <ToolIcon status={props.status} />
      <text
        content={props.name}
        fg={props.status === "calling" ? theme.accent : props.status === "error" ? theme.error : theme.success}
      />
      <Show when={props.status !== "calling" && resultSummary()}>
        <text content={` ${resultSummary()}`} fg={theme.textMuted} />
      </Show>
      <Show when={props.status === "calling"}>
        <text content=" (calling…)" fg={theme.textMuted} />
      </Show>
    </box>
  );
}

function MessageBubble(props: { message: ChatMessage }) {
  const { theme } = useTheme();
  const isUser = () => props.message.role === "user";
  const lines = createMemo(() => wrapText(props.message.content, 70));

  return (
    <box width="100%" flexDirection="column" paddingTop={1} paddingBottom={1}>
      {/* Role + time header */}
      <box flexDirection="row" paddingLeft={1}>
        <text
          content={isUser() ? "👤 You" : "🤖 Agent"}
          fg={isUser() ? theme.accent : theme.primary}
        />
        <text content={`  ${fmtTime(props.message.timestamp)}`} fg={theme.textMuted} />
      </box>

      {/* Message content */}
      <box flexDirection="column" paddingLeft={2} paddingRight={1}>
        <For each={lines()}>
          {(line) => <text content={line} fg={isUser() ? theme.text : theme.text} />}
        </For>
      </box>

      {/* Tool call summary inline */}
      <Show when={props.message.toolCalls && props.message.toolCalls.length > 0}>
        <box flexDirection="column" paddingLeft={2} paddingTop={1}>
          <For each={props.message.toolCalls!}>
            {(tc: ToolCall) => (
              <box flexDirection="row">
                <text content="✓ " fg={theme.success} />
                <text content={tc.name} fg={theme.textMuted} />
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  );
}

export function EnterpriseChat() {
  const { theme } = useTheme();

  const provider = createMemo(() => getActiveAIProvider());
  const resolvedModel = createMemo(() => {
    const p = provider();
    return p ? `${p.model}` : "no provider";
  });
  const sessionLabel = createMemo(() => {
    const id = currentSessionId();
    return id ? id.slice(0, 14) : "new-session";
  });
  const tokLabel = createMemo(() => {
    const t = sessionTokens();
    return t >= 1000 ? `${(t / 1000).toFixed(1)}k tok` : `${t} tok`;
  });

  const selectedMarket = createMemo(() => getSelectedMarket());

  // Historical tool calls from last assistant message
  const lastAssistantToolCalls = createMemo(() => {
    const msgs = chatMessages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant" && msgs[i].toolCalls?.length) {
        return msgs[i].toolCalls!;
      }
    }
    return [] as ToolCall[];
  });

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
      {/* ── Header ─────────────────────────────────────────────── */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ POLYMARKET AGENT " fg={theme.highlightText} />
        <text content="│ " fg={theme.primaryMuted} />
        <text content={resolvedModel()} fg={theme.highlightText} />
        <text content=" │ " fg={theme.primaryMuted} />
        <text content={sessionLabel()} fg={theme.primaryMuted} />
        <text content=" │ " fg={theme.primaryMuted} />
        <text content={tokLabel()} fg={theme.primaryMuted} />
        <box flexGrow={1} />
        <text content=" [ESC] close " fg={theme.primaryMuted} />
      </box>

      {/* ── Separator ──────────────────────────────────────────── */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

      {/* ── Main two-pane area ─────────────────────────────────── */}
      <box flexGrow={1} width="100%" flexDirection="row">

        {/* Left pane — Messages (65%) */}
        <box width="65%" flexDirection="column">
          <scrollbox flexGrow={1} width="100%">
            <box width="100%" flexDirection="column">
              <Show when={chatMessages().length === 0 && !chatLoading() && !streamingMessage()}>
                <box flexDirection="column" paddingLeft={2} paddingTop={2}>
                  <text content="◈ POLYMARKET AI AGENT" fg={theme.primary} />
                  <text content="" fg={theme.textMuted} />
                  <text content="Type a message to begin. Available commands:" fg={theme.textMuted} />
                  <text content="  /help    — show commands" fg={theme.textMuted} />
                  <text content="  /clear   — new session" fg={theme.textMuted} />
                  <text content="  /sessions — list history" fg={theme.textMuted} />
                  <text content="" fg={theme.textMuted} />
                  <text content="Example queries:" fg={theme.textMuted} />
                  <text content="  What are the trending markets right now?" fg={theme.textMuted} />
                  <text content="  Show me live sports markets" fg={theme.textMuted} />
                  <text content="  Analyze the current market and suggest a trade" fg={theme.textMuted} />
                </box>
              </Show>

              <For each={chatMessages()}>
                {(msg) => <MessageBubble message={msg} />}
              </For>

              {/* Streaming partial response */}
              <Show when={streamingMessage()}>
                <box width="100%" flexDirection="column" paddingTop={1} paddingBottom={1}>
                  <box flexDirection="row" paddingLeft={1}>
                    <text content="🤖 Agent" fg={theme.primary} />
                    <text content="  streaming…" fg={theme.textMuted} />
                  </box>
                  <box flexDirection="column" paddingLeft={2} paddingRight={1}>
                    <For each={wrapText(streamingMessage(), 70)}>
                      {(line) => <text content={line} fg={theme.text} />}
                    </For>
                    <text content="▋" fg={theme.primary} />
                  </box>
                </box>
              </Show>

              <Show when={chatLoading() && !streamingMessage()}>
                <box paddingLeft={2} paddingTop={1}>
                  <text content="🤔 Thinking…" fg={theme.textMuted} />
                </box>
              </Show>
            </box>
          </scrollbox>
        </box>

        {/* Vertical separator */}
        <box width={1} backgroundColor={theme.border} />

        {/* Right pane — Tool Inspector + Context (35%) */}
        <box flexGrow={1} flexDirection="column">

          {/* Tool Inspector header */}
          <box height={1} backgroundColor={theme.backgroundPanel} paddingLeft={1}>
            <text content="◈ TOOL INSPECTOR" fg={theme.accent} />
          </box>

          {/* Live streaming tools */}
          <scrollbox height={10} width="100%">
            <box width="100%" flexDirection="column" paddingTop={1}>
              <Show when={streamingTools().length === 0 && lastAssistantToolCalls().length === 0}>
                <box paddingLeft={2}>
                  <text content="No tools called yet" fg={theme.textMuted} />
                </box>
              </Show>

              {/* Live streaming tool calls */}
              <For each={streamingTools()}>
                {(t) => (
                  <ToolEntry
                    name={t.name}
                    args={t.args}
                    result={t.result}
                    status={t.status}
                  />
                )}
              </For>

              {/* Historical completed tool calls from last assistant message */}
              <Show when={streamingTools().length === 0}>
                <For each={lastAssistantToolCalls()}>
                  {(tc: ToolCall) => (
                    <ToolEntry
                      name={tc.name}
                      args={tc.arguments}
                      result={tc.result}
                      status="done"
                    />
                  )}
                </For>
              </Show>
            </box>
          </scrollbox>

          {/* Context separator */}
          <box height={1} backgroundColor={theme.borderSubtle} />

          {/* Context panel header */}
          <box height={1} backgroundColor={theme.backgroundPanel} paddingLeft={1}>
            <text content="◈ CONTEXT" fg={theme.accent} />
          </box>

          {/* Context data */}
          <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingTop={1}>
            <Show
              when={selectedMarket()}
              fallback={<text content="No market selected" fg={theme.textMuted} />}
            >
              {(market: () => Market) => (
                <>
                  <box flexDirection="row">
                    <text content="Market: " fg={theme.textMuted} />
                    <text content={truncate(market().title, 28)} fg={theme.text} />
                  </box>
                  <box flexDirection="row">
                    <text content="Price:  " fg={theme.textMuted} />
                    <text
                      content={`${market().outcomes[0]?.price.toFixed(2) ?? "N/A"}¢`}
                      fg={theme.accent}
                    />
                    <Show when={market().change24h !== 0}>
                      <text
                        content={`  Δ ${market().change24h >= 0 ? "+" : ""}${market().change24h.toFixed(1)}%`}
                        fg={market().change24h >= 0 ? theme.success : theme.error}
                      />
                    </Show>
                  </box>
                  <box flexDirection="row">
                    <text content="Vol 24h:" fg={theme.textMuted} />
                    <text
                      content={` $${(market().volume24h / 1000).toFixed(1)}k`}
                      fg={theme.text}
                    />
                  </box>
                </>
              )}
            </Show>

            <box height={1} />

            <box flexDirection="row">
              <text content="Wallet: " fg={theme.textMuted} />
              <Show
                when={walletState.connected}
                fallback={<text content="not connected" fg={theme.textMuted} />}
              >
                <text
                  content={walletState.address ? `${walletState.address.slice(0, 8)}…${walletState.address.slice(-4)}` : "connected"}
                  fg={theme.accent}
                />
              </Show>
            </box>

            <Show when={walletState.connected}>
              <box flexDirection="row">
                <text content="Balance:" fg={theme.textMuted} />
                <text content={` $${walletState.balance?.toFixed(2) ?? "0.00"}`} fg={theme.success} />
              </box>
            </Show>

            <box height={1} />

            <box flexDirection="row">
              <text content="Markets:" fg={theme.textMuted} />
              <text content={` ${appState.markets.length} loaded`} fg={theme.textMuted} />
            </box>
          </box>
        </box>
      </box>

      {/* ── Input bar ──────────────────────────────────────────── */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <text content=" [INPUT] > " fg={theme.accent} />
        <text content={chatInputValue() || (chatInputFocused() ? "" : "(Enter to type)")} fg={theme.text} />
        <Show when={chatInputFocused() && !chatLoading()}>
          <text content="▋" fg={theme.primary} />
        </Show>
        <box flexGrow={1} />
        <text content=" ↑↓:history  Ctrl+L:clear  Esc:close " fg={theme.textMuted} />
      </box>
    </box>
  );
}
