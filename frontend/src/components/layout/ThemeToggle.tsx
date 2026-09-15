import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/store/useThemeStore";

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
      aria-label="Alternar tema"
      className="icon-btn"
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
