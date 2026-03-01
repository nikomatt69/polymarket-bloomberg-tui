/**
 * User search component — find other users
 */

import { For, Show } from "solid-js";
import { useTheme } from "../context/theme";
import {
  userSearchOpen,
  setUserSearchOpen,
  userSearchQuery,
  setUserSearchQuery,
  userSearchResults,
  setUserSearchResults,
  userSearchLoading,
  setUserSearchLoading,
  contactsList,
  setContactsList,
} from "../state";
import { searchUsers } from "../api/users";
import { UserProfile, UserContact } from "../types/user";

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

  const handleKeyDown = (e: { name: string; sequence?: string }) => {
    if (e.name === "return") {
      handleSearch();
    } else if (e.name === "backspace") {
      setUserSearchQuery(userSearchQuery().slice(0, -1));
    } else if (e.name === "escape") {
      setUserSearchOpen(false);
      setUserSearchQuery("");
      setUserSearchResults([]);
    } else if (e.sequence && e.sequence.length === 1 && e.sequence >= " ") {
      setUserSearchQuery(userSearchQuery() + e.sequence);
    }
  };

  return (
    <Show when={userSearchOpen()}>
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
        <box height={1} width="100%" backgroundColor={theme.success} flexDirection="row">
          <text content=" ◈ USER SEARCH " fg={theme.highlightText} />
          <box flexGrow={1} />
          <text content={` ${userSearchResults().length} results `} fg={theme.highlightText} />
          <box onMouseDown={() => { setUserSearchOpen(false); setUserSearchQuery(""); setUserSearchResults([]); }}>
            <text content=" [ESC] ✕ " fg={theme.highlightText} />
          </box>
        </box>

        {/* Search input */}
        <box height={1} width="100%" paddingLeft={2}>
          <text content="Search: " fg={theme.text} />
          <input
            width={40}
            value={userSearchQuery()}
            focused={true}
          />
          <text content="  " />
          <box onMouseDown={handleSearch}>
            <text content="[Enter]" fg={theme.accent} />
          </box>
        </box>

        <Show when={userSearchLoading()}>
          <text content="Searching..." fg={theme.warning} paddingLeft={2} />
        </Show>

        <Show when={!userSearchLoading() && userSearchResults().length > 0}>
          <scrollbox height={12} width="100%" paddingLeft={2}>
            <For each={userSearchResults()}>
              {(profile) => (
                <box flexDirection="row" width="100%">
                  <text content="👤 " fg={theme.accent} />
                  <text content={profile.username.padEnd(20)} fg={theme.text} width={21} />
                  <text content={profile.bio || "No bio"} fg={theme.textMuted} />
                </box>
              )}
            </For>
          </scrollbox>
        </Show>

        <Show when={!userSearchLoading() && userSearchQuery().length >= 2 && userSearchResults().length === 0}>
          <text content="No users found" fg={theme.textMuted} paddingLeft={2} />
        </Show>
      </box>
    </Show>
  );
}
