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
import { PanelHeader, Separator } from "./ui/panel-components";

export function AuthModal() {
  const { theme } = useTheme();

  const handleClose = () => {
    setAuthModalOpen(false);
    setAuthUsernameInput("");
    setAuthEmailInput("");
    setAuthPasswordInput("");
  };

  const sLine = (label: string) => `─── ${label} ` + "─".repeat(Math.max(0, 28 - label.length - 5));

  return (
    <box
      position="absolute"
      top={3}
      left="30%"
      width="40%"
      height={authModalMode() === "login" ? 15 : 18}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <PanelHeader
        title="ACCOUNT AUTH"
        icon="◈"
        subtitle={authModalMode() === "login" ? "Sign In" : "New Account"}
        onClose={handleClose}
      />

      {/* Mode tab bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={authModalMode() === "login" ? theme.primary : undefined}
          onMouseDown={() => { setAuthModalOpen(true); }}
        >
          <text
            content="LOGIN"
            fg={authModalMode() === "login" ? theme.highlightText : theme.textMuted}
          />
        </box>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={authModalMode() === "register" ? theme.primary : undefined}
        >
          <text
            content="REGISTER"
            fg={authModalMode() === "register" ? theme.highlightText : theme.textMuted}
          />
        </box>
        <box flexGrow={1} />
        <text content="[Tab] switch  " fg={theme.textMuted} />
      </box>

      <Separator type="heavy" />

      {/* Body */}
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <text content={sLine("CREDENTIALS")} fg={theme.borderSubtle} />

        {/* Register-only: Username */}
        <Show when={authModalMode() === "register"}>
          <box flexDirection="row" paddingTop={1}>
            <text content="Username : " fg={theme.textMuted} width={11} />
            <input
              width="80%"
              value={authUsernameInput()}
              focused={authModalMode() === "register" && !authUsernameInput()}
              onInput={(v: string) => setAuthUsernameInput(v)}
            />
          </box>
          <box flexDirection="row">
            <text content="Email    : " fg={theme.textMuted} width={11} />
            <input
              width="80%"
              value={authEmailInput()}
              focused={authModalMode() === "register" && !!authUsernameInput() && !authEmailInput()}
              onInput={(v: string) => setAuthEmailInput(v)}
            />
          </box>
        </Show>

        {/* Login: Username */}
        <Show when={authModalMode() === "login"}>
          <box flexDirection="row" paddingTop={1}>
            <text content="Username : " fg={theme.textMuted} width={11} />
            <input
              width="80%"
              value={authUsernameInput()}
              focused
              onInput={(v: string) => setAuthUsernameInput(v)}
            />
          </box>
        </Show>

        {/* Password — both modes */}
        <box flexDirection="row">
          <text content="Password : " fg={theme.textMuted} width={11} />
          <input
            width="80%"
            value={authPasswordInput()}
            focused={authModalMode() === "login"
              ? !!authUsernameInput()
              : !!authEmailInput()}
            onInput={(v: string) => setAuthPasswordInput(v)}
          />
        </box>

        {/* Status */}
        <Show when={authError()}>
          <text content="" />
          <text content={`● ${authError()}`} fg={theme.error} />
        </Show>
        <Show when={authLoading()}>
          <text content="" />
          <text content="◌ Processing…" fg={theme.warning} />
        </Show>

        <box flexGrow={1} />

        {/* Footer actions */}
        <Separator type="light" />
        <box flexDirection="row" paddingTop={1} gap={3}>
          <box backgroundColor={theme.success} paddingLeft={1} paddingRight={1}>
            <text content="[Enter] Submit" fg={theme.background} />
          </box>
          <text content="[ESC] Cancel" fg={theme.textMuted} />
        </box>
      </box>
    </box>
  );
}
