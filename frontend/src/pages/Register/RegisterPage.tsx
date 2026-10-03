import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { listarTurmas } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

export function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: turmas, isLoading: loadingTurmas, isError: turmasError } = useQuery({
    queryKey: ["turmas"],
    queryFn: listarTurmas,
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (!turmaId) {
      setError("Escolha a sua turma.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, turmaId);
      navigate("/", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.erro ?? "Não foi possível criar a conta.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Criar conta">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        <input
          type="password"
          required
          placeholder="Senha (mín. 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />

        <select
          required
          value={turmaId}
          onChange={(e) => setTurmaId(e.target.value)}
          disabled={loadingTurmas || !turmas?.length}
          aria-label="Turma"
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
        >
          <option value="" disabled>
            {loadingTurmas ? "Carregando turmas…" : turmas?.length ? "Escolha a sua turma" : "Nenhuma turma disponível"}
          </option>
          {turmas?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>

        {turmasError && (
          <p className="text-xs text-[var(--danger)]">Não foi possível carregar as turmas. Tente novamente.</p>
        )}
        {!loadingTurmas && !turmasError && turmas?.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)]">
            Ainda não há turmas cadastradas. Peça ao responsável para criar a sua turma.
          </p>
        )}

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <p className="text-xs text-[var(--text-secondary)]">
          As conversas com o stakeholder são registradas, junto com a sua turma, para acompanhamento pedagógico.
        </p>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
        >
          {isSubmitting ? "Criando…" : "Criar conta"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-[var(--text-secondary)]">
        Já tem conta?{" "}
        <Link to="/login" className="text-[var(--accent)]">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
