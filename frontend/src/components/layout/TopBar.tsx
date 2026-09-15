import { NewChatButton } from "./NewChatButton";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Substitui o header antigo (título + subtítulo grandes). Fica fixa no
 * topo, com fundo levemente esmaecido sobre a área de mensagens, só com
 * os controles necessários — próxima do padrão do ChatGPT.
 * O botão de feedback ("Sair") mudou de lugar: agora fica na barra
 * inferior, junto do composer (ver components/chat/FeedbackButton.tsx).
 */
export function TopBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-20 bg-gradient-to-b from-[var(--background)] via-[var(--background)]/90 to-transparent">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-3">
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          Stakeholder Virtual
        </span>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NewChatButton />
        </div>
      </div>
    </div>
  );
}
