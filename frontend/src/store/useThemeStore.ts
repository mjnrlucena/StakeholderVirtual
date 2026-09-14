import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "stakeholder-virtual:theme";

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function readInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "dark" ? "dark" : "light"; // padrão: claro
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readInitialTheme(),

  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyThemeClass(theme);
    set({ theme });
  },

  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      applyThemeClass(next);
      return { theme: next };
    }),
}));

// Aplica a classe correta assim que o módulo carrega (antes do primeiro render).
applyThemeClass(readInitialTheme());
