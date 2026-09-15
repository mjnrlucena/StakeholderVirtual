import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">
        Página não encontrada
      </h1>
      <p className="text-[15px] text-[var(--text-secondary)]">
        O endereço acessado não existe.
      </p>
      <Link
        to="/"
        className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm text-[var(--background)] transition-opacity hover:opacity-90"
      >
        Voltar para o chat
      </Link>
    </div>
  );
}
