"use client";

import * as React from "react";

export type StudioTheme = "light" | "dark";

interface ThemeContextValue {
  theme: StudioTheme;
  setTheme: (theme: StudioTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "studio_theme";

function applyThemeClass(theme: StudioTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<StudioTheme>("light");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const initial: StudioTheme = stored === "dark" ? "dark" : "light";
      setThemeState(initial);
      applyThemeClass(initial);
    } catch {
      applyThemeClass("light");
    }
  }, []);

  const setTheme = React.useCallback((next: StudioTheme) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
