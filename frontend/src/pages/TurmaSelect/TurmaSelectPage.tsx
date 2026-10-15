import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Depois do login, quem está em mais de uma turma escolhe qual vai usar:
 * os logs da sessão e a lista de projetos seguem só a turma escolhida.
 */
export function TurmaSelectPage() {
  const user = useAuthStore((s) => s.user);
  const selecionarTurma = useAuthStore((s) => s.selecionarTurma);
  const queryClient = useQueryClient();

  const [turmaId, setTurmaId] = useState(user?.turma?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!turmaId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await selecionarTurma(turmaId);
      // Projetos e sessões dependem da turma ativa.
      queryClient.invalidateQueries();
    } catch (err: any) {
      setError(err?.response?.data?.erro ?? "Não foi possível trocar de turma.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Escolha a turma">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-xs text-[var(--text-secondary)]">
          Você está em mais de uma turma. As conversas desta sessão ficam registradas só na turma escolhida.
        </p>

        <div role="radiogroup" aria-label="Turma" className="flex flex-col gap-2">
          {user?.turmas.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] ${
                turmaId === t.id ? "border-[var(--accent)]" : "border-[var(--border)]"
              }`}
            >
              <input
                type="radio"
                name="turma"
                value={t.id}
                checked={turmaId === t.id}
                onChange={() => setTurmaId(t.id)}
                className="accent-[var(--accent)]"
              />
              <span className="min-w-0 break-words">{t.nome}</span>
            </label>
          ))}
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || !turmaId}
          className="mt-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
        >
          {isSubmitting ? "Entrando…" : "Continuar"}
        </button>
      </form>
    </AuthLayout>
  );
}
