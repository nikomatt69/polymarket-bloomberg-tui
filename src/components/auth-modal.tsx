/**
 * Auth modal component
 * Press G to open. ESC to close.
 * Switch between login/register with TAB.
 */

import { Show } from "solid-js";
import { useTheme } from "../context/theme";
import {
  authModalMode,
  authUsernameInput,
  authEmailInput,
  authPasswordInput,
  authError,
  authLoading,
  setAuthModalOpen,
  setAuthUsernameInput,
  setAuthEmailInput,
  setAuthPasswordInput,
} from "../state";

export function AuthModal() {
  const { theme } = useTheme();

  const handleClose = () => {
    setAuthModalOpen(false);
    setAuthUsernameInput("");
    setAuthEmailInput("");
    setAuthPasswordInput("");
  };

  return (
    <box
      position="absolute"
      top={3}
      left="30%"
      width="40%"
      height={authModalMode() === "login" ? 14 : 16}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ AUTH " fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={handleClose}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.primaryMuted} />

      {/* Body */}
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        {/* Mode indicator */}
        <box flexDirection="row" gap={2}>
          <text
            content={authModalMode() === "login" ? "● LOGIN" : "○ LOGIN"}
            fg={authModalMode() === "login" ? theme.primary : theme.textMuted}
          />
          <text content="|" fg={theme.textMuted} />
          <text
            content={authModalMode() === "register" ? "● REGISTER" : "○ REGISTER"}
            fg={authModalMode() === "register" ? theme.primary : theme.textMuted}
          />
          <text content=" [TAB] to switch" fg={theme.textMuted} />
        </box>

        <box height={1} />

        {/* Username field */}
        <Show when={authModalMode() === "register"}>
          <text content="Username:" fg={theme.textMuted} />
          <input
            width="100%"
            value={authUsernameInput()}
            focused={authModalMode() === "register" && !authUsernameInput()}
            onInput={(v: string) => setAuthUsernameInput(v)}
          />
        </Show>

        {/* Email field (register only) */}
        <Show when={authModalMode() === "register"}>
          <text content="Email:" fg={theme.textMuted} />
          <input
            width="100%"
            value={authEmailInput()}
            focused={authModalMode() === "register" && !!authUsernameInput()}
            onInput={(v: string) => setAuthEmailInput(v)}
          />
        </Show>

        {/* Username for login */}
        <Show when={authModalMode() === "login"}>
          <text content="Username:" fg={theme.textMuted} />
          <input
            width="100%"
            value={authUsernameInput()}
            focused
            onInput={(v: string) => setAuthUsernameInput(v)}
          />
        </Show>

        {/* Password field */}
        <text content="Password:" fg={theme.textMuted} />
        <input
          width="100%"
          value={authPasswordInput()}
          focused={authModalMode() === "login" || (authModalMode() === "register" && !!authEmailInput())}
          onInput={(v: string) => setAuthPasswordInput(v)}
        />

        {/* Error message */}
        <Show when={authError()}>
          <text content={`✗ ${authError()}`} fg={theme.error} />
        </Show>

        {/* Loading indicator */}
        <Show when={authLoading()}>
          <text content="Processing..." fg={theme.warning} />
        </Show>

        <box flexGrow={1} />

        {/* Actions */}
        <box flexDirection="row" gap={3}>
          <text
            content="[ENTER] Submit"
            fg={theme.success}
          />
          <text
            content="[ESC] Cancel"
            fg={theme.textMuted}
          />
        </box>
      </box>
    </box>
  );
}
