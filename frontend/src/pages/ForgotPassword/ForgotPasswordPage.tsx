import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { solicitarRedefinicaoSenha } from "@/services/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await solicitarRedefinicaoSenha(email);
      setSent(true);
    } catch {
      setError("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Esqueci minha senha">
      {sent ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Se existir uma conta com <strong className="text-[var(--text-primary)]">{email}</strong>, enviamos um link
          para criar uma nova senha. Confira também a caixa de spam.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.
          </p>
          <input
            type="email"
            required
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          >
            {isSubmitting ? "Enviando…" : "Enviar link"}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-[var(--text-secondary)]">
        <Link to="/login" className="text-[var(--accent)]">
          Voltar para o login
        </Link>
      </p>
    </AuthLayout>
  );
}
