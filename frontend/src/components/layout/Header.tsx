import { NewChatButton } from "./NewChatButton";
import { SairButton } from "./SairButton";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="w-full border-b border-[var(--divider)] bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
        <div>
          <h1 className="app-title">Stakeholder Virtual</h1>
          <p className="app-subtitle">
            Entreviste o cliente e levante os requisitos do sistema
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NewChatButton />
          <SairButton />
        </div>
      </div>
    </header>
  );
}
