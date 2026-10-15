import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { criarSessao, listarSessoes, removerSessao, renomearSessao } from "@/services/api";
import { sessionLabel, type ChatSession } from "@/types/chat";

interface SessionListProps {
  projectId: string;
  /** Sessão aberta no momento (fica destacada). */
  activeChatId?: string;
  /** Chamado ao entrar numa sessão (ex.: fechar a barra lateral no celular). */
  onPick?: () => void;
}

/**
 * Sessões do usuário num projeto: entrar, criar, renomear e apagar.
 * Usada no card da página de projetos e na barra lateral do chat.
 */
export function SessionList({ projectId, activeChatId, onPick }: SessionListProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ChatSession | null>(null);

  const queryKey = ["sessions", projectId];
  const { data: sessions, isLoading } = useQuery({ queryKey, queryFn: () => listarSessoes(projectId) });

  const { mutate: criar, isPending: creating } = useMutation({
    mutationFn: () => criarSessao(projectId),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey });
      onPick?.();
      navigate(`/projetos/${projectId}/${session.id}`);
    },
  });

  const { mutate: renomear } = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renomearSessao(projectId, id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const { mutate: remover } = useMutation({
    mutationFn: (id: string) => removerSessao(projectId, id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.removeQueries({ queryKey: ["chat", id] });
      // Apagou a sessão aberta: o chat escolhe outra (ou cria uma nova).
      if (id === activeChatId) navigate(`/projetos/${projectId}`, { replace: true });
    },
  });

  function saveName(session: ChatSession, value: string) {
    setEditingId(null);
    const name = value.trim();
    if (name !== (session.name ?? "")) renomear({ id: session.id, name });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => criar()}
        disabled={creating}
        className="mb-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
      >
        <Plus size={15} className="text-[var(--accent)]" />
        {creating ? "Criando…" : "Nova sessão"}
      </button>

      {isLoading && <p className="px-1 text-xs text-[var(--text-secondary)]">Carregando…</p>}
      {!isLoading && sessions?.length === 0 && (
        <p className="px-1 text-xs text-[var(--text-secondary)]">Nenhuma sessão ainda.</p>
      )}

      {sessions?.map((s) => {
        const active = s.id === activeChatId;
        return (
          <div
            key={s.id}
            className={`group flex items-center gap-1 rounded-xl pr-1 ${
              active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-hover)]"
            }`}
          >
            {editingId === s.id ? (
              <input
                autoFocus
                defaultValue={s.name ?? ""}
                placeholder={`Sessão ${s.number}`}
                maxLength={80}
                aria-label="Nome da sessão"
                onBlur={(e) => saveName(s, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="m-1 min-w-0 flex-1 rounded-lg border border-[var(--accent)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--text-primary)] outline-none"
              />
            ) : (
              <Link
                to={`/projetos/${projectId}/${s.id}`}
                onClick={onPick}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm ${
                  active ? "font-medium text-[var(--accent)]" : "text-[var(--text-primary)]"
                }`}
              >
                <MessageSquare size={14} className="shrink-0 opacity-70" />
                <span className="truncate">{sessionLabel(s)}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setEditingId(s.id)}
              title="Renomear sessão"
              aria-label={`Renomear ${sessionLabel(s)}`}
              className="icon-btn h-7 w-7"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => setToDelete(s)}
              title="Apagar sessão"
              aria-label={`Apagar ${sessionLabel(s)}`}
              className="icon-btn h-7 w-7 hover:text-[var(--danger)]"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}

      <ConfirmModal
        open={Boolean(toDelete)}
        tone="danger"
        title={`Apagar "${toDelete ? sessionLabel(toDelete) : ""}"?`}
        description="As mensagens dessa sessão serão apagadas. Essa ação não pode ser desfeita."
        confirmLabel="Apagar sessão"
        onConfirm={() => {
          if (toDelete) remover(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
