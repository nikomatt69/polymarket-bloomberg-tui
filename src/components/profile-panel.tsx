/**
 * Profile panel — view/edit user profile, search users, manage contacts
 */

import { For, Show, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import { PanelHeader, Separator, DataRow, LoadingState } from "./ui/panel-components";
import {
  profilePanelOpen,
  setProfilePanelOpen,
  profileViewMode,
  setProfileViewMode,
  userSearchOpen,
  setUserSearchOpen,
  userSearchQuery,
  setUserSearchQuery,
  userSearchResults,
  setUserSearchResults,
  userSearchLoading,
  setUserSearchLoading,
  selectedProfileId,
  setSelectedProfileId,
  contactsList,
  setContactsList,
  currentUserProfile,
  setCurrentUserProfile,
  editingField,
  setEditingField,
  editValue,
  setEditValue,
  authState,
  setAuthState,
  setAuthModalOpen,
  setAuthModalMode,
} from "../state";
import { getCurrentUser, updateProfile, searchUsers } from "../api/users";
import { UserProfile, UserContact } from "../types/user";
import { logoutUser } from "../auth/auth";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

const SEPARATOR = "────────────────────────────────────────────────────────";

export async function loadCurrentUserProfile(): Promise<void> {
  const user = await getCurrentUser();
  setCurrentUserProfile(user);
}

export async function loadContacts(): Promise<void> {
  try {
    const stored = localStorage.getItem("userContacts");
    if (stored) {
      setContactsList(JSON.parse(stored));
    }
  } catch {
    setContactsList([]);
  }
}

function saveContacts(contacts: UserContact[]): void {
  localStorage.setItem("userContacts", JSON.stringify(contacts));
}

function addContact(profile: UserProfile): void {
  const contact: UserContact = {
    id: profile.id,
    username: profile.username,
    avatar: profile.avatar,
    addedAt: new Date().toISOString(),
  };
  const updated = [...contactsList(), contact];
  setContactsList(updated);
  saveContacts(updated);
}

function removeContact(userId: string): void {
  const updated = contactsList().filter((c) => c.id !== userId);
  setContactsList(updated);
  saveContacts(updated);
}

function isContact(userId: string): boolean {
  return contactsList().some((c) => c.id === userId);
}

export function ProfilePanel() {
  const { theme } = useTheme();

  createEffect(() => {
    if (profilePanelOpen() && profileViewMode() === "view") {
      loadCurrentUserProfile();
      loadContacts();
    }
  });

  const handleClose = () => {
    setProfilePanelOpen(false);
    setProfileViewMode("view");
    setUserSearchOpen(false);
    setEditingField(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    const field = editingField();
    const value = editValue();
    
    if (!field || !value.trim()) {
      setEditingField(null);
      setEditValue("");
      return;
    }

    const updates: Partial<UserProfile> = {};
    if (field === "username") updates.username = value.trim();
    else if (field === "bio") updates.bio = value.trim();
    else if (field === "avatar") updates.avatar = value.trim();

    const updated = await updateProfile(updates);
    if (updated) {
      setCurrentUserProfile(updated);
    }
    
    setEditingField(null);
    setEditValue("");
  };

  const startEdit = (field: "username" | "bio" | "avatar") => {
    const profile = currentUserProfile();
    if (!profile) return;
    
    setEditingField(field);
    setEditValue(profile[field] || "");
  };

  const handleLogout = () => {
    logoutUser();
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
    });
    setProfilePanelOpen(false);
  };

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <PanelHeader
        title="USER PROFILE"
        icon="◈"
        subtitle={profileViewMode() === "edit" ? "EDIT MODE" : profileViewMode() === "search" ? "USER SEARCH" : undefined}
        onClose={handleClose}
      >
        <Show when={profileViewMode() === "view"}>
          <box onMouseDown={() => setProfileViewMode("edit")}>
            <text content=" [E] Edit " fg={theme.primaryMuted} />
          </box>
          <box onMouseDown={() => { setProfileViewMode("search"); loadContacts(); }}>
            <text content=" [S] Search " fg={theme.primaryMuted} />
          </box>
          <box onMouseDown={handleLogout}>
            <text content=" [L] Logout " fg={theme.error} />
          </box>
        </Show>
      </PanelHeader>

      <Separator type="heavy" />

      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
        <Show when={profileViewMode() === "view" || profileViewMode() === "edit"}>
          <ProfileViewEdit
            profile={currentUserProfile()}
            isEditing={profileViewMode() === "edit"}
            onStartEdit={startEdit}
            onSaveEdit={handleSaveEdit}
            contacts={contactsList()}
            onAddContact={addContact}
            onRemoveContact={removeContact}
            isContact={isContact}
          />
        </Show>

        <Show when={profileViewMode() === "search"}>
          <UserSearchView
            onSelectUser={(profile) => {
              setSelectedProfileId(profile.id);
              setProfileViewMode("view");
            }}
          />
        </Show>
      </box>
    </box>
  );
}

function ProfileViewEdit(props: {
  profile: UserProfile | null;
  isEditing: boolean;
  onStartEdit: (field: "username" | "bio" | "avatar") => void;
  onSaveEdit: () => void;
  contacts: UserContact[];
  onAddContact: (profile: UserProfile) => void;
  onRemoveContact: (userId: string) => void;
  isContact: (userId: string) => boolean;
}) {
  const { theme } = useTheme();

  return (
    <box flexDirection="column" width="100%">
      <Show when={!props.profile}>
        <LoadingState message="Loading profile…" />
        <box paddingLeft={2} paddingTop={1} onMouseDown={loadCurrentUserProfile}>
          <text content="[R] Retry" fg={theme.accent} />
        </box>
      </Show>

      <Show when={props.profile}>
        {/* Profile Info */}
        <text content="─── IDENTITY ────────────────────────────────────────────────────" fg={theme.borderSubtle} />
        <box flexDirection="row" width="100%" gap={2}>
          {/* Avatar Block */}
          <box
            width={12}
            height={5}
            backgroundColor={theme.highlight}
            flexDirection="column"
          >
            <text content="  ◈   " fg={theme.primary} />
            <text content={`  ${(props.profile!.username || "?").slice(0, 2).toUpperCase()}  `} fg={theme.highlightText} />
            <text content="      " />
            <Show when={props.isEditing}>
              <box onMouseDown={() => props.onStartEdit("avatar")}>
                <text content=" [C]hg " fg={theme.accent} />
              </box>
            </Show>
          </box>

          <box flexDirection="column" flexGrow={1}>
            <box flexDirection="row">
              <text content="Username: " fg={theme.textMuted} />
              <Show when={!props.isEditing || editingField() !== "username"}>
                <text content={props.profile!.username || "—"} fg={theme.accent} />
                <Show when={props.isEditing}>
                  <text content="  " />
                  <box onMouseDown={() => props.onStartEdit("username")}>
                    <text content="[E] Edit" fg={theme.accent} />
                  </box>
                </Show>
              </Show>
              <Show when={props.isEditing && editingField() === "username"}>
                <input width={20} value={editValue()} focused={true} />
                <text content="  " />
                <box onMouseDown={props.onSaveEdit}>
                  <text content="[Enter] Save" fg={theme.success} />
                </box>
              </Show>
            </box>

            <box flexDirection="row">
              <text content="Email   : " fg={theme.textMuted} />
              <text content={props.profile!.email || "—"} fg={theme.text} />
            </box>
            <box flexDirection="row">
              <text content="Joined  : " fg={theme.textMuted} />
              <text content={props.profile!.createdAt ? formatDate(props.profile!.createdAt) : "—"} fg={theme.text} />
            </box>
            <box flexDirection="row">
              <text content="Last    : " fg={theme.textMuted} />
              <text content={props.profile!.lastSeen ? formatDate(props.profile!.lastSeen) : "—"} fg={theme.textMuted} />
            </box>
          </box>
        </box>

        {/* Bio Section */}
        <text content="─── BIO ─────────────────────────────────────────────────────────" fg={theme.borderSubtle} />
        <Show when={!props.isEditing || editingField() !== "bio"}>
          <box paddingLeft={1}>
            <text content={props.profile!.bio || "○ No bio set"} fg={props.profile!.bio ? theme.text : theme.textMuted} />
          </box>
          <Show when={props.isEditing}>
            <box paddingLeft={1} paddingTop={0} onMouseDown={() => props.onStartEdit("bio")}>
              <text content="[E] Edit Bio" fg={theme.accent} />
            </box>
          </Show>
        </Show>
        <Show when={props.isEditing && editingField() === "bio"}>
          <box paddingLeft={1}>
            <input width={50} value={editValue()} focused={true} />
          </box>
          <box paddingLeft={1} paddingTop={0} onMouseDown={props.onSaveEdit}>
            <text content="[Enter] Save  [ESC] Cancel" fg={theme.success} />
          </box>
        </Show>

        {/* Contacts Section */}
        <text content={`─── CONTACTS (${props.contacts.length}) ──────────────────────────────────────────`} fg={theme.borderSubtle} />
        <Show
          when={props.contacts.length === 0}
          fallback={
            <scrollbox height={5} width="100%" paddingLeft={1}>
              <For each={props.contacts}>
                {(contact) => (
                  <box flexDirection="row" width="100%">
                    <text content="◈ " fg={theme.accent} />
                    <text content={contact.username.padEnd(20)} fg={theme.text} width={21} />
                    <text content={formatDate(contact.addedAt)} fg={theme.textMuted} width={14} />
                    <box onMouseDown={() => props.onRemoveContact(contact.id)}>
                      <text content=" [X] Remove" fg={theme.error} />
                    </box>
                  </box>
                )}
              </For>
            </scrollbox>
          }
        >
          <box paddingLeft={1}>
            <text content="○ No contacts yet — press [S] to search for users." fg={theme.textMuted} />
          </box>
        </Show>

        <box paddingLeft={1} paddingTop={0}>
          <text content="[E] Edit profile   [S] Search users   [ESC] Close" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );
}

function UserSearchView(props: { onSelectUser: (profile: UserProfile) => void }) {
  const { theme } = useTheme();

  const handleSearchKey = async () => {
    const query = userSearchQuery();
    if (query.length < 2) return;
    
    setUserSearchLoading(true);
    const results = await searchUsers(query);
    setUserSearchResults(results);
    setUserSearchLoading(false);
  };

  return (
    <box flexDirection="column" width="100%">
      <text content="─── USER SEARCH ─────────────────────────────────────────────────" fg={theme.borderSubtle} />
      <box flexDirection="row" paddingLeft={1}>
        <text content="Query: " fg={theme.textMuted} />
        <input
          width={32}
          value={userSearchQuery()}
          focused={true}
        />
        <text content="  " />
        <box onMouseDown={handleSearchKey}>
          <text content="[Enter] Search" fg={theme.accent} />
        </box>
      </box>

      <Show when={userSearchLoading()}>
        <LoadingState message="Searching users…" />
      </Show>

      <Show when={!userSearchLoading() && userSearchResults().length > 0}>
        <text content={`─── RESULTS (${userSearchResults().length}) ──────────────────────────────────────`} fg={theme.borderSubtle} />
        <box flexDirection="row" paddingLeft={1} backgroundColor={theme.backgroundPanel}>
          <text content={"◈ ".padEnd(3)} fg={theme.textMuted} width={3} />
          <text content={"USERNAME".padEnd(20)} fg={theme.textMuted} width={21} />
          <text content="BIO" fg={theme.textMuted} />
        </box>
        <scrollbox height={10} width="100%">
          <For each={userSearchResults()}>
            {(profile) => (
              <box
                flexDirection="row"
                width="100%"
                paddingLeft={1}
                onMouseDown={() => props.onSelectUser(profile)}
              >
                <text content="◈ " fg={theme.accent} width={3} />
                <text content={profile.username.padEnd(20)} fg={theme.text} width={21} />
                <text content={truncate(profile.bio || "—", 30)} fg={theme.textMuted} width={31} />
                <Show when={!isContact(profile.id)}>
                  <box onMouseDown={(e: { stopPropagation: () => void }) => { e.stopPropagation(); addContact(profile); }}>
                    <text content=" [A] Add" fg={theme.success} />
                  </box>
                </Show>
                <Show when={isContact(profile.id)}>
                  <text content=" ✓ Contact" fg={theme.textMuted} />
                </Show>
              </box>
            )}
          </For>
        </scrollbox>
      </Show>

      <Show when={!userSearchLoading() && userSearchQuery().length >= 2 && userSearchResults().length === 0}>
        <box paddingLeft={1} paddingTop={1}>
          <text content="✗ No users found — try a different query." fg={theme.textMuted} />
        </box>
      </Show>

      <Show when={userSearchQuery().length < 2 && !userSearchLoading()}>
        <box paddingLeft={1} paddingTop={1}>
          <text content="Type at least 2 characters to search." fg={theme.textMuted} />
        </box>
      </Show>

      <box paddingLeft={1} paddingTop={1}>
        <text content="[ESC] Back  [S] New Search  [A] Add to Contacts" fg={theme.textMuted} />
      </box>
    </box>
  );
}
