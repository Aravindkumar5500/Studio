"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
type Theme = "light" | "dark";
export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("light");
  React.useEffect(() => {
    const stored = window.localStorage.getItem("studio_theme");
    const initial: Theme = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(initial);
  }, []);
  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem("studio_theme", next);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
  }
  return <button type="button" className="studio-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>{theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}<span>{theme === "light" ? "Dark" : "Light"} mode</span></button>;
}
