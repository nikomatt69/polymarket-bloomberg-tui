import { For, Show, createSignal } from "solid-js";
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
import { PanelHeader, Separator } from "./ui/panel-components";

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
    { value: "change", label: "24h Chg" },
    { value: "name", label: "Name" },
  ] as const;

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <PanelHeader
        title="MARKET FILTERS"
        icon="◈"
        subtitle={hasActiveFilters() ? "FILTERS ACTIVE" : undefined}
        onClose={() => setFilterPanelOpen(false)}
      />

      {/* Tab bar */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel}>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={activeTab() === "filters" ? theme.primary : undefined}
          onMouseDown={() => setActiveTab("filters")}
        >
          <text
            content=" FILTERS "
            fg={activeTab() === "filters" ? theme.highlightText : theme.textMuted}
          />
        </box>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={activeTab() === "presets" ? theme.primary : undefined}
          onMouseDown={() => setActiveTab("presets")}
        >
          <text
            content={` PRESETS (${savedPresets.length}) `}
            fg={activeTab() === "presets" ? theme.highlightText : theme.textMuted}
          />
        </box>
      </box>

      <Separator type="heavy" />

      {/* Content */}
      <Show when={activeTab() === "filters"}>
        <scrollbox flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>

          {/* Sort */}
          <box flexDirection="column">
            <text content="─── PRIMARY SORT ──────────────────────────────" fg={theme.borderSubtle} />
            <box flexDirection="row" paddingTop={0}>
              <For each={sortOptions}>
                {(opt) => (
                  <box
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={filterState.sortBy === opt.value ? theme.primary : undefined}
                    onMouseDown={() => setFilterState("sortBy", opt.value)}
                  >
                    <text
                      content={` ${opt.label} `}
                      fg={filterState.sortBy === opt.value ? theme.highlightText : theme.textMuted}
                    />
                  </box>
                )}
              </For>
            </box>
            <text content="" />
            <text content="─── SECONDARY SORT ─────────────────────────────" fg={theme.borderSubtle} />
            <box flexDirection="row">
              <For each={sortOptions}>
                {(opt) => (
                  <box
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={filterState.sortBy2 === opt.value ? theme.accentMuted : undefined}
                    onMouseDown={() => setFilterState("sortBy2", opt.value === filterState.sortBy2 ? undefined : opt.value)}
                  >
                    <text
                      content={` ${opt.label} `}
                      fg={filterState.sortBy2 === opt.value ? theme.highlightText : theme.textMuted}
                    />
                  </box>
                )}
              </For>
              <box paddingLeft={1} onMouseDown={() => setFilterState("sortBy2", undefined)}>
                <text content=" [X] Clear " fg={theme.textMuted} />
              </box>
            </box>
          </box>

          <text content="" />

          {/* Volume Range */}
          <text content="─── VOLUME RANGE ───────────────────────────────" fg={theme.borderSubtle} />
          <box flexDirection="row" paddingTop={0}>
            <text content="Min: $" fg={theme.textMuted} />
            <input
              width={10}
              value={filterState.volumeMin?.toString() ?? ""}
              onInput={(v: string) => {
                const num = parseFloat(v);
                setFilterState("volumeMin", isNaN(num) ? undefined : num);
              }}
              placeholder="10000"
            />
            <text content="   Max: $" fg={theme.textMuted} />
            <input
              width={10}
              value={filterState.volumeMax?.toString() ?? ""}
              onInput={(v: string) => {
                const num = parseFloat(v);
                setFilterState("volumeMax", isNaN(num) ? undefined : num);
              }}
              placeholder="1000000"
            />
          </box>

          <text content="" />

          {/* Price Range */}
          <text content="─── PROBABILITY RANGE (0–1) ────────────────────" fg={theme.borderSubtle} />
          <box flexDirection="row" paddingTop={0}>
            <text content="Min: " fg={theme.textMuted} />
            <input
              width={7}
              value={filterState.priceMin?.toString() ?? ""}
              onInput={(v: string) => {
                const num = parseFloat(v);
                setFilterState("priceMin", isNaN(num) ? undefined : Math.max(0, Math.min(1, num)));
              }}
              placeholder="0.0"
            />
            <text content="   Max: " fg={theme.textMuted} />
            <input
              width={7}
              value={filterState.priceMax?.toString() ?? ""}
              onInput={(v: string) => {
                const num = parseFloat(v);
                setFilterState("priceMax", isNaN(num) ? undefined : Math.max(0, Math.min(1, num)));
              }}
              placeholder="1.0"
            />
          </box>

          <text content="" />

          {/* Liquidity */}
          <text content="─── MIN LIQUIDITY ──────────────────────────────" fg={theme.borderSubtle} />
          <box flexDirection="row" paddingTop={0}>
            <text content="Min: $" fg={theme.textMuted} />
            <input
              width={14}
              value={filterState.liquidityMin?.toString() ?? ""}
              onInput={(v: string) => {
                const num = parseFloat(v);
                setFilterState("liquidityMin", isNaN(num) ? undefined : num);
              }}
              placeholder="5000"
            />
          </box>

          <text content="" />

          {/* Category */}
          <text content="─── CATEGORY FILTER ────────────────────────────" fg={theme.borderSubtle} />
          <box flexDirection="row" paddingTop={0}>
            <text content="Tag: " fg={theme.textMuted} />
            <input
              width={18}
              value={filterState.category ?? ""}
              onInput={(v: string) => {
                setFilterState("category", v.trim() || undefined);
              }}
              placeholder="politics, crypto…"
            />
          </box>

          <text content="" />

          {/* Actions */}
          <text content="─── ACTIONS ────────────────────────────────────" fg={theme.borderSubtle} />
          <box flexDirection="row" paddingTop={0}>
            <box
              paddingLeft={2}
              paddingRight={2}
              backgroundColor={theme.error}
              onMouseDown={clearFilters}
            >
              <text content=" Clear All " fg={theme.highlightText} />
            </box>
            <text content="   " />
            <input
              width={15}
              value={presetName()}
              onInput={(v: string) => setPresetName(v)}
              placeholder="Preset name…"
            />
            <text content=" " />
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={theme.primary}
              onMouseDown={handleSavePreset}
            >
              <text content=" Save Preset " fg={theme.highlightText} />
            </box>
          </box>
        </scrollbox>
      </Show>

      <Show when={activeTab() === "presets"}>
        <scrollbox flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
          <Show
            when={savedPresets.length > 0}
            fallback={
              <box>
                <text content="No saved presets." fg={theme.textMuted} />
                <text content="" />
                <text content="Switch to FILTERS tab, configure filters, then save a preset." fg={theme.textMuted} />
              </box>
            }
          >
            <text content="─── SAVED PRESETS ──────────────────────────────" fg={theme.borderSubtle} />
            <For each={savedPresets}>
              {(preset) => (
                <box flexDirection="row">
                  <box
                    flexGrow={1}
                    paddingLeft={1}
                    backgroundColor={filterState.activePresetId === preset.id ? theme.primary : undefined}
                    onMouseDown={() => applyFilterPreset(preset.id)}
                  >
                    <text
                      content={filterState.activePresetId === preset.id ? `▶ ${preset.name}` : `  ${preset.name}`}
                      fg={filterState.activePresetId === preset.id ? theme.highlightText : theme.text}
                    />
                  </box>
                  <box paddingLeft={1} onMouseDown={() => deleteFilterPreset(preset.id)}>
                    <text content="[X]" fg={theme.error} />
                  </box>
                </box>
              )}
            </For>
          </Show>
        </scrollbox>
      </Show>

      {/* Help */}
      <Separator type="light" />
      <box height={1} paddingLeft={2} backgroundColor={theme.backgroundPanel}>
        <text
          content="Search syntax: vol:>100K  price:0.3-0.7  cat:politics  liq:>5000"
          fg={theme.textMuted}
        />
      </box>
    </box>
  );
}
