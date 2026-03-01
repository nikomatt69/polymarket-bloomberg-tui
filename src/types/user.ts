/**
 * User profile types
 */

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  bio?: string;
  avatar?: string;
  createdAt: string;
  lastSeen: string;
}

export interface UserContact {
  id: string;
  username: string;
  avatar?: string;
  addedAt: string;
}

export interface ProfileState {
  profilePanelOpen: boolean;
  profileViewMode: "view" | "edit" | "search";
  userSearchOpen: boolean;
  userSearchQuery: string;
  userSearchResults: UserProfile[];
  userSearchLoading: boolean;
  selectedProfileId: string | null;
  contacts: UserContact[];
  editingField: "username" | "bio" | "avatar" | null;
  editValue: string;
}

export interface PersistedProfileData {
  userProfile?: Partial<UserProfile>;
  contacts?: UserContact[];
}
