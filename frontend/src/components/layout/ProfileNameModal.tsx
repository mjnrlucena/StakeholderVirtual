import { useState } from "react";
import { createPortal } from "react-dom";
import { atualizarMeuNome } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

/** A própria pessoa altera o nome de exibição. */
export function ProfileNameModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [nome, setNome] = useState(user?.nome ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (nome.trim().length < 2) {
      setError("O nome precisa ter pelo menos 2 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      useAuthStore.setState({ user: await atualizarMeuNome(nome.trim()) });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.erro ?? "Falha ao salvar o nome.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-name-title"
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => e.key === "Escape" && !saving && onClose()}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl"
      >
        <h2 id="profile-name-title" className="text-lg font-semibold text-[var(--text-primary)]">
          Nome de exibição
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{user?.email}</p>

        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={120}
          placeholder="Seu nome"
          aria-label="Nome de exibição"
          className={`mt-4 ${inputCls}`}
        />
        {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
