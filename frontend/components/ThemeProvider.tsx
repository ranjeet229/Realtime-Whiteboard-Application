"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** App defaults to light; dark only after the user enables it. */
type Theme = "light" | "dark";

type Ctx = {
  theme: Theme;
  /** Same as `theme` (kept for existing callers that used `resolved`). */
  resolved: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const s = localStorage.getItem("cq_theme");
    if (s === "dark") return "dark";
    if (s === "light") return "light";
    if (s === "system") {
      localStorage.setItem("cq_theme", "light");
      return "light";
    }
  } catch {
    /* ignore */
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("cq_theme", t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("cq_theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolved: theme,
      setTheme,
      toggle,
    }),
    [theme, setTheme, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
