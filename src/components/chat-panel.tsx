/**
 * ChatPanel — read-only preview of the last 3 AI agent messages.
 * Press Enter globally to open the full EnterpriseChat overlay.
 */

import { For, Show, createMemo } from "solid-js";
import { useTheme } from "../context/theme";
import { chatMessages, chatLoading } from "../state";

export function ChatPanel() {
  const { theme } = useTheme();

  // Show only the last 3 messages as a preview
  const previewMessages = createMemo(() => {
    const msgs = chatMessages();
    return msgs.slice(-3);
  });

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.backgroundPanel}
    >
      {/* Header */}
      <box height={1} width="100%" paddingLeft={1} backgroundColor={theme.background} flexDirection="row">
        <text content="◈ AI AGENT" fg={theme.accent} />
        <Show when={chatLoading()}>
          <text content=" ◌ running" fg={theme.warning} />
        </Show>
        <Show when={!chatLoading() && previewMessages().length > 0}>
          <text content={`  ${previewMessages().length} msgs`} fg={theme.textMuted} />
        </Show>
        <box flexGrow={1} />
        <text content=" [Enter] expand " fg={theme.textMuted} />
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

      {/* Preview area */}
      <box flexGrow={1} width="100%" flexDirection="column" paddingLeft={1} paddingRight={1}>
        <Show
          when={previewMessages().length > 0}
          fallback={
            <box flexDirection="column" paddingTop={1}>
              <text content="Press Enter to open the AI Agent" fg={theme.textMuted} />
              <text content="" fg={theme.textMuted} />
              <text content="Ask about markets, get trading insights," fg={theme.textMuted} />
              <text content="execute trades, and more." fg={theme.textMuted} />
            </box>
          }
        >
          <For each={previewMessages()}>
            {(message) => (
              <box width="100%" flexDirection="column" paddingTop={1}>
                <text
                  content={message.role === "user" ? "▶ You:" : "◈ Agent:"}
                  fg={message.role === "user" ? theme.accent : theme.primary}
                />
                <box width="100%" paddingLeft={1}>
                  <text
                    content={message.content.slice(0, 80) + (message.content.length > 80 ? "…" : "")}
                    fg={theme.text}
                  />
                </box>
              </box>
            )}
          </For>
          <Show when={chatMessages().length > 3}>
            <box paddingTop={1}>
              <text
                content={`  … and ${chatMessages().length - 3} more messages — [Enter] to view all`}
                fg={theme.textMuted}
              />
            </box>
          </Show>
        </Show>
      </box>
    </box>
  );
}
