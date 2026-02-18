import { RGBA } from "@opentui/core";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { createContext, createMemo, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { loadPersistedThemePreferences, savePersistedThemePreferences } from "../state";

export interface ThemeColors {
  background: RGBA;
  backgroundPanel: RGBA;
  panelModal: RGBA;
  text: RGBA;
  textMuted: RGBA;
  textBright: RGBA;
  primary: RGBA;
  primaryMuted: RGBA;
  accent: RGBA;
  accentMuted: RGBA;
  success: RGBA;
  successMuted: RGBA;
  warning: RGBA;
  warningMuted: RGBA;
  error: RGBA;
  errorMuted: RGBA;
  border: RGBA;
  borderSubtle: RGBA;
  highlight: RGBA;
  highlightText: RGBA;
}

export type ThemeMode = "dark" | "light";

type ThemeVariant = {
  dark: ThemeValue;
  light: ThemeValue;
};

type ThemeValue = string | number | RGBA | ThemeVariant;

interface ThemeJson {
  defs?: Record<string, ThemeValue>;
  theme: Record<string, ThemeValue>;
}

interface ThemeState {
  mode: ThemeMode;
  themeName: string;
  themes: Record<string, ThemeJson>;
}

interface ThemeContextValue {
  state: ThemeState;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setTheme: (themeName: string) => void;
  cycleTheme: (direction?: 1 | -1) => void;
  reloadThemes: () => void;
  theme: ThemeColors;
  mode: ThemeMode;
  themeName: string;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextValue>();

const WHITE = RGBA.fromInts(255, 255, 255);
const BLACK = RGBA.fromInts(0, 0, 0);

const NIKCLI_THEME_DIR = "/Volumes/SSD/Projects/nikcli/packages/nikcli/src/cli/cmd/tui/context/theme";
const FALLBACK_THEME_NAME = "nikcli";

const DEFAULT_THEME_JSON: ThemeJson = {
  theme: {
    primary: {
      dark: "#f5a623",
      light: "#d97706",
    },
    secondary: {
      dark: "#7d5512",
      light: "#fef3c7",
    },
    accent: {
      dark: "#22c55e",
      light: "#059669",
    },
    error: {
      dark: "#ef4444",
      light: "#dc2626",
    },
    warning: {
      dark: "#f59e0b",
      light: "#d97706",
    },
    success: {
      dark: "#22c55e",
      light: "#059669",
    },
    info: {
      dark: "#06b6d4",
      light: "#0284c7",
    },
    text: {
      dark: "#e0e0e0",
      light: "#1f2937",
    },
    textMuted: {
      dark: "#6b7280",
      light: "#6b7280",
    },
    selectedListItemText: {
      dark: "#0d0d0d",
      light: "#ffffff",
    },
    background: {
      dark: "#0d0d0d",
      light: "#ffffff",
    },
    backgroundPanel: {
      dark: "#161616",
      light: "#f3f4f6",
    },
    backgroundElement: {
      dark: "#1c1e1e",
      light: "#ffffff",
    },
    backgroundMenu: {
      dark: "#1c1e1e",
      light: "#ffffff",
    },
    border: {
      dark: "#2d2d2d",
      light: "#d1d5db",
    },
    borderActive: {
      dark: "#7d5512",
      light: "#fef3c7",
    },
    borderSubtle: {
      dark: "#1f1f1f",
      light: "#e5e7eb",
    },
    diffAdded: {
      dark: "#22c55e",
      light: "#059669",
    },
    diffRemoved: {
      dark: "#ef4444",
      light: "#dc2626",
    },
    diffContext: {
      dark: "#6b7280",
      light: "#6b7280",
    },
    diffHunkHeader: {
      dark: "#f5a623",
      light: "#d97706",
    },
    diffHighlightAdded: {
      dark: "#22c55e",
      light: "#059669",
    },
    diffHighlightRemoved: {
      dark: "#ef4444",
      light: "#dc2626",
    },
    diffAddedBg: {
      dark: "#16321f",
      light: "#d1fae5",
    },
    diffRemovedBg: {
      dark: "#3a1717",
      light: "#fee2e2",
    },
    diffContextBg: {
      dark: "#161616",
      light: "#f3f4f6",
    },
    diffLineNumber: {
      dark: "#6b7280",
      light: "#6b7280",
    },
    diffAddedLineNumberBg: {
      dark: "#16321f",
      light: "#d1fae5",
    },
    diffRemovedLineNumberBg: {
      dark: "#3a1717",
      light: "#fee2e2",
    },
    markdownText: {
      dark: "#e0e0e0",
      light: "#1f2937",
    },
    markdownHeading: {
      dark: "#f5a623",
      light: "#d97706",
    },
    markdownLink: {
      dark: "#f5a623",
      light: "#d97706",
    },
    markdownLinkText: {
      dark: "#22c55e",
      light: "#059669",
    },
    markdownCode: {
      dark: "#22c55e",
      light: "#059669",
    },
    markdownBlockQuote: {
      dark: "#6b7280",
      light: "#6b7280",
    },
    markdownEmph: {
      dark: "#f59e0b",
      light: "#d97706",
    },
    markdownStrong: {
      dark: "#f5a623",
      light: "#d97706",
    },
    markdownHorizontalRule: {
      dark: "#2d2d2d",
      light: "#d1d5db",
    },
    markdownListItem: {
      dark: "#f5a623",
      light: "#d97706",
    },
    markdownListEnumeration: {
      dark: "#22c55e",
      light: "#059669",
    },
    markdownImage: {
      dark: "#f5a623",
      light: "#d97706",
    },
    markdownImageText: {
      dark: "#22c55e",
      light: "#059669",
    },
    markdownCodeBlock: {
      dark: "#e0e0e0",
      light: "#1f2937",
    },
    syntaxComment: {
      dark: "#6b7280",
      light: "#6b7280",
    },
    syntaxKeyword: {
      dark: "#f5a623",
      light: "#d97706",
    },
    syntaxFunction: {
      dark: "#f5a623",
      light: "#d97706",
    },
    syntaxVariable: {
      dark: "#e0e0e0",
      light: "#1f2937",
    },
    syntaxString: {
      dark: "#22c55e",
      light: "#059669",
    },
    syntaxNumber: {
      dark: "#f59e0b",
      light: "#d97706",
    },
    syntaxType: {
      dark: "#22c55e",
      light: "#059669",
    },
    syntaxOperator: {
      dark: "#22c55e",
      light: "#059669",
    },
    syntaxPunctuation: {
      dark: "#e0e0e0",
      light: "#1f2937",
    },
  },
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light";
}

function isThemeVariant(value: unknown): value is ThemeVariant {
  return !!value && typeof value === "object" && "dark" in value && "light" in value;
}

function isThemeJson(value: unknown): value is ThemeJson {
  return !!value && typeof value === "object" && "theme" in value && typeof (value as ThemeJson).theme === "object";
}

function blend(base: RGBA, overlay: RGBA, alpha: number): RGBA {
  const nextR = base.r + (overlay.r - base.r) * alpha;
  const nextG = base.g + (overlay.g - base.g) * alpha;
  const nextB = base.b + (overlay.b - base.b) * alpha;
  return RGBA.fromInts(
    Math.round(nextR * 255),
    Math.round(nextG * 255),
    Math.round(nextB * 255),
    Math.round((base.a + (overlay.a - base.a) * alpha) * 255),
  );
}

function getReadableText(background: RGBA): RGBA {
  const luminance = 0.299 * background.r + 0.587 * background.g + 0.114 * background.b;
  return luminance > 0.6 ? BLACK : WHITE;
}

function ansiToRgba(code: number): RGBA {
  if (code < 16) {
    const ansiColors = [
      "#000000",
      "#800000",
      "#008000",
      "#808000",
      "#000080",
      "#800080",
      "#008080",
      "#c0c0c0",
      "#808080",
      "#ff0000",
      "#00ff00",
      "#ffff00",
      "#0000ff",
      "#ff00ff",
      "#00ffff",
      "#ffffff",
    ];
    return RGBA.fromHex(ansiColors[code] ?? "#000000");
  }

  if (code < 232) {
    const index = code - 16;
    const b = index % 6;
    const g = Math.floor(index / 6) % 6;
    const r = Math.floor(index / 36);
    const value = (x: number) => (x === 0 ? 0 : x * 40 + 55);
    return RGBA.fromInts(value(r), value(g), value(b));
  }

  if (code < 256) {
    const gray = (code - 232) * 10 + 8;
    return RGBA.fromInts(gray, gray, gray);
  }

  return BLACK;
}

function resolveThemeColors(themeJson: ThemeJson, mode: ThemeMode): ThemeColors {
  const defs = themeJson.defs ?? {};
  const cache = new Map<string, RGBA>();
  const resolving = new Set<string>();

  const resolveColor = (value: ThemeValue): RGBA => {
    if (value instanceof RGBA) {
      return value;
    }

    if (typeof value === "number") {
      return ansiToRgba(value);
    }

    if (typeof value === "string") {
      if (value === "transparent" || value === "none") {
        return RGBA.fromInts(0, 0, 0, 0);
      }

      if (value.startsWith("#")) {
        return RGBA.fromHex(value);
      }

      if (cache.has(value)) {
        return cache.get(value)!;
      }

      if (resolving.has(value)) {
        throw new Error(`Theme color reference cycle detected for \"${value}\"`);
      }

      const referenced = defs[value] ?? themeJson.theme[value];
      if (referenced === undefined) {
        throw new Error(`Theme color reference \"${value}\" not found`);
      }

      resolving.add(value);
      try {
        const resolved = resolveColor(referenced);
        cache.set(value, resolved);
        return resolved;
      } finally {
        resolving.delete(value);
      }
    }

    if (isThemeVariant(value)) {
      return resolveColor(value[mode]);
    }

    throw new Error("Invalid theme color value");
  };

  const resolveFromKeys = (keys: string[], fallback: RGBA): RGBA => {
    for (const key of keys) {
      const candidate = themeJson.theme[key];
      if (candidate === undefined) continue;
      try {
        return resolveColor(candidate);
      } catch {
        continue;
      }
    }
    return fallback;
  };

  const fallbackBackground = mode === "dark" ? RGBA.fromHex("#0d0d0d") : RGBA.fromHex("#ffffff");
  const fallbackPanel = mode === "dark" ? RGBA.fromHex("#161616") : RGBA.fromHex("#f3f4f6");
  const fallbackText = mode === "dark" ? RGBA.fromHex("#e0e0e0") : RGBA.fromHex("#1f2937");
  const fallbackTextMuted = RGBA.fromHex("#6b7280");
  const fallbackPrimary = mode === "dark" ? RGBA.fromHex("#f5a623") : RGBA.fromHex("#d97706");
  const fallbackAccent = mode === "dark" ? RGBA.fromHex("#22c55e") : RGBA.fromHex("#059669");
  const fallbackSuccess = mode === "dark" ? RGBA.fromHex("#22c55e") : RGBA.fromHex("#059669");
  const fallbackWarning = mode === "dark" ? RGBA.fromHex("#f59e0b") : RGBA.fromHex("#d97706");
  const fallbackError = mode === "dark" ? RGBA.fromHex("#ef4444") : RGBA.fromHex("#dc2626");
  const fallbackBorder = mode === "dark" ? RGBA.fromHex("#2d2d2d") : RGBA.fromHex("#d1d5db");
  const fallbackBorderSubtle = mode === "dark" ? RGBA.fromHex("#1f1f1f") : RGBA.fromHex("#e5e7eb");

  const background = resolveFromKeys(["background"], fallbackBackground);
  const backgroundPanel = resolveFromKeys(
    ["backgroundPanel", "backgroundElement", "background"],
    fallbackPanel,
  );
  const panelModal = resolveFromKeys(
    ["backgroundMenu", "backgroundElement", "backgroundPanel", "background"],
    blend(backgroundPanel, background, mode === "dark" ? 0.08 : 0.04),
  );

  const text = resolveFromKeys(["text", "markdownText", "syntaxVariable"], fallbackText);
  const textMuted = resolveFromKeys(["textMuted", "syntaxComment", "diffContext"], fallbackTextMuted);
  const textBright = blend(text, getReadableText(background), mode === "dark" ? 0.18 : 0.12);

  const primary = resolveFromKeys(["primary", "accent", "secondary"], fallbackPrimary);
  const accent = resolveFromKeys(["accent", "secondary", "primary"], fallbackAccent);
  const success = resolveFromKeys(["success", "diffAdded", "info"], fallbackSuccess);
  const warning = resolveFromKeys(["warning", "markdownStrong", "markdownEmph"], fallbackWarning);
  const error = resolveFromKeys(["error", "diffRemoved"], fallbackError);

  const mutedBlend = mode === "dark" ? 0.34 : 0.2;
  const primaryMuted = blend(backgroundPanel, primary, mutedBlend);
  const accentMuted = blend(backgroundPanel, accent, mutedBlend);
  const successMuted = blend(backgroundPanel, success, mutedBlend);
  const warningMuted = blend(backgroundPanel, warning, mutedBlend);
  const errorMuted = blend(backgroundPanel, error, mutedBlend);

  const border = resolveFromKeys(["border", "borderActive", "backgroundElement"], fallbackBorder);
  const borderSubtle = resolveFromKeys(["borderSubtle", "backgroundElement", "border"], fallbackBorderSubtle);

  const highlight = resolveFromKeys(["primary", "accent", "secondary"], primary);
  const highlightText = resolveFromKeys(["selectedListItemText"], getReadableText(highlight));

  return {
    background,
    backgroundPanel,
    panelModal,
    text,
    textMuted,
    textBright,
    primary,
    primaryMuted,
    accent,
    accentMuted,
    success,
    successMuted,
    warning,
    warningMuted,
    error,
    errorMuted,
    border,
    borderSubtle,
    highlight,
    highlightText,
  };
}

function loadThemesFromDisk(): Record<string, ThemeJson> {
  const themes: Record<string, ThemeJson> = {};

  try {
    const entries = readdirSync(NIKCLI_THEME_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const filePath = join(NIKCLI_THEME_DIR, entry.name);
      try {
        const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
        if (!isThemeJson(parsed)) {
          continue;
        }

        const themeName = entry.name.slice(0, -5);
        themes[themeName] = parsed;
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors; fallback theme is always available.
  }

  if (Object.keys(themes).length === 0) {
    themes[FALLBACK_THEME_NAME] = DEFAULT_THEME_JSON;
  }

  return themes;
}

function getDefaultThemeName(themes: Record<string, ThemeJson>): string {
  if (themes[FALLBACK_THEME_NAME]) {
    return FALLBACK_THEME_NAME;
  }

  const names = Object.keys(themes).sort((a, b) => a.localeCompare(b));
  return names[0] ?? FALLBACK_THEME_NAME;
}

export const ThemeProvider: ParentComponent = (props) => {
  const persisted = loadPersistedThemePreferences();
  const loadedThemes = loadThemesFromDisk();

  const initialMode = isThemeMode(persisted.themeMode) ? persisted.themeMode : "dark";
  const fallbackThemeName = getDefaultThemeName(loadedThemes);
  const initialThemeName =
    persisted.themeName && loadedThemes[persisted.themeName]
      ? persisted.themeName
      : fallbackThemeName;

  const [state, setState] = createStore<ThemeState>({
    mode: initialMode,
    themeName: initialThemeName,
    themes: loadedThemes,
  });

  const themeNames = createMemo(() => Object.keys(state.themes).sort((a, b) => a.localeCompare(b)));

  const resolvedTheme = createMemo(() => {
    const activeTheme = state.themes[state.themeName]
      ?? state.themes[getDefaultThemeName(state.themes)]
      ?? DEFAULT_THEME_JSON;
    return resolveThemeColors(activeTheme, state.mode);
  });

  const themeProxy = new Proxy({} as ThemeColors, {
    get(_target, prop) {
      return resolvedTheme()[prop as keyof ThemeColors];
    },
  });

  const persistPreferences = (mode: ThemeMode, themeName: string) => {
    savePersistedThemePreferences({
      themeMode: mode,
      themeName,
    });
  };

  const setMode = (mode: ThemeMode) => {
    if (!isThemeMode(mode)) {
      return;
    }

    setState("mode", mode);
    persistPreferences(mode, state.themeName);
  };

  const toggleMode = () => {
    setMode(state.mode === "dark" ? "light" : "dark");
  };

  const setTheme = (themeName: string) => {
    if (!state.themes[themeName]) {
      return;
    }

    setState("themeName", themeName);
    persistPreferences(state.mode, themeName);
  };

  const cycleTheme = (direction: 1 | -1 = 1) => {
    const names = themeNames();
    if (names.length === 0) {
      return;
    }

    const currentIndex = names.indexOf(state.themeName);
    const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;
    const delta = direction >= 0 ? 1 : -1;
    const nextIndex = (safeCurrentIndex + delta + names.length) % names.length;
    const nextThemeName = names[nextIndex] ?? names[0]!;

    setTheme(nextThemeName);
  };

  const reloadThemes = () => {
    const reloaded = loadThemesFromDisk();
    const nextThemeName = reloaded[state.themeName]
      ? state.themeName
      : getDefaultThemeName(reloaded);

    setState({
      mode: state.mode,
      themeName: nextThemeName,
      themes: reloaded,
    });

    persistPreferences(state.mode, nextThemeName);
  };

  if (persisted.themeMode !== initialMode || persisted.themeName !== initialThemeName) {
    persistPreferences(initialMode, initialThemeName);
  }

  const value: ThemeContextValue = {
    get state() {
      return state;
    },
    setMode,
    toggleMode,
    setTheme,
    cycleTheme,
    reloadThemes,
    theme: themeProxy,
    get mode() {
      return state.mode;
    },
    get themeName() {
      return state.themeName;
    },
    get availableThemes() {
      return themeNames();
    },
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
