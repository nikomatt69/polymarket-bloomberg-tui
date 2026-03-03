/**
 * User search component — find other users
 */

import { For, Show } from "solid-js";
import { useTheme } from "../context/theme";
import {
  setUserSearchOpen,
  userSearchQuery,
  setUserSearchQuery,
  userSearchResults,
  setUserSearchResults,
  userSearchLoading,
  setUserSearchLoading,
} from "../state";
import { searchUsers } from "../api/users";
import { PanelHeader, Separator, LoadingState } from "./ui/panel-components";

export function UserSearch() {
  const { theme } = useTheme();

  const handleSearch = async () => {
    const query = userSearchQuery();
    if (query.length < 2) return;
    setUserSearchLoading(true);
    const results = await searchUsers(query);
    setUserSearchResults(results);
    setUserSearchLoading(false);
  };

  const handleClose = () => {
    setUserSearchOpen(false);
    setUserSearchQuery("");
    setUserSearchResults([]);
  };

  return (
    <box
      position="absolute"
      top={2}
      left="15%"
      width="70%"
      height={18}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={170}
    >
      {/* Header */}
      <PanelHeader
        title="USER SEARCH"
        icon="◈"
        subtitle={userSearchResults().length > 0 ? `${userSearchResults().length} results` : "find users"}
        onClose={handleClose}
      />

      {/* Search input row */}
      <box height={1} width="100%" flexDirection="row" paddingLeft={2} backgroundColor={theme.background}>
        <text content="▶ " fg={theme.accent} />
        <input
          width="70%"
          value={userSearchQuery()}
          focused={true}
          onInput={(v: string) => setUserSearchQuery(v)}
        />
        <box flexGrow={1} />
        <box onMouseDown={handleSearch}>
          <text content="[Enter] Search  " fg={theme.textMuted} />
        </box>
      </box>

      <Separator />

      {/* Column headers */}
      <Show when={userSearchResults().length > 0}>
        <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel} paddingLeft={2}>
          <text content={"USER".padEnd(22)} fg={theme.textMuted} width={23} />
          <text content={"BIO"} fg={theme.textMuted} />
        </box>
      </Show>

      {/* Loading */}
      <Show when={userSearchLoading()}>
        <LoadingState message={`Searching for "${userSearchQuery()}"…`} />
      </Show>

      {/* Results */}
      <Show when={!userSearchLoading() && userSearchResults().length > 0}>
        <scrollbox flexGrow={1} width="100%">
          <For each={userSearchResults()}>
            {(profile) => (
              <box flexDirection="row" width="100%" paddingLeft={2}>
                <text content="◈ " fg={theme.accent} width={2} />
                <text
                  content={profile.username.padEnd(20)}
                  fg={theme.text}
                  width={21}
                />
                <text content="│ " fg={theme.borderSubtle} />
                <text
                  content={profile.bio || "No bio available"}
                  fg={theme.textMuted}
                />
              </box>
            )}
          </For>
        </scrollbox>
      </Show>

      {/* Empty states */}
      <Show when={!userSearchLoading() && userSearchQuery().length >= 2 && userSearchResults().length === 0}>
        <box flexGrow={1} paddingLeft={2} paddingTop={1} flexDirection="column">
          <text content={`✗ No users found for "${userSearchQuery()}".`} fg={theme.textMuted} />
          <text content="" />
          <text content="Try a different username or partial address." fg={theme.textMuted} />
        </box>
      </Show>

      <Show when={!userSearchLoading() && userSearchQuery().length < 2}>
        <box flexGrow={1} paddingLeft={2} paddingTop={1}>
          <text content="○ Type at least 2 characters to search." fg={theme.textMuted} />
        </box>
      </Show>

      {/* Footer */}
      <Separator type="light" />
      <box height={1} paddingLeft={2} flexDirection="row">
        <text content="[Enter] Search  " fg={theme.textMuted} />
        <text content="[ESC] Close" fg={theme.textMuted} />
      </box>
    </box>
  );
}
