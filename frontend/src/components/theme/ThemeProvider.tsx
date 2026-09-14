import { type ReactNode, useEffect } from "react";
import { useThemeStore } from "@/store/useThemeStore";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * A store (useThemeStore) já aplica a classe "dark" no <html> assim que é
 * importada, então este provider existe principalmente para deixar o ponto
 * de configuração de tema explícito no App e para futuras extensões
 * (ex.: detectar preferência do sistema, sincronizar em outras abas).
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <>{children}</>;
}
