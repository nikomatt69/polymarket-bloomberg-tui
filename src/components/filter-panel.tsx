import { For, Show, createSignal } from "solid-js";
import { vstyles } from "@opentui/core";
import {
  filterState,
  setFilterState,
  filterPanelOpen,
  setFilterPanelOpen,
  savedPresets,
  applyFilterPreset,
  deleteFilterPreset,
  saveFilterPreset,
  clearFilters,
} from "../state";
import { useTheme } from "../context/theme";

export function FilterPanel() {
  const { theme } = useTheme();

  const [presetName, setPresetName] = createSignal("");
  const [activeTab, setActiveTab] = createSignal<"filters" | "presets">("filters");

  const hasActiveFilters = () =>
    filterState.volumeMin !== undefined ||
    filterState.volumeMax !== undefined ||
    filterState.priceMin !== undefined ||
    filterState.priceMax !== undefined ||
    filterState.liquidityMin !== undefined ||
    filterState.category !== undefined;

  const handleSavePreset = () => {
    const name = presetName().trim();
    if (name) {
      saveFilterPreset(name);
      setPresetName("");
    }
  };

  const sortOptions = [
    { value: "volume", label: "Volume" },
    { value: "change", label: "24h Change" },
    { value: "name", label: "Name" },
  ] as const;

  return (
    <box
      position="absolute"
      top={2}
      left={2}
      width={70}
      height={25}
      backgroundColor={theme.backgroundPanel}
      borderStyle="rounded"
      borderColor={theme.primary}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <box height={1} flexDirection="row" paddingX={1} backgroundColor={theme.primary}>
        <text content=" Filters " {...vstyles.bold()} fg={theme.background} />
        <box flexGrow={1} />
        <text content="[L] Close" fg={theme.background} />
      </box>

      {/* Tabs */}
      <box height={1} flexDirection="row" paddingX={1}>
        <box
          paddingX={2}
          backgroundColor={activeTab() === "filters" ? theme.accent : undefined}
          onMouseDown={() => setActiveTab("filters")}
        >
          <text content="Filters" fg={activeTab() === "filters" ? theme.highlightText : theme.textMuted} />
        </box>
        <box paddingX={2} />
        <box
          paddingX={2}
          backgroundColor={activeTab() === "presets" ? theme.accent : undefined}
          onMouseDown={() => setActiveTab("presets")}
        >
          <text content="Presets" fg={activeTab() === "presets" ? theme.highlightText : theme.textMuted} />
        </box>
      </box>

      {/* Content */}
      <Show when={activeTab() === "filters"}>
        <scrollbox flexGrow={1} padding={1}>
          {/* Sort */}
          <box flexDirection="column" marginBottom={1}>
            <text content="Sort" fg={theme.textMuted} />
            <box flexDirection="row">
              <For each={sortOptions}>
                {(opt) => (
                  <box
                    paddingX={1}
                    marginRight={1}
                    backgroundColor={filterState.sortBy === opt.value ? theme.accent : theme.backgroundPanel}
                    onMouseDown={() => setFilterState("sortBy", opt.value)}
                  >
                    <text
                      content={opt.label}
                      fg={filterState.sortBy === opt.value ? theme.highlightText : theme.textMuted}
                    />
                  </box>
                )}
              </For>
            </box>
            <text content="Secondary:" fg={theme.textMuted} />
            <box flexDirection="row">
              <For each={sortOptions}>
                {(opt) => (
                  <box
                    paddingX={1}
                    marginRight={1}
                    backgroundColor={filterState.sortBy2 === opt.value ? theme.accentMuted : theme.backgroundPanel}
                    onMouseDown={() => setFilterState("sortBy2", opt.value === filterState.sortBy2 ? undefined : opt.value)}
                  >
                    <text
                      content={opt.label}
                      fg={filterState.sortBy2 === opt.value ? theme.highlightText : theme.textMuted}
                    />
                  </box>
                )}
              </For>
              <text content=" [X] Clear" fg={theme.textMuted} onMouseDown={() => setFilterState("sortBy2", undefined)} />
            </box>
          </box>

          {/* Volume Range */}
          <box flexDirection="column" marginBottom={1}>
            <text content="Volume Range" fg={theme.textMuted} />
            <box flexDirection="row">
              <text content="Min: " fg={theme.textMuted} />
              <input
                width={10}
                value={filterState.volumeMin?.toString() ?? ""}
                onInput={(v: string) => {
                  const num = parseFloat(v);
                  setFilterState("volumeMin", isNaN(num) ? undefined : num);
                }}
                placeholder="e.g. 10000"
              />
              <text content="  Max: " fg={theme.textMuted} />
              <input
                width={10}
                value={filterState.volumeMax?.toString() ?? ""}
                onInput={(v: string) => {
                  const num = parseFloat(v);
                  setFilterState("volumeMax", isNaN(num) ? undefined : num);
                }}
                placeholder="e.g. 1000000"
              />
            </box>
          </box>

          {/* Price Range */}
          <box flexDirection="column" marginBottom={1}>
            <text content="Price Range (0-1)" fg={theme.textMuted} />
            <box flexDirection="row">
              <text content="Min: " fg={theme.textMuted} />
              <input
                width={6}
                value={filterState.priceMin?.toString() ?? ""}
                onInput={(v: string) => {
                  const num = parseFloat(v);
                  setFilterState("priceMin", isNaN(num) ? undefined : Math.max(0, Math.min(1, num)));
                }}
                placeholder="0.0"
              />
              <text content="  Max: " fg={theme.textMuted} />
              <input
                width={6}
                value={filterState.priceMax?.toString() ?? ""}
                onInput={(v: string) => {
                  const num = parseFloat(v);
                  setFilterState("priceMax", isNaN(num) ? undefined : Math.max(0, Math.min(1, num)));
                }}
                placeholder="1.0"
              />
            </box>
          </box>

          {/* Liquidity */}
          <box flexDirection="column" marginBottom={1}>
            <text content="Min Liquidity" fg={theme.textMuted} />
            <box flexDirection="row">
              <input
                width={12}
                value={filterState.liquidityMin?.toString() ?? ""}
                onInput={(v: string) => {
                  const num = parseFloat(v);
                  setFilterState("liquidityMin", isNaN(num) ? undefined : num);
                }}
                placeholder="e.g. 5000"
              />
            </box>
          </box>

          {/* Category */}
          <box flexDirection="column" marginBottom={1}>
            <text content="Category" fg={theme.textMuted} />
            <box flexDirection="row">
              <input
                width={15}
                value={filterState.category ?? ""}
                onInput={(v: string) => {
                  setFilterState("category", v.trim() || undefined);
                }}
                placeholder="e.g. politics, crypto"
              />
            </box>
          </box>

          {/* Actions */}
          <box flexDirection="row" marginTop={1}>
            <box
              paddingX={2}
              paddingY={1}
              backgroundColor={theme.success}
              marginRight={1}
              onMouseDown={clearFilters}
            >
              <text content="Clear All" fg={theme.background} />
            </box>
            <box
              paddingX={2}
              paddingY={1}
              backgroundColor={theme.primary}
              onMouseDown={handleSavePreset}
            >
              <text content="Save Preset" fg={theme.background} />
            </box>
            <input
              width={15}
              value={presetName()}
              onInput={(v: string) => setPresetName(v)}
              placeholder="Preset name"
            />
          </box>
        </scrollbox>
      </Show>

      <Show when={activeTab() === "presets"}>
        <scrollbox flexGrow={1} padding={1}>
          <Show
            when={savedPresets.length > 0}
            fallback={
              <text content="No saved presets. Save filters to create one." fg={theme.textMuted} />
            }
          >
            <For each={savedPresets}>
              {(preset) => (
                <box flexDirection="row" marginBottom={1}>
                  <box
                    flexGrow={1}
                    paddingX={1}
                    backgroundColor={filterState.activePresetId === preset.id ? theme.accent : theme.backgroundPanel}
                    onMouseDown={() => applyFilterPreset(preset.id)}
                  >
                    <text
                      content={preset.name}
                      fg={filterState.activePresetId === preset.id ? theme.highlightText : theme.text}
                    />
                  </box>
                  <text content=" [X]" fg={theme.error} onMouseDown={() => deleteFilterPreset(preset.id)} />
                </box>
              )}
            </For>
          </Show>
        </scrollbox>
      </Show>

      {/* Help */}
      <box height={1} paddingX={1} backgroundColor={theme.backgroundPanel}>
        <text
          content="Search: vol:>100K price:0.3-0.7 cat:politics liq:>5000"
          fg={theme.textMuted}
        />
      </box>
    </box>
  );
}
