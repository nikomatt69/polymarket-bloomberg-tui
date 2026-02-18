/**
 * Chat Panel — displays AI assistant conversation with real-time tool call tracking
 */

import { For, Show, createSignal } from "solid-js";
import { useTheme } from "../context/theme";
import { chatMessages, chatLoading, setChatInputFocused } from "../state";

interface ToolCallDisplay {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "executing" | "success" | "error";
  result?: string;
  error?: string;
}

export function ChatPanel() {
  const { theme } = useTheme();
  const [activeToolCalls, setActiveToolCalls] = createSignal<ToolCallDisplay[]>([]);

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.backgroundPanel}
      onMouseDown={() => setChatInputFocused(true)}
    >
      {/* Header */}
      <box height={1} width="100%" paddingLeft={1} backgroundColor={theme.background} flexDirection="row">
        <text content="🤖" fg={theme.accent} />
        <text content=" AI Assistant" fg={theme.text} />
        <Show when={chatLoading()}>
          <text content=" ●" fg={theme.accent} />
        </Show>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle}>
        <text content="────────────────────────────────────────────────────────────────" fg={theme.border} />
      </box>

      {/* Messages */}
      <scrollbox flexGrow={1} width="100%">
        <box width="100%" flexDirection="column" paddingLeft={1} paddingRight={1}>
          <Show when={chatMessages().length === 0 && !chatLoading()}>
            <text content="💬 Chat with the AI about Polymarket markets" fg={theme.textMuted} />
            <text content="" fg={theme.textMuted} />
            <text content="Examples:" fg={theme.textMuted} />
            <text content="  • Find trending crypto markets" fg={theme.textMuted} />
            <text content="  • Show me NBA markets" fg={theme.textMuted} />
            <text content="  • What's my portfolio worth?" fg={theme.textMuted} />
            <text content="" fg={theme.textMuted} />
          </Show>

          <For each={chatMessages()}>
            {(message) => (
              <box width="100%" flexDirection="column">
                {/* Role label with icon */}
                <text
                  content={message.role === "user" ? "👤 You:" : "🤖 AI:"}
                  fg={message.role === "user" ? theme.accent : theme.textMuted}
                />

                {/* Content - wrap long lines */}
                <box width="100%" flexDirection="column">
                  <MessageContent content={message.content} />
                </box>

                {/* Tool calls with detailed display */}
                <Show when={message.toolCalls && message.toolCalls.length > 0}>
                  <box flexDirection="column" paddingTop={1}>
                    <text content="🔧 Tools executed:" fg={theme.textMuted} />
                    <For each={message.toolCalls}>
                      {(toolCall) => (
                        <box flexDirection="column" paddingLeft={2}>
                          <text
                            content={`→ ${toolCall.name}`}
                            fg={theme.textMuted}
                          />
                          <Show when={toolCall.arguments && Object.keys(toolCall.arguments).length > 0}>
                            <text
                              content={`   Args: ${JSON.stringify(toolCall.arguments).slice(0, 100)}`}
                              fg={theme.textMuted}
                            />
                          </Show>
                          <Show when={toolCall.result}>
                            <text
                              content={`   Result: ${JSON.stringify(toolCall.result).slice(0, 200)}`}
                              fg={theme.textMuted}
                            />
                          </Show>
                        </box>
                      )}
                    </For>
                  </box>
                </Show>

                <text content="" fg={theme.textMuted} />
              </box>
            )}
          </For>

          {/* Active tool calls during streaming - shows as message content includes tool calls */}
          <Show when={chatLoading() && chatMessages().length > 0}>
            <box flexDirection="column" paddingTop={1}>
              <text content="⚡ AI is processing..." fg={theme.accent} />
              <text content="   Tool calls will appear in the response above" fg={theme.textMuted} />
            </box>
          </Show>

          {/* Loading indicator */}
          <Show when={chatLoading()}>
            <text content="🤔 Thinking..." fg={theme.accent} />
          </Show>
        </box>
      </scrollbox>
    </box>
  );
}

function MessageContent(props: { content: string }) {
  const { theme } = useTheme();

  // Enhanced word wrap with better formatting
  const lines = () => {
    const content = props.content;
    const maxWidth = 58;
    const words = content.split(" ");
    const result: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + " " + word).trim().length <= maxWidth) {
        currentLine = (currentLine + " " + word).trim();
      } else {
        if (currentLine) result.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) result.push(currentLine);

    return result;
  };

  return (
    <box flexDirection="column">
      <For each={lines()}>
        {(line) => (
          <text content={line} fg={theme.text} />
        )}
      </For>
    </box>
  );
}
