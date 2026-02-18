/**
 * Chat Input — enhanced input bar for AI assistant with enterprise styling
 */

import { Show } from "solid-js";
import { useTheme } from "../context/theme";
import { chatInputFocused, chatInputValue, chatLoading, setChatInputFocused } from "../state";

export function ChatInput() {
  const { theme } = useTheme();

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={theme.backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
    >
      <text content=">" fg={theme.accent} />
      <box flexGrow={1} onMouseDown={() => setChatInputFocused(true)}>
        <Show
          when={chatInputFocused()}
          fallback={
            <text content="Press Enter to chat with AI..." fg={theme.textMuted} />
          }
        >
          <box flexDirection="row">
            <text content={chatInputValue()} fg={theme.text} />
            <Show when={chatLoading()}>
              <text content=" ⏳" fg={theme.accent} />
            </Show>
            <Show when={!chatLoading()}>
              <text content="_" fg={theme.textMuted} />
            </Show>
          </box>
        </Show>
      </box>
      {/* Status indicator */}
      <Show when={!chatLoading()}>
        <text content=" ●" fg={theme.success} />
      </Show>
      <Show when={chatLoading()}>
        <text content=" ◐" fg={theme.accent} />
      </Show>
    </box>
  );
}
