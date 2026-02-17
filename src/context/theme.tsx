import { createContext, useContext, ParentComponent } from "solid-js";
import { createStore } from "solid-js/store";
import { RGBA } from "@opentui/core";

export interface ThemeColors {
  background: RGBA;
  backgroundPanel: RGBA;
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

const DarkTheme: ThemeColors = {
  background: RGBA.fromHex("#0d0d0d"),
  backgroundPanel: RGBA.fromHex("#161616"),
  text: RGBA.fromHex("#e0e0e0"),
  textMuted: RGBA.fromHex("#6b7280"),
  textBright: RGBA.fromHex("#ffffff"),
  primary: RGBA.fromHex("#f5a623"),
  primaryMuted: RGBA.fromHex("#7d5512"),
  accent: RGBA.fromHex("#22c55e"),
  accentMuted: RGBA.fromHex("#166534"),
  success: RGBA.fromHex("#22c55e"),
  successMuted: RGBA.fromHex("#166534"),
  warning: RGBA.fromHex("#f59e0b"),
  warningMuted: RGBA.fromHex("#92400e"),
  error: RGBA.fromHex("#ef4444"),
  errorMuted: RGBA.fromHex("#991b1b"),
  border: RGBA.fromHex("#2d2d2d"),
  borderSubtle: RGBA.fromHex("#1f1f1f"),
  highlight: RGBA.fromHex("#f5a623"),
  highlightText: RGBA.fromHex("#0d0d0d"),
};

const LightTheme: ThemeColors = {
  background: RGBA.fromHex("#ffffff"),
  backgroundPanel: RGBA.fromHex("#f3f4f6"),
  text: RGBA.fromHex("#1f2937"),
  textMuted: RGBA.fromHex("#6b7280"),
  textBright: RGBA.fromHex("#000000"),
  primary: RGBA.fromHex("#d97706"),
  primaryMuted: RGBA.fromHex("#fef3c7"),
  accent: RGBA.fromHex("#059669"),
  accentMuted: RGBA.fromHex("#d1fae5"),
  success: RGBA.fromHex("#059669"),
  successMuted: RGBA.fromHex("#d1fae5"),
  warning: RGBA.fromHex("#d97706"),
  warningMuted: RGBA.fromHex("#fef3c7"),
  error: RGBA.fromHex("#dc2626"),
  errorMuted: RGBA.fromHex("#fee2e2"),
  border: RGBA.fromHex("#d1d5db"),
  borderSubtle: RGBA.fromHex("#e5e7eb"),
  highlight: RGBA.fromHex("#d97706"),
  highlightText: RGBA.fromHex("#ffffff"),
};

export type ThemeMode = "dark" | "light";

interface ThemeState {
  mode: ThemeMode;
  theme: ThemeColors;
}

interface ThemeContextValue {
  state: ThemeState;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  theme: ThemeColors;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue>();

export const ThemeProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<ThemeState>({
    mode: "dark",
    theme: DarkTheme,
  });

  const setMode = (mode: ThemeMode) => {
    setState({
      mode,
      theme: mode === "dark" ? DarkTheme : LightTheme,
    });
  };

  const toggleMode = () => {
    setMode(state.mode === "dark" ? "light" : "dark");
  };

  const value: ThemeContextValue = {
    get state() { return state; },
    setMode,
    toggleMode,
    get theme() { return state.theme; },
    get mode() { return state.mode; },
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
