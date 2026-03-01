/**
 * SkillsPanel — AI assistant skill manager
 * Load, enable/disable, and add custom skills for the AI assistant.
 * Keyboard handled in app.tsx intercept block.
 */

import { Show, For, createMemo } from "solid-js";
import { useTheme } from "../context/theme";
import {
  skillsPanelOpen,
  setSkillsPanelOpen,
  skills,
  setSkills,
  skillsSelectedIdx,
  setSkillsSelectedIdx,
  skillsPanelMode,
  setSkillsPanelMode,
  skillsAddInput,
  setSkillsAddInput,
  skillsAddField,
} from "../state";
import { saveSkills, createCustomSkill } from "../api/skills";
import type { Skill } from "../api/skills";

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

export function SkillsPanel() {
  const { theme } = useTheme();

  const allSkills = createMemo(() => skills());
  const enabledCount = createMemo(() => allSkills().filter((s) => s.enabled).length);

  function toggleSkill(idx: number) {
    const updated = allSkills().map((s, i) =>
      i === idx ? { ...s, enabled: !s.enabled } : s
    );
    setSkills(updated);
    saveSkills(updated);
  }

  function deleteSkill(idx: number) {
    const skill = allSkills()[idx];
    if (!skill || skill.author === "built-in") return; // can't delete built-in skills
    const updated = allSkills().filter((_, i) => i !== idx);
    setSkills(updated);
    saveSkills(updated);
    if (skillsSelectedIdx() >= updated.length && updated.length > 0) {
      setSkillsSelectedIdx(updated.length - 1);
    }
  }

  const selected = createMemo(() => allSkills()[skillsSelectedIdx()] ?? null);

  return (
    <box
      position="absolute"
      top={1}
      left="4%"
      width="92%"
      height={30}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.accent} flexDirection="row">
        <text content=" ◈ AI SKILLS " fg={theme.highlightText} />
        <box flexGrow={1} />
        <text content={`${enabledCount()}/${allSkills().length} active `} fg={theme.highlightText} />
        <box onMouseDown={() => setSkillsPanelOpen(false)}>
          <text content=" [V] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Tab bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <box onMouseDown={() => setSkillsPanelMode("list")} paddingLeft={1} paddingRight={1}>
          <text content="[1] SKILLS" fg={skillsPanelMode() === "list" ? theme.accent : theme.textMuted} />
        </box>
        <text content="  │  " fg={theme.border} />
        <box onMouseDown={() => { setSkillsPanelMode("add"); setSkillsAddInput({ name: "", description: "", systemPrompt: "" }); }} paddingRight={1}>
          <text content="[+] ADD CUSTOM" fg={skillsPanelMode() === "add" ? theme.accent : theme.textMuted} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

      {/* Skills list mode */}
      <Show when={skillsPanelMode() === "list"}>
        <box flexGrow={1} flexDirection="column" paddingLeft={1}>
          {/* Column headers */}
          <box flexDirection="row" width="100%">
            <text content="   " width={3} fg={theme.textMuted} />
            <text content="EN " width={4} fg={theme.textMuted} />
            <text content="NAME                 " width={22} fg={theme.textMuted} />
            <text content="AUTHOR  " width={10} fg={theme.textMuted} />
            <text content="DESCRIPTION" fg={theme.textMuted} />
          </box>

          <scrollbox height={13} width="100%">
            <For each={allSkills()}>
              {(skill, i) => {
                const isSelected = () => skillsSelectedIdx() === i();
                return (
                  <box
                    flexDirection="row"
                    width="100%"
                    backgroundColor={isSelected() ? theme.highlight : undefined}
                    onMouseDown={() => setSkillsSelectedIdx(i())}
                  >
                    <text content={isSelected() ? " ▶ " : "   "} fg={theme.accent} width={3} />
                    <text
                      content={skill.enabled ? "✓  " : "✗  "}
                      fg={skill.enabled ? theme.success : theme.error}
                      width={4}
                    />
                    <text
                      content={truncate(skill.name, 21).padEnd(21, " ")}
                      fg={isSelected() ? theme.highlightText : (skill.enabled ? theme.text : theme.textMuted)}
                      width={22}
                    />
                    <text
                      content={(skill.author ?? "custom").padEnd(9, " ")}
                      fg={theme.textMuted}
                      width={10}
                    />
                    <text
                      content={truncate(skill.description, 55)}
                      fg={isSelected() ? theme.highlightText : theme.textMuted}
                    />
                  </box>
                );
              }}
            </For>
          </scrollbox>

          {/* Detail view for selected skill */}
          <box height={1} width="100%" backgroundColor={theme.borderSubtle} />
          <box height={10} flexDirection="column" paddingLeft={2} paddingTop={1} paddingRight={2}>
            <Show when={selected()} fallback={<text content="Select a skill with ↑/↓" fg={theme.textMuted} />}>
              {(s: () => Skill) => (
                <>
                  <box flexDirection="row">
                    <text content={s().name} fg={theme.text} />
                    <text content={`  [${s().enabled ? "ENABLED" : "DISABLED"}]`} fg={s().enabled ? theme.success : theme.error} />
                    <Show when={s().author !== "built-in"}>
                      <text content="  [custom — d to delete]" fg={theme.textMuted} />
                    </Show>
                  </box>
                  <box height={1} />
                  <text content={s().description} fg={theme.textMuted} />
                  <box height={1} />
                  <text content="System prompt preview:" fg={theme.primary} />
                  <text content={truncate(s().systemPrompt.split("\n").slice(0, 2).join(" "), 120)} fg={theme.textMuted} />
                </>
              )}
            </Show>
          </box>
        </box>

        {/* Footer */}
        <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={2} flexDirection="row">
          <text content="Space/Enter: toggle  " fg={theme.textMuted} />
          <text content="d: delete custom  " fg={theme.textMuted} />
          <text content="+: add custom  " fg={theme.textMuted} />
          <text content="[V] close" fg={theme.textMuted} />
        </box>
      </Show>

      {/* Add custom skill mode */}
      <Show when={skillsPanelMode() === "add"}>
        <box flexGrow={1} flexDirection="column" paddingLeft={2} paddingTop={1} paddingRight={2}>
          <text content="Create a custom skill for the AI assistant" fg={theme.text} />
          <box height={1} />

          {/* Name field */}
          <box flexDirection="row">
            <text
              content={skillsAddField() === "name" ? "▶ " : "  "}
              fg={theme.accent}
              width={2}
            />
            <text content="Name:          " fg={theme.textMuted} width={16} />
            <text
              content={skillsAddInput().name || "(type name here)"}
              fg={skillsAddInput().name ? theme.text : theme.textMuted}
            />
          </box>
          <box height={1} />

          {/* Description field */}
          <box flexDirection="row">
            <text
              content={skillsAddField() === "description" ? "▶ " : "  "}
              fg={theme.accent}
              width={2}
            />
            <text content="Description:   " fg={theme.textMuted} width={16} />
            <text
              content={skillsAddInput().description || "(type description here)"}
              fg={skillsAddInput().description ? theme.text : theme.textMuted}
            />
          </box>
          <box height={1} />

          {/* System prompt field */}
          <box flexDirection="row">
            <text
              content={skillsAddField() === "systemPrompt" ? "▶ " : "  "}
              fg={theme.accent}
              width={2}
            />
            <text content="System Prompt: " fg={theme.textMuted} width={16} />
          </box>
          <box paddingLeft={4}>
            <text
              content={skillsAddInput().systemPrompt || "(type system prompt instructions for the AI)"}
              fg={skillsAddInput().systemPrompt ? theme.text : theme.textMuted}
            />
          </box>
          <box height={2} />
          <text content="Tab to switch fields · Enter to save · Escape to cancel" fg={theme.textMuted} />
        </box>

        {/* Footer */}
        <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={2} flexDirection="row">
          <text content="Tab: next field  " fg={theme.textMuted} />
          <text content="Enter: save skill  " fg={theme.textMuted} />
          <text content="Escape: cancel" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );
}
