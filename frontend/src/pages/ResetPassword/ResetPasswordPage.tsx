import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { redefinirSenha } from "@/services/api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setIsSubmitting(true);
    try {
      await redefinirSenha(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.erro ?? "Não foi possível redefinir a senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Redefinir senha">
        <p className="text-sm text-[var(--text-secondary)]">Link inválido.</p>
        <p className="mt-4 text-center text-xs">
          <Link to="/esqueci-senha" className="text-[var(--accent)]">
            Pedir um novo link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Redefinir senha">
      {done ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Senha alterada.{" "}
          <Link to="/login" className="text-[var(--accent)]">
            Entrar com a nova senha
          </Link>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <PasswordInput
            required
            placeholder="Nova senha (mín. 8 caracteres)"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordInput
            required
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && (
            <p className="text-xs text-[var(--danger)]">
              {error}{" "}
              {error.includes("Peça um novo") && (
                <Link to="/esqueci-senha" className="text-[var(--accent)]">
                  Pedir novo link
                </Link>
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          >
            {isSubmitting ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
