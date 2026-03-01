/**
 * Messages Panel — handles direct messages and global chat
 */

import { For, Show, createMemo } from "solid-js";
import { useTheme } from "../context/theme";
import {
  messagesPanelOpen,
  messagesTab,
  conversationMode,
  conversations,
  selectedConversationId,
  globalChatMessages,
  globalChatInputValue,
  dmInputValue,
  dmNewRecipientId,
  DirectMessage,
  GlobalMessage,
  Conversation,
} from "../state";
import {
  getDirectMessagesWithUser,
  markGlobalAsRead,
} from "../api/messages";
import { walletState } from "../state";

export function MessagesPanel() {
  const { theme } = useTheme();

  const currentConversation = createMemo(() => {
    const convId = selectedConversationId();
    if (!convId) return null;
    return conversations().find(
      (c) => c.participantId.toLowerCase() === convId.toLowerCase()
    );
  });

  const currentDmMessages = createMemo(() => {
    const convId = selectedConversationId();
    if (!convId) return [];
    return getDirectMessagesWithUser(convId);
  });

  const currentUserId = () => walletState.address?.toLowerCase() || "";

  return (
    <box
      position="absolute"
      top={2}
      left="25%"
      width="50%"
      height="90%"
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <box
        height={1}
        width="100%"
        backgroundColor={theme.background}
        flexDirection="row"
        alignItems="center"
      >
        <text content=" Messages " fg={theme.text} />
        <box flexGrow={1} />
        <text content="[ESC:close]" fg={theme.textMuted} />
      </box>

      {/* Tabs */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.background}>
        <box width="50%">
          <text
            content={messagesTab() === "conversations" ? "● Direct" : "○ Direct"}
            fg={messagesTab() === "conversations" ? theme.accent : theme.textMuted}
          />
        </box>
        <box width="50%">
          <text
            content={messagesTab() === "global" ? "● Global" : "○ Global"}
            fg={messagesTab() === "global" ? theme.accent : theme.textMuted}
          />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle}>
        <text content="────────────────────────────────────────────────────────────────" fg={theme.border} />
      </box>

      {/* Content */}
      <Show when={messagesTab() === "conversations"}>
        <box flexGrow={1} width="100%" flexDirection="row">
          <Show
            when={conversationMode() === "chat" && selectedConversationId()}
            fallback={
              <box width="100%" flexDirection="column">
                <Show when={conversationMode() === "new"}>
                  <box height={2} width="100%" flexDirection="column" paddingLeft={1}>
                    <text content="To (address):" fg={theme.textMuted} />
                    <text content={dmNewRecipientId()} fg={theme.text} />
                    <text content="[Enter:start] [m:cancel]" fg={theme.textMuted} />
                  </box>
                </Show>
                <Show when={conversationMode() === "list"}>
                  <box height={1} width="100%" flexDirection="row" paddingLeft={1}>
                    <text content="Conversations" fg={theme.text} />
                    <box flexGrow={1} />
                    <text content="[m:new]" fg={theme.textMuted} />
                  </box>
                </Show>

                <scrollbox flexGrow={1} width="100%">
                  <box width="100%" flexDirection="column">
                    <Show when={conversations().length === 0 && conversationMode() === "list"}>
                      <text content="No conversations yet" fg={theme.textMuted} paddingLeft={1} />
                      <text content="Press [m] to start a new DM" fg={theme.textMuted} paddingLeft={1} />
                    </Show>
                    <For each={conversations()}>
                      {(conv) => (
                        <box width="100%" flexDirection="column" paddingLeft={1}>
                          <text
                            content={`${conv.participantName}${conv.unreadCount > 0 ? ` (${conv.unreadCount} new)` : ""}`}
                            fg={conv.unreadCount > 0 ? theme.accent : theme.text}
                          />
                          <text content={conv.lastMessage} fg={theme.textMuted} />
                        </box>
                      )}
                    </For>
                  </box>
                </scrollbox>
              </box>
            }
          >
            {/* DM Chat View */}
            <box flexGrow={1} width="100%" flexDirection="column">
              {/* DM Header */}
              <box height={1} width="100%" flexDirection="row" backgroundColor={theme.background}>
                <text content="[←] " fg={theme.accent} />
                <text content={currentConversation()?.participantName || "Chat"} fg={theme.text} />
              </box>

              {/* Messages */}
              <scrollbox flexGrow={1} width="100%">
                <box width="100%" flexDirection="column" paddingLeft={1}>
                  <Show when={currentDmMessages().length === 0}>
                    <text content="No messages yet. Start the conversation!" fg={theme.textMuted} />
                  </Show>
                  <For each={currentDmMessages()}>
                    {(msg) => (
                      <MessageBubble
                        message={msg}
                        isOwn={msg.senderId.toLowerCase() === currentUserId()}
                        theme={theme}
                      />
                    )}
                  </For>
                </box>
              </scrollbox>

              {/* Input hint */}
              <box height={1} width="100%" backgroundColor={theme.background}>
                <text content="> " fg={theme.textMuted} />
                <text content={dmInputValue() + "_"} fg={theme.text} />
              </box>
            </box>
          </Show>
        </box>
      </Show>

      {/* Global Chat */}
      <Show when={messagesTab() === "global"}>
        <box flexGrow={1} width="100%" flexDirection="column">
          {/* Messages */}
          <scrollbox flexGrow={1} width="100%">
            <box width="100%" flexDirection="column" paddingLeft={1}>
              <Show when={globalChatMessages().length === 0}>
                <text content="No messages yet. Say hello!" fg={theme.textMuted} />
              </Show>
              <For each={globalChatMessages()}>
                {(msg) => (
                  <GlobalMessageBubble
                    message={msg}
                    isOwn={msg.senderId.toLowerCase() === currentUserId()}
                    theme={theme}
                  />
                )}
              </For>
            </box>
          </scrollbox>

          {/* Input hint */}
          <box height={1} width="100%" backgroundColor={theme.background}>
            <text content="> " fg={theme.textMuted} />
            <text content={globalChatInputValue() + "_"} fg={theme.text} />
          </box>
        </box>
      </Show>
    </box>
  );
}

function MessageBubble(props: {
  message: DirectMessage;
  isOwn: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const timeStr = () => {
    const d = new Date(props.message.timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <box
      width="100%"
      flexDirection="column"
      paddingTop={1}
    >
      <text
        content={props.isOwn ? `You → ${props.message.recipientName || shortAddress(props.message.recipientId)}` : (props.message.senderName || shortAddress(props.message.senderId))}
        fg={props.isOwn ? props.theme.accent : props.theme.textMuted}
      />
      <text content={props.message.content} fg={props.theme.text} />
      <text content={timeStr()} fg={props.theme.textMuted} />
    </box>
  );
}

function GlobalMessageBubble(props: {
  message: GlobalMessage;
  isOwn: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const timeStr = () => {
    const d = new Date(props.message.timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <box
      width="100%"
      flexDirection="column"
      paddingTop={1}
    >
      <text
        content={props.isOwn ? "You" : props.message.senderName}
        fg={props.isOwn ? props.theme.accent : props.theme.textMuted}
      />
      <text content={props.message.content} fg={props.theme.text} />
      <text content={timeStr()} fg={props.theme.textMuted} />
    </box>
  );
}

function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
