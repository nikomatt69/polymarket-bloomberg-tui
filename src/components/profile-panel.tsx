/**
 * Profile panel — view/edit user profile, search users, manage contacts
 */

import { For, Show, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
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
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ USER PROFILE " fg={theme.highlightText} />
        <box flexGrow={1} />
        <Show when={profileViewMode() === "view"}>
          <box onMouseDown={() => setProfileViewMode("edit")}>
            <text content=" [E] Edit " fg={theme.highlightText} />
          </box>
          <box onMouseDown={() => { setProfileViewMode("search"); loadContacts(); }}>
            <text content=" [S] Search " fg={theme.highlightText} />
          </box>
          <box onMouseDown={handleLogout}>
            <text content=" [L] Logout " fg={theme.error} />
          </box>
        </Show>
        <Show when={profileViewMode() === "edit"}>
          <text content=" EDIT MODE " fg={theme.warning} />
        </Show>
        <Show when={profileViewMode() === "search"}>
          <text content=" USER SEARCH " fg={theme.success} />
        </Show>
        <box onMouseDown={handleClose}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.primaryMuted} />

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
        <text content="Loading profile..." fg={theme.textMuted} />
        <text content="" />
        <box onMouseDown={loadCurrentUserProfile}>
          <text content="[R] Refresh" fg={theme.accent} />
        </box>
        <text content="" />
      </Show>

      <Show when={props.profile}>
        {/* Profile Header */}
        <box flexDirection="row" width="100%">
          <box flexDirection="column" width="30%">
            <text content="AVATAR" fg={theme.textMuted} />
            <text content="" />
            <box
              width={12}
              height={6}
              backgroundColor={theme.highlight}
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
            >
              <text content="👤" />
            </box>
            <Show when={props.isEditing}>
              <text content="" />
              <box onMouseDown={() => props.onStartEdit("avatar")}>
                <text content="[C] Change" fg={theme.accent} />
              </box>
            </Show>
          </box>

          <box flexDirection="column" width="70%" flexGrow={1}>
            <box flexDirection="row">
              <text content="USERNAME" fg={theme.textMuted} width={12} />
              <Show when={!props.isEditing || editingField() !== "username"}>
                <text content={props.profile?.username || "—"} fg={theme.textBright} />
                <Show when={props.isEditing}>
                  <text content="  " />
                  <box onMouseDown={() => props.onStartEdit("username")}>
                    <text content="[E]dit" fg={theme.accent} />
                  </box>
                </Show>
              </Show>
              <Show when={props.isEditing && editingField() === "username"}>
                <input
                  width={20}
                  value={editValue()}
                  focused={true}
                />
                <text content="  " />
                <box onMouseDown={props.onSaveEdit}>
                  <text content="[Enter]Save" fg={theme.success} />
                </box>
              </Show>
            </box>

            <text content="" />

            <box flexDirection="row">
              <text content="EMAIL" fg={theme.textMuted} width={12} />
              <text content={props.profile?.email || "—"} fg={theme.text} />
            </box>

            <text content="" />

            <box flexDirection="row">
              <text content="MEMBER SINCE" fg={theme.textMuted} width={12} />
              <text content={props.profile?.createdAt ? formatDate(props.profile.createdAt) : "—"} fg={theme.text} />
            </box>

            <text content="" />

            <box flexDirection="row">
              <text content="LAST SEEN" fg={theme.textMuted} width={12} />
              <text content={props.profile?.lastSeen ? formatDate(props.profile.lastSeen) : "—"} fg={theme.text} />
            </box>
          </box>
        </box>

        <text content="" />
        <text content={SEPARATOR} fg={theme.textMuted} />
        <text content="" />

        {/* Bio Section */}
        <text content="BIO" fg={theme.textMuted} />
        <text content="" />
        <Show when={!props.isEditing || editingField() !== "bio"}>
          <text content={props.profile?.bio || "No bio set"} fg={theme.text} />
          <Show when={props.isEditing}>
            <text content="" />
            <box onMouseDown={() => props.onStartEdit("bio")}>
              <text content="[E]dit bio" fg={theme.accent} />
            </box>
          </Show>
        </Show>
        <Show when={props.isEditing && editingField() === "bio"}>
          <input
            width={50}
            value={editValue()}
            focused={true}
          />
          <text content="" />
          <box onMouseDown={props.onSaveEdit}>
            <text content="[Enter] Save  [ESC] Cancel" fg={theme.success} />
          </box>
        </Show>

        <text content="" />
        <text content={SEPARATOR} fg={theme.textMuted} />
        <text content="" />

        {/* Contacts Section */}
        <text content="CONTACTS" fg={theme.textMuted} />
        <text content="" />
        <Show when={props.contacts.length === 0}>
          <text content="No contacts yet. Press [S] to search for users." fg={theme.textMuted} />
        </Show>
        <Show when={props.contacts.length > 0}>
          <scrollbox height={6} width="100%">
            <For each={props.contacts}>
              {(contact) => (
                <box flexDirection="row" width="100%">
                  <text content="👤 " fg={theme.accent} />
                  <text content={contact.username.padEnd(20)} fg={theme.text} width={21} />
                  <text content={formatDate(contact.addedAt)} fg={theme.textMuted} />
                  <text content="  " />
                  <box onMouseDown={() => props.onRemoveContact(contact.id)}>
                    <text content="[X] Remove" fg={theme.error} />
                  </box>
                </box>
              )}
            </For>
          </scrollbox>
        </Show>

        <text content="" />
        <text content="[↑↓] Navigate  [ESC] Close" fg={theme.textMuted} />
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
      <text content="Search for users by username" fg={theme.textMuted} />
      <text content="" />
      
      <box flexDirection="row">
        <text content="Search: " fg={theme.text} />
        <input
          width={30}
          value={userSearchQuery()}
          focused={true}
        />
        <text content="  " />
        <box onMouseDown={handleSearchKey}>
          <text content="[Enter] Search" fg={theme.accent} />
        </box>
      </box>

      <text content="" />

      <Show when={userSearchLoading()}>
        <text content="Searching..." fg={theme.warning} />
      </Show>

      <Show when={!userSearchLoading() && userSearchResults().length > 0}>
        <text content={"Found " + userSearchResults().length + " user(s):"} fg={theme.textMuted} />
        <text content="" />
        <scrollbox height={10} width="100%">
          <For each={userSearchResults()}>
            {(profile) => (
              <box
                flexDirection="row"
                width="100%"
                onMouseDown={() => props.onSelectUser(profile)}
              >
                <text content="👤 " fg={theme.accent} />
                <text content={profile.username.padEnd(20)} fg={theme.text} width={21} />
                <text content={truncate(profile.bio || "No bio", 30)} fg={theme.textMuted} width={31} />
                <text content="  " />
                <Show when={!isContact(profile.id)}>
                  <box onMouseDown={(e: { stopPropagation: () => void }) => { e.stopPropagation(); addContact(profile); }}>
                    <text content="[A] Add" fg={theme.success} />
                  </box>
                </Show>
                <Show when={isContact(profile.id)}>
                  <text content="[In contacts]" fg={theme.textMuted} />
                </Show>
              </box>
            )}
          </For>
        </scrollbox>
      </Show>

      <Show when={!userSearchLoading() && userSearchQuery().length >= 2 && userSearchResults().length === 0}>
        <text content="No users found. Try a different search." fg={theme.textMuted} />
      </Show>

      <text content="" />
      <text content="[ESC] Back to profile  [S] Search users" fg={theme.textMuted} />
    </box>
  );
}
