import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useTheme } from "../context/theme";
import { walletState } from "../state";
import { useXmtp } from "../hooks/useXmtp";
import { LoadingState, PanelHeader, Separator } from "./ui/panel-components";

function truncateAddress(addr: string | null | undefined, chars: number = 6): string {
  if (!addr) return "unknown";
  if (addr.length <= chars * 2) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

function truncateText(text: string | undefined, max: number): string {
  const safe = (text ?? "").trim();
  if (safe.length <= max) return safe;
  return `${safe.slice(0, Math.max(1, max - 3))}...`;
}

function formatAge(date: Date | undefined): string {
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function wrapText(text: string, maxWidth: number): string[] {
  const width = Math.max(14, maxWidth);
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(" ");
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= width) {
        current = next;
        continue;
      }

      if (current) lines.push(current);

      let pending = word;
      while (pending.length > width) {
        lines.push(pending.slice(0, width));
        pending = pending.slice(width);
      }
      current = pending;
    }

    if (current) lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

export function XmtpChat() {
  const { theme } = useTheme();
  const {
    conversations,
    messages,
    currentConversationId,
    connected,
    connecting,
    status,
    error,
    inputValue,
    setInputValue,
    inputFocused,
    setInputFocused,
    showNewConversation,
    setShowNewConversation,
    newConversationInput,
    setNewConversationInput,
    connect,
    disconnect,
    refreshConversations,
    selectConversation,
    sendMessage,
    startNewConversation,
    isOwnMessage,
  } = useXmtp();

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

  const stackedLayout = createMemo(() => columns() < 96);
  const sidebarCols = createMemo(() => {
    const cols = columns();
    if (stackedLayout()) return cols;
    return Math.max(32, Math.min(42, Math.floor(cols * 0.28)));
  });
  const messageWrapWidth = createMemo(() => {
    const cols = columns();
    if (stackedLayout()) return Math.max(22, cols - 12);
    return Math.max(24, cols - sidebarCols() - 16);
  });

  const selectedConversation = createMemo(() => {
    const id = currentConversationId();
    if (!id) return null;
    return conversations().find((conversation) => conversation.id === id) ?? null;
  });

  const sortedConversations = createMemo(() =>
    [...conversations()].sort((a, b) => {
      const aTime = a.lastMessage?.timestamp?.getTime() ?? a.createdAt.getTime();
      const bTime = b.lastMessage?.timestamp?.getTime() ?? b.createdAt.getTime();
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      return bTime - aTime;
    }),
  );

  const unreadCount = createMemo(() => conversations().reduce((sum, conversation) => sum + conversation.unreadCount, 0));
  const walletLabel = createMemo(() => truncateAddress(walletState.address, 6));
  const statusLabel = createMemo(() => {
    if (connecting()) return status() || "Connecting...";
    if (connected()) return status() || `Connected as ${walletLabel()}`;
    return "Not connected";
  });

  const canCreateConversation = createMemo(() => /^0x[a-fA-F0-9]{40}$/.test(newConversationInput().trim()));
  const canSend = createMemo(() => connected() && !!selectedConversation() && inputValue().trim().length > 0);

  const handleConnect = async () => {
    if (!connected()) {
      await connect();
    }
  };

  const handleSend = async () => {
    const content = inputValue().trim();
    if (!content) return;
    await sendMessage(content);
  };

  const handleCreateConversation = async () => {
    const peer = newConversationInput().trim();
    if (!peer) return;
    await startNewConversation(peer);
  };

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={200}
      backgroundColor={theme.panelModal}
      flexDirection="column"
    >
      <PanelHeader
        title="XMTP DIRECT MESSAGES"
        icon="◈"
        subtitle={`${sortedConversations().length} threads`}
        onClose={() => undefined}
      >
        <text content={` wallet ${walletLabel()} `} fg={theme.textMuted} />
        <text content="│" fg={theme.borderSubtle} />
        <text content={` unread ${unreadCount()} `} fg={unreadCount() > 0 ? theme.accent : theme.textMuted} />
      </PanelHeader>

      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={2}>
        <text content={error() || statusLabel()} fg={error() ? theme.error : connected() ? theme.success : theme.textMuted} />
      </box>

      <Separator type="heavy" />

      <box flexGrow={1} flexDirection={stackedLayout() ? "column" : "row"} backgroundColor={theme.background}>
        <box
          width={stackedLayout() ? "100%" : sidebarCols()}
          height={stackedLayout() ? 16 : "100%"}
          flexDirection="column"
          backgroundColor={theme.background}
        >
          <box height={3} width="100%" flexDirection="row" alignItems="center" paddingLeft={2} paddingRight={2} backgroundColor={theme.backgroundPanel}>
            <box
              onMouseDown={() => void handleConnect()}
              backgroundColor={connected() ? theme.borderSubtle : theme.accent}
              paddingLeft={2}
              paddingRight={2}
            >
              <text content={connected() ? "CONNECTED" : connecting() ? "CONNECTING" : "CONNECT"} fg={connected() ? theme.textMuted : theme.background} />
            </box>
            <box width={1} />
            <box
              onMouseDown={() => {
                setInputFocused(false);
                setShowNewConversation(!showNewConversation());
              }}
              backgroundColor={theme.background}
              paddingLeft={2}
              paddingRight={2}
            >
              <text content={showNewConversation() ? "CLOSE" : "NEW CHAT"} fg={theme.text} />
            </box>
            <box flexGrow={1} />
            <box
              onMouseDown={() => void refreshConversations()}
              backgroundColor={theme.background}
              paddingLeft={2}
              paddingRight={2}
            >
              <text content="SYNC" fg={connected() ? theme.text : theme.textMuted} />
            </box>
          </box>

          <Show when={showNewConversation()}>
            <box width="100%" flexDirection="column" padding={2} backgroundColor={theme.backgroundPanel}>
              <text content="Start a new direct message" fg={theme.accent} />
              <box marginTop={1}>
                <input
                  value={newConversationInput()}
                  onInput={(value: string) => setNewConversationInput(value)}
                  placeholder="0x..."
                  focused={showNewConversation() && !inputFocused()}
                  width="100%"
                  backgroundColor={theme.background}
                />
              </box>
              <box flexDirection="row" marginTop={1}>
                <box
                  onMouseDown={canCreateConversation() ? () => void handleCreateConversation() : undefined}
                  backgroundColor={canCreateConversation() ? theme.success : theme.borderSubtle}
                  paddingLeft={2}
                  paddingRight={2}
                >
                  <text content="OPEN" fg={canCreateConversation() ? theme.background : theme.textMuted} />
                </box>
              </box>
            </box>
          </Show>

          <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

          <scrollbox flexGrow={1} width="100%">
            <box width="100%" flexDirection="column">
              <Show
                when={connected()}
                fallback={<LoadingState message="Connect XMTP to load chats" />}
              >
                <Show
                  when={sortedConversations().length > 0}
                  fallback={
                    <box padding={2} flexDirection="column">
                      <text content="No chats yet" fg={theme.textMuted} />
                      <text content="Use NEW CHAT to open a DM" fg={theme.textMuted} />
                    </box>
                  }
                >
                  <For each={sortedConversations()}>
                    {(conversation) => {
                      const active = () => currentConversationId() === conversation.id;
                      const preview = conversation.lastMessage
                        ? `${conversation.lastMessage.isFromMe ? "You: " : ""}${truncateText(conversation.lastMessage.content, 30)}`
                        : "No messages yet";

                      return (
                        <box
                          width="100%"
                          flexDirection="column"
                          backgroundColor={active() ? theme.backgroundPanel : theme.background}
                          onMouseDown={() => void selectConversation(conversation.id)}
                        >
                          <box flexDirection="row" width="100%" paddingLeft={2} paddingRight={2} paddingTop={1}>
                            <text content={conversation.name || truncateAddress(conversation.peerAddress, 5)} fg={active() ? theme.text : theme.textMuted} />
                            <box flexGrow={1} />
                            <Show when={conversation.unreadCount > 0}>
                              <text content={`${conversation.unreadCount}`} fg={theme.accent} />
                              <text content="  " />
                            </Show>
                            <text content={formatAge(conversation.lastMessage?.timestamp || conversation.createdAt)} fg={theme.textMuted} />
                          </box>
                          <box width="100%" paddingLeft={2} paddingRight={2} paddingBottom={1}>
                            <text content={preview} fg={theme.textMuted} />
                          </box>
                        </box>
                      );
                    }}
                  </For>
                </Show>
              </Show>
            </box>
          </scrollbox>

          <Show when={!stackedLayout()}>
            <box height={1} width="100%" backgroundColor={theme.borderSubtle} />
            <box height={3} width="100%" flexDirection="row" alignItems="center" paddingLeft={2} paddingRight={2} backgroundColor={theme.backgroundPanel}>
              <text content={connected() ? "Live session" : "Offline"} fg={connected() ? theme.success : theme.textMuted} />
              <box flexGrow={1} />
              <Show when={connected()}>
                <box onMouseDown={() => void disconnect()} backgroundColor={theme.error} paddingLeft={2} paddingRight={2}>
                  <text content="DISCONNECT" fg={theme.background} />
                </box>
              </Show>
            </box>
          </Show>
        </box>

        <Show when={!stackedLayout()}>
          <box width={1} height="100%" backgroundColor={theme.border} />
        </Show>

        <Show when={stackedLayout()}>
          <box height={1} width="100%" backgroundColor={theme.border} />
        </Show>

        <box flexGrow={1} width={stackedLayout() ? "100%" : undefined} flexDirection="column" backgroundColor={theme.background}>
          <Show
            when={selectedConversation()}
            fallback={
              <box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
                <text content="Select a chat on the left" fg={theme.text} />
                <text content="The selected conversation opens here" fg={theme.textMuted} />
              </box>
            }
          >
            <box height={3} width="100%" flexDirection="row" alignItems="center" paddingLeft={2} paddingRight={2} backgroundColor={theme.backgroundPanel}>
              <text content={selectedConversation()?.name || truncateAddress(selectedConversation()?.peerAddress, 8)} fg={theme.text} />
              <box flexGrow={1} />
              <text content={selectedConversation()?.peerInboxId ? truncateAddress(selectedConversation()?.peerInboxId, 8) : "direct"} fg={theme.textMuted} />
            </box>

            <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

            <scrollbox flexGrow={1} width="100%">
              <box width="100%" flexDirection="column" padding={2}>
                <Show
                  when={messages().length > 0}
                  fallback={
                    <box paddingTop={2}>
                      <text content="No messages yet" fg={theme.textMuted} />
                    </box>
                  }
                >
                  <For each={messages()}>
                    {(message) => {
                      const isMine = isOwnMessage(message.senderAddress);
                      const lines = wrapText(message.content, messageWrapWidth());
                      return (
                        <box flexDirection="column" alignItems={isMine ? "flex-end" : "flex-start"} marginBottom={1}>
                          <text
                            content={isMine ? `You · ${formatMessageTime(message.timestamp)}` : `${truncateAddress(message.senderAddress, 6)} · ${formatMessageTime(message.timestamp)}`}
                            fg={theme.textMuted}
                          />
                          <box backgroundColor={isMine ? theme.accent : theme.backgroundPanel} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
                            <box flexDirection="column">
                              <For each={lines}>
                                {(line) => <text content={line || " "} fg={isMine ? theme.background : theme.text} />}
                              </For>
                            </box>
                          </box>
                        </box>
                      );
                    }}
                  </For>
                </Show>
              </box>
            </scrollbox>

            <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

            <box height={5} width="100%" flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor={theme.backgroundPanel}>
              <text content={inputFocused() ? "[Enter] send  [Esc] blur" : "[I/Enter] focus  [Esc] close"} fg={theme.textMuted} />
              <box flexDirection="row" marginTop={1}>
                <box flexGrow={1}>
                  <input
                    value={inputValue()}
                    onInput={(value: string) => {
                      setInputValue(value);
                      setInputFocused(true);
                    }}
                    placeholder={connected() ? "Type a message..." : "Connect XMTP first"}
                    focused={inputFocused() && connected() && !!selectedConversation()}
                    width="100%"
                    backgroundColor={theme.background}
                  />
                </box>
                <box width={1} />
                <box
                  onMouseDown={canSend() ? () => void handleSend() : undefined}
                  backgroundColor={canSend() ? theme.accent : theme.borderSubtle}
                  paddingLeft={2}
                  paddingRight={2}
                  alignItems="center"
                  justifyContent="center"
                >
                  <text content="SEND" fg={canSend() ? theme.background : theme.textMuted} />
                </box>
              </box>
            </box>
          </Show>
        </box>
      </box>
    </box>
  );
}
