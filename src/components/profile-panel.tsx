/**
 * Profile panel — view/edit user profile, search users, manage contacts
 */

import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { useTheme } from "../context/theme";
import { PanelHeader, Separator, DataRow, LoadingState } from "./ui/panel-components";
import {
  profilePanelOpen,
  setProfilePanelOpen,
  profileViewMode,
  setProfileViewMode,
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
  walletState,
} from "../state";
import { getCurrentUser, updateProfile, searchUsers, getUserById } from "../api/users";
import { UserProfile, UserContact } from "../types/user";
import { logoutUser } from "../auth/auth";
import { positionsState } from "../hooks/usePositions";
import { ordersState } from "../hooks/useOrders";
import { calculatePortfolioSummary } from "../api/positions";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";

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

function shortAddress(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getProfileContactsPath(): string {
  const configDir = join(homedir(), ".polymarket-tui");
  try {
    mkdirSync(configDir, { recursive: true });
  } catch {
    // directory already exists
  }
  return join(configDir, "contacts.json");
}

interface StoredContacts {
  contacts: UserContact[];
}

export async function loadCurrentUserProfile(): Promise<void> {
  const user = await getCurrentUser();
  setCurrentUserProfile(user);
}

export async function loadContacts(): Promise<void> {
  try {
    const path = getProfileContactsPath();
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as StoredContacts | UserContact[];
    const contacts = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.contacts)
        ? parsed.contacts
        : [];
    setContactsList(contacts);
  } catch {
    setContactsList([]);
  }
}

function saveContacts(contacts: UserContact[]): void {
  try {
    const path = getProfileContactsPath();
    const payload: StoredContacts = { contacts };
    writeFileSync(path, JSON.stringify(payload, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error("Failed to save contacts:", error);
  }
}

function addContact(profile: UserProfile): void {
  if (isContact(profile.id)) return;

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
  const [selectedUserProfile, setSelectedUserProfile] = createSignal<UserProfile | null>(null);

  const activeProfile = createMemo<UserProfile | null>(() => {
    const selectedId = selectedProfileId();
    if (!selectedId) return currentUserProfile();
    const selected = selectedUserProfile();
    if (selected && selected.id === selectedId) return selected;
    return currentUserProfile();
  });

  const isOwnProfile = createMemo(() => {
    const profile = activeProfile();
    if (!profile) return true;
    if (authState.user?.id) return profile.id === authState.user.id;
    return profile.id === currentUserProfile()?.id;
  });

  const accountSnapshot = createMemo(() => {
    const summary = calculatePortfolioSummary(positionsState.positions);
    return {
      walletAddress: walletState.address,
      walletConnected: walletState.connected,
      cashBalance: walletState.balance,
      positionsCount: summary.positionCount,
      positionsValue: summary.totalValue,
      totalPnl: summary.totalCashPnl,
      openOrdersCount: ordersState.openOrders.length,
      tradeCount: ordersState.tradeHistory.length,
      authUsername: authState.user?.username ?? null,
      authEmail: authState.user?.email ?? null,
    };
  });

  const panelSubtitle = createMemo(() => {
    if (profileViewMode() === "search") return "USER SEARCH";
    if (profileViewMode() === "edit") return "EDIT PROFILE";
    const profile = activeProfile();
    if (!profile) return undefined;
    return isOwnProfile() ? `@${profile.username} (YOU)` : `@${profile.username}`;
  });

  createEffect(() => {
    if (profilePanelOpen()) {
      loadCurrentUserProfile();
      loadContacts();
    }
  });

  createEffect(() => {
    const selectedId = selectedProfileId();
    if (!profilePanelOpen() || !selectedId) {
      setSelectedUserProfile(null);
      return;
    }

    getUserById(selectedId).then((profile) => {
      if (selectedProfileId() === selectedId) {
        setSelectedUserProfile(profile);
      }
    }).catch(() => {
      if (selectedProfileId() === selectedId) {
        setSelectedUserProfile(null);
      }
    });
  });

  const openSearchMode = () => {
    setProfileViewMode("search");
    setUserSearchOpen(false);
    setUserSearchQuery("");
    setUserSearchResults([]);
  };

  const showMyProfile = () => {
    setSelectedProfileId(null);
    setSelectedUserProfile(null);
    setProfileViewMode("view");
  };

  const handleClose = () => {
    setProfilePanelOpen(false);
    setProfileViewMode("view");
    setUserSearchOpen(false);
    setUserSearchQuery("");
    setUserSearchResults([]);
    setSelectedProfileId(null);
    setSelectedUserProfile(null);
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
    if (!isOwnProfile()) return;
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
        subtitle={panelSubtitle()}
        onClose={handleClose}
      >
        <Show when={profileViewMode() === "view" && isOwnProfile() && activeProfile()}>
          <box onMouseDown={() => setProfileViewMode("edit")}>
            <text content=" [E] Edit " fg={theme.primaryMuted} />
          </box>
          <box onMouseDown={openSearchMode}>
            <text content=" [S] Users " fg={theme.primaryMuted} />
          </box>
          <box onMouseDown={handleLogout}>
            <text content=" [L] Logout " fg={theme.error} />
          </box>
        </Show>

        <Show when={profileViewMode() === "view" && !isOwnProfile() && activeProfile()}>
          <box onMouseDown={showMyProfile}>
            <text content=" [M] Mine " fg={theme.primaryMuted} />
          </box>
          <box onMouseDown={openSearchMode}>
            <text content=" [S] Users " fg={theme.primaryMuted} />
          </box>
          <Show when={!isContact(activeProfile()!.id)}>
            <box onMouseDown={() => activeProfile() && addContact(activeProfile()!)}>
              <text content=" [A] Add " fg={theme.success} />
            </box>
          </Show>
          <Show when={isContact(activeProfile()!.id)}>
            <box onMouseDown={() => activeProfile() && removeContact(activeProfile()!.id)}>
              <text content=" [R] Remove " fg={theme.warning} />
            </box>
          </Show>
        </Show>

        <Show when={profileViewMode() === "edit"}>
          <box onMouseDown={() => setProfileViewMode("view")}>
            <text content=" [V] View " fg={theme.primaryMuted} />
          </box>
          <box onMouseDown={openSearchMode}>
            <text content=" [S] Users " fg={theme.primaryMuted} />
          </box>
        </Show>

        <Show when={profileViewMode() === "search"}>
          <box onMouseDown={showMyProfile}>
            <text content=" [M] Mine " fg={theme.primaryMuted} />
          </box>
        </Show>

        <Show when={profileViewMode() === "view" && !activeProfile()}>
          <box onMouseDown={() => { setAuthModalMode("login"); setAuthModalOpen(true); }}>
            <text content=" [G] Login " fg={theme.success} />
          </box>
        </Show>
      </PanelHeader>

      <Separator type="heavy" />

      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
        <Show when={profileViewMode() === "view" || profileViewMode() === "edit"}>
          <ProfileViewEdit
            profile={activeProfile()}
            isEditing={profileViewMode() === "edit"}
            isOwnProfile={isOwnProfile()}
            snapshot={accountSnapshot()}
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
              setSelectedUserProfile(profile);
              setProfileViewMode("view");
              setUserSearchOpen(false);
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
  isOwnProfile: boolean;
  snapshot: {
    walletAddress: string | null;
    walletConnected: boolean;
    cashBalance: number;
    positionsCount: number;
    positionsValue: number;
    totalPnl: number;
    openOrdersCount: number;
    tradeCount: number;
    authUsername: string | null;
    authEmail: string | null;
  };
  onStartEdit: (field: "username" | "bio" | "avatar") => void;
  onSaveEdit: () => void;
  contacts: UserContact[];
  onAddContact: (profile: UserProfile) => void;
  onRemoveContact: (userId: string) => void;
  isContact: (userId: string) => boolean;
}) {
  const { theme } = useTheme();
  const pnlColor = () => (props.snapshot.totalPnl >= 0 ? theme.success : theme.error);
  const pnlLabel = () => `${props.snapshot.totalPnl >= 0 ? "+" : ""}$${props.snapshot.totalPnl.toFixed(2)}`;

  return (
    <box flexDirection="column" width="100%">
      <Show when={!props.profile}>
        <box flexDirection="column" paddingLeft={1} paddingTop={1}>
          <text content="No authenticated user profile found." fg={theme.warning} />
          <text content="" />
          <text content="Open auth panel to sign in and load account info." fg={theme.textMuted} />
          <box paddingTop={1} flexDirection="row">
            <box onMouseDown={() => { setAuthModalMode("login"); setAuthModalOpen(true); }}>
              <text content="[G] Login" fg={theme.success} />
            </box>
            <text content="  " />
            <box onMouseDown={loadCurrentUserProfile}>
              <text content="[R] Retry" fg={theme.accent} />
            </box>
          </box>
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
            <Show when={props.isEditing && props.isOwnProfile}>
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
                <Show when={props.isEditing && props.isOwnProfile}>
                  <text content="  " />
                  <box onMouseDown={() => props.onStartEdit("username")}>
                    <text content="[E] Edit" fg={theme.accent} />
                  </box>
                </Show>
              </Show>
              <Show when={props.isEditing && props.isOwnProfile && editingField() === "username"}>
                <input width={20} value={editValue()} onInput={setEditValue} focused={true} />
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
            <Show when={props.isOwnProfile && props.snapshot.authUsername}>
              <box flexDirection="row">
                <text content="Account : " fg={theme.textMuted} />
                <text content={props.snapshot.authUsername || "—"} fg={theme.text} />
                <Show when={props.snapshot.authEmail}>
                  <text content={` (${props.snapshot.authEmail})`} fg={theme.textMuted} />
                </Show>
              </box>
            </Show>
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

        <Show when={props.isOwnProfile}>
          <text content="─── ACCOUNT SNAPSHOT ───────────────────────────────────────────" fg={theme.borderSubtle} />
          <box flexDirection="row" width="100%" gap={2} paddingLeft={1}>
            <box width="33%" flexDirection="column">
              <DataRow
                label="Wallet"
                value={props.snapshot.walletConnected ? shortAddress(props.snapshot.walletAddress) : "Disconnected"}
                valueColor={props.snapshot.walletConnected ? "success" : "warning"}
                compact
              />
              <DataRow label="Cash" value={`$${props.snapshot.cashBalance.toFixed(2)}`} compact />
              <DataRow label="Positions" value={`${props.snapshot.positionsCount}`} compact />
            </box>

            <box width="33%" flexDirection="column">
              <DataRow label="Position Val" value={`$${props.snapshot.positionsValue.toFixed(2)}`} compact />
              <DataRow label="Open Orders" value={`${props.snapshot.openOrdersCount}`} compact />
              <DataRow label="Trade Count" value={`${props.snapshot.tradeCount}`} compact />
            </box>

            <box width="33%" flexDirection="column">
              <box flexDirection="row">
                <text content="Total P&L " fg={theme.textMuted} />
                <text content={props.snapshot.totalPnl >= 0 ? "▲ " : "▼ "} fg={pnlColor()} />
                <text content={pnlLabel()} fg={pnlColor()} />
              </box>
              <box flexDirection="row">
                <text content="Status    " fg={theme.textMuted} />
                <text content={props.snapshot.totalPnl >= 0 ? "● PROFIT" : "● LOSS"} fg={pnlColor()} />
              </box>
            </box>
          </box>
        </Show>

        {/* Bio Section */}
        <text content="─── BIO ─────────────────────────────────────────────────────────" fg={theme.borderSubtle} />
        <Show when={!props.isEditing || editingField() !== "bio" || !props.isOwnProfile}>
          <box paddingLeft={1}>
            <text content={props.profile!.bio || "○ No bio set"} fg={props.profile!.bio ? theme.text : theme.textMuted} />
          </box>
          <Show when={props.isEditing && props.isOwnProfile}>
            <box paddingLeft={1} paddingTop={0} onMouseDown={() => props.onStartEdit("bio")}>
              <text content="[E] Edit Bio" fg={theme.accent} />
            </box>
          </Show>
        </Show>
        <Show when={props.isEditing && props.isOwnProfile && editingField() === "bio"}>
          <box paddingLeft={1}>
            <input width={50} value={editValue()} onInput={setEditValue} focused={true} />
          </box>
          <box paddingLeft={1} paddingTop={0} onMouseDown={props.onSaveEdit}>
            <text content="[Enter] Save  [ESC] Cancel" fg={theme.success} />
          </box>
        </Show>

        <Show when={!props.isOwnProfile}>
          <box paddingLeft={1} paddingTop={0}>
            <Show
              when={props.isContact(props.profile!.id)}
              fallback={
                <box onMouseDown={() => props.onAddContact(props.profile!)}>
                  <text content="[A] Add this user to contacts" fg={theme.success} />
                </box>
              }
            >
              <box onMouseDown={() => props.onRemoveContact(props.profile!.id)}>
                <text content="[R] Remove from contacts" fg={theme.warning} />
              </box>
            </Show>
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
          <Show
            when={props.isOwnProfile}
            fallback={<text content="[M] Mine   [S] Search users   [X/ESC] Close" fg={theme.textMuted} />}
          >
            <text content="[E] Edit profile   [S] Search users   [X/ESC] Close" fg={theme.textMuted} />
          </Show>
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
          onInput={setUserSearchQuery}
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
          <text content={"USERNAME".padEnd(16)} fg={theme.textMuted} width={17} />
          <text content={"EMAIL".padEnd(22)} fg={theme.textMuted} width={23} />
          <text content={"LAST".padEnd(12)} fg={theme.textMuted} width={13} />
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
                <text content={truncate(profile.username, 16).padEnd(16)} fg={theme.text} width={17} />
                <text content={truncate(profile.email || "—", 22).padEnd(22)} fg={theme.textMuted} width={23} />
                <text content={truncate(profile.lastSeen ? formatDate(profile.lastSeen) : "—", 12).padEnd(12)} fg={theme.textMuted} width={13} />
                <text content={truncate(profile.bio || "—", 22)} fg={theme.textMuted} width={23} />
                <Show when={!isContact(profile.id)}>
                  <box onMouseDown={(e: { stopPropagation: () => void }) => { e.stopPropagation(); addContact(profile); }}>
                    <text content=" [A] Add" fg={theme.success} />
                  </box>
                </Show>
                <Show when={isContact(profile.id)}>
                  <text content=" ● Contact" fg={theme.success} />
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
