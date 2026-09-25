import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuthStore } from "@/store/useAuthStore";

export function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password);
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

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

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
