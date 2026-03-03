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
  setMessagesPanelOpen,
  DirectMessage,
  GlobalMessage,
  Conversation,
} from "../state";
import {
  getDirectMessagesWithUser,
  markGlobalAsRead,
} from "../api/messages";
import { walletState } from "../state";
import { PanelHeader, Separator } from "./ui/panel-components";

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

  const unreadGlobal = () => globalChatMessages().filter(m => !m.read && m.senderId !== (walletState.address ?? "")).length;
  const unreadDm = () => conversations().reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  return (
    <box
      position="absolute"
      top={2}
      left="25%"
      width="50%"
      height="90%"
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <PanelHeader
        title="MESSAGES"
        icon="◈"
        subtitle={unreadDm() + unreadGlobal() > 0 ? `${unreadDm() + unreadGlobal()} unread` : undefined}
        onClose={() => setMessagesPanelOpen(false)}
      />

      {/* Tabs */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel}>
        <box
          width="50%"
          paddingLeft={2}
          backgroundColor={messagesTab() === "conversations" ? theme.primary : undefined}
        >
          <text
            content={messagesTab() === "conversations"
              ? `● DIRECT${unreadDm() > 0 ? ` (${unreadDm()})` : ""}`
              : `○ DIRECT${unreadDm() > 0 ? ` (${unreadDm()})` : ""}`}
            fg={messagesTab() === "conversations" ? theme.highlightText : theme.textMuted}
          />
        </box>
        <box
          width="50%"
          paddingLeft={2}
          backgroundColor={messagesTab() === "global" ? theme.primary : undefined}
        >
          <text
            content={messagesTab() === "global"
              ? `● GLOBAL${unreadGlobal() > 0 ? ` (${unreadGlobal()})` : ""}`
              : `○ GLOBAL${unreadGlobal() > 0 ? ` (${unreadGlobal()})` : ""}`}
            fg={messagesTab() === "global" ? theme.highlightText : theme.textMuted}
          />
        </box>
      </box>

      <Separator type="heavy" />

      {/* Content */}
      <Show when={messagesTab() === "conversations"}>
        <box flexGrow={1} width="100%" flexDirection="row">
          <Show
            when={conversationMode() === "chat" && selectedConversationId()}
            fallback={
              <box width="100%" flexDirection="column">
                <Show when={conversationMode() === "new"}>
                  <box flexDirection="column" paddingLeft={2} paddingTop={1}>
                    <text content="─── NEW MESSAGE ────────────────────────────────" fg={theme.borderSubtle} />
                    <text content="To (Ethereum address):" fg={theme.textMuted} />
                    <text content={dmNewRecipientId()} fg={theme.accent} />
                    <text content="" />
                    <text content="[Enter] Start  [M] Cancel" fg={theme.textMuted} />
                  </box>
                </Show>
                <Show when={conversationMode() === "list"}>
                  <box height={1} width="100%" flexDirection="row" paddingLeft={2} backgroundColor={theme.backgroundPanel}>
                    <text content="─── DIRECT MESSAGES ────" fg={theme.borderSubtle} />
                    <box flexGrow={1} />
                    <text content="[M] New DM " fg={theme.accent} />
                  </box>
                </Show>

                <scrollbox flexGrow={1} width="100%">
                  <box width="100%" flexDirection="column">
                    <Show when={conversations().length === 0 && conversationMode() === "list"}>
                      <box paddingLeft={2} paddingTop={1}>
                        <text content="○ No conversations yet" fg={theme.textMuted} />
                        <text content="" />
                        <text content="Press [M] to start a direct message." fg={theme.textMuted} />
                      </box>
                    </Show>
                    <For each={conversations()}>
                      {(conv) => (
                        <box width="100%" flexDirection="row" paddingLeft={2} paddingRight={1}>
                          <text
                            content={(conv.unreadCount > 0 ? "● " : "○ ")}
                            fg={conv.unreadCount > 0 ? theme.accent : theme.textMuted}
                          />
                          <box flexGrow={1} flexDirection="column">
                            <text
                              content={conv.participantName}
                              fg={conv.unreadCount > 0 ? theme.accent : theme.text}
                            />
                            <text content={conv.lastMessage.slice(0, 42)} fg={theme.textMuted} />
                          </box>
                          <Show when={conv.unreadCount > 0}>
                            <text content={`${conv.unreadCount}`} fg={theme.error} />
                          </Show>
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
              <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel} paddingLeft={1}>
                <text content="← " fg={theme.accent} />
                <text content={currentConversation()?.participantName || "Chat"} fg={theme.text} />
                <text content="  (Direct)" fg={theme.textMuted} />
              </box>
              <Separator type="light" />

              {/* Messages */}
              <scrollbox flexGrow={1} width="100%">
                <box width="100%" flexDirection="column" paddingLeft={1} paddingRight={1}>
                  <Show when={currentDmMessages().length === 0}>
                    <box paddingTop={1}>
                      <text content="○ No messages yet — start the conversation!" fg={theme.textMuted} />
                    </box>
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

              {/* Input bar */}
              <Separator type="light" />
              <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row" paddingLeft={1}>
                <text content="▶ " fg={theme.accent} />
                <text content={dmInputValue()} fg={theme.text} />
                <text content="▌" fg={theme.primary} />
                <box flexGrow={1} />
                <text content=" [Enter] Send  [Esc] Back " fg={theme.textMuted} />
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
            <box width="100%" flexDirection="column" paddingLeft={1} paddingRight={1}>
              <Show when={globalChatMessages().length === 0}>
                <box paddingTop={1}>
                  <text content="○ No messages yet — say hello!" fg={theme.textMuted} />
                </box>
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

          {/* Input bar */}
          <Separator type="light" />
          <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row" paddingLeft={1}>
            <text content="▶ " fg={theme.accent} />
            <text content={globalChatInputValue()} fg={theme.text} />
            <text content="▌" fg={theme.primary} />
            <box flexGrow={1} />
            <text content=" [Enter] Send  [Esc] Close " fg={theme.textMuted} />
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
    <box width="100%" flexDirection="row" paddingTop={1}>
      <text content={props.isOwn ? "→ " : "◈ "} fg={props.isOwn ? props.theme.accent : props.theme.primary} />
      <box flexGrow={1} flexDirection="column">
        <box flexDirection="row">
          <text
            content={props.isOwn
              ? `You → ${props.message.recipientName || shortAddress(props.message.recipientId)}`
              : (props.message.senderName || shortAddress(props.message.senderId))}
            fg={props.isOwn ? props.theme.accent : props.theme.primary}
          />
          <text content={`  ${timeStr()}`} fg={props.theme.textMuted} />
        </box>
        <text content={props.message.content} fg={props.theme.text} paddingLeft={0} />
      </box>
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
    <box width="100%" flexDirection="row" paddingTop={1}>
      <text content={props.isOwn ? "→ " : "◈ "} fg={props.isOwn ? props.theme.accent : props.theme.primary} />
      <box flexGrow={1} flexDirection="column">
        <box flexDirection="row">
          <text
            content={props.isOwn ? "You" : props.message.senderName}
            fg={props.isOwn ? props.theme.accent : props.theme.primary}
          />
          <text content={`  ${timeStr()}`} fg={props.theme.textMuted} />
        </box>
        <text content={props.message.content} fg={props.theme.text} />
      </box>
    </box>
  );
}

function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
