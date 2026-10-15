import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, ChevronRight, Pencil, Trash2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SessionView } from "./logs/LogItem";
import {
  criarEquipe,
  criarProjeto,
  contextoDaPergunta,
  criarTurma,
  definirTurmasDoProjeto,
  deletarPergunta,
  listarPerguntasNaoRespondidas,
  listarProjetosAdmin,
  listarTurmasAdmin,
  promoverUsuario,
  removerEquipe,
  removerProjeto,
  removerTurma,
  renomearEquipe,
  responderPergunta,
} from "@/services/api";
import type { Turma } from "@/types/auth";
import type { AdminProject, UnansweredQuestion } from "@/types/project";
import { isProfessor, isSuperAdmin } from "@/lib/roles";
import { useAuthStore } from "@/store/useAuthStore";

const inputCls =
  "rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";
const primaryBtnCls =
  "shrink-0 rounded-xl bg-[var(--accent)]  hover:bg-[var(--accent-hover)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60";

export function AdminDashboardPage() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    // O scroll fica no container de largura total: a roda do mouse funciona em
    // qualquer ponto da tela e a barra fica na borda direita; a coluna fica centralizada dentro.
    // "relative" prende aqui dentro o input sr-only (absolute) do PDF; sem isso ele
    // aumentava a altura da janela e criava uma segunda barra que rolava a página inteira.
    <div className="relative h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-20">
        <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Hub de administração</h1>

        {isProfessor(role) && (
          <div className="mb-8 flex flex-col gap-2">
            <HubLink
              to="/admin/logs"
              icon={<BarChart3 size={20} />}
              title="Dashboard de conversas"
              description="Logs das perguntas e respostas, por turma, projeto e período."
            />
            <HubLink
              to="/admin/cadastros"
              icon={<Users size={20} />}
              title="Cadastros: turmas e equipes"
              description="Nome, e-mail, turma e equipe de cada pessoa cadastrada; troque a turma ou a equipe."
            />
          </div>
        )}
        {isSuperAdmin(role) && <PromoteSection />}
        {isProfessor(role) && <TurmasSection canManageTurmas={isSuperAdmin(role)} />}
        {isProfessor(role) && <UploadProjectSection />}
        {isProfessor(role) && <ProjectsSection />}
        <UnansweredQuestionsSection />
      </div>
    </div>
  );
}

function HubLink({ to, icon, title, description }: { to: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4  hover:bg-[var(--surface-hover)]"
    >
      <span className="shrink-0 text-[var(--accent)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="block text-xs text-[var(--text-secondary)]">{description}</span>
      </span>
    </Link>
  );
}

function PromoteSection() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PROFESSOR" | "GESTOR" | "ALUNO">("PROFESSOR");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () => promoverUsuario(email.trim(), role),
    onSuccess: () => {
      setMessage({ text: "Papel atualizado! Vale no próximo login da pessoa (ou em até 15 min).", type: "success" });
      setEmail("");
    },
    onError: (err: any) => {
      setMessage({ text: err?.response?.data?.erro ?? "Falha ao atualizar o papel.", type: "error" });
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!email.trim()) return;
    mutate();
  }

  return (
    <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Professores e gestores</h2>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        Exclusivo para SuperAdmin. Informe o e-mail de uma conta já cadastrada e escolha o papel. Gestores só respondem
        perguntas não respondidas; professores têm o hub completo e o dashboard de conversas.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          required
          placeholder="email@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            aria-label="Papel"
            className={`${inputCls} flex-1`}
          >
            <option value="PROFESSOR">Professor</option>
            <option value="GESTOR">Gestor</option>
            <option value="ALUNO">Aluno (remover acesso ao hub)</option>
          </select>
          <button type="submit" disabled={isPending || !email.trim()} className={primaryBtnCls}>
            {isPending ? "Salvando…" : "Aplicar"}
          </button>
        </div>

        {message && (
          <p className={`text-xs ${message.type === "success" ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
            {message.text}
          </p>
        )}
      </form>
    </section>
  );
}

function TurmasSection({ canManageTurmas }: { canManageTurmas: boolean }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: turmas, isLoading } = useQuery({ queryKey: ["admin-turmas"], queryFn: listarTurmasAdmin });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-turmas"] });
    queryClient.invalidateQueries({ queryKey: ["turmas"] });
    queryClient.invalidateQueries({ queryKey: ["log-filter-options"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  const { mutate: criar, isPending: creating } = useMutation({
    mutationFn: () => criarTurma(nome.trim()),
    onSuccess: () => {
      setNome("");
      refresh();
    },
    onError: (err: any) => setError(err?.response?.data?.erro ?? "Falha ao criar a turma."),
  });

  const { mutate: remover, isPending: removing } = useMutation({
    mutationFn: (id: string) => removerTurma(id),
    onSuccess: refresh,
    onError: (err: any) => setError(err?.response?.data?.erro ?? "Falha ao remover a turma."),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!nome.trim()) return;
    criar();
  }

  return (
    <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Turmas e equipes</h2>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        As turmas e as equipes de cada uma aparecem na tela de cadastro dos alunos. Clique numa turma para ver,
        criar, renomear ou excluir as equipes dela.
        {canManageTurmas &&
          ' Use o nome completo da turma, por exemplo "Planejamento e Gerenciamento de Projetos — IMD".'}
      </p>

      {canManageTurmas && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            required
            maxLength={200}
            placeholder="Nome da turma"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`${inputCls} min-w-0 flex-1`}
          />
          <button type="submit" disabled={creating || !nome.trim()} className={primaryBtnCls}>
            {creating ? "Criando…" : "Adicionar"}
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}

      {isLoading && <p className="mt-3 text-sm text-[var(--text-secondary)]">Carregando…</p>}
      {!isLoading && turmas?.length === 0 && (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Nenhuma turma cadastrada ainda.</p>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {turmas?.map((t) => {
          const open = openId === t.id;
          return (
            <li key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : t.id)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronRight
                    size={16}
                    className={`shrink-0 text-[var(--text-secondary)] transition-transform ${open ? "rotate-90" : ""}`}
                  />
                  <span className="min-w-0">
                    <span className="block break-words text-sm text-[var(--text-primary)]">{t.nome}</span>
                    <span className="block text-xs text-[var(--text-secondary)]">
                      {plural(t.alunos, "aluno", "alunos")} · {plural(t.equipes.length, "equipe", "equipes")}
                    </span>
                  </span>
                </button>
                {canManageTurmas && (
                  <button
                    type="button"
                    onClick={() => remover(t.id)}
                    disabled={removing || t.alunos > 0}
                    title={t.alunos > 0 ? "Só dá para remover turmas sem alunos" : "Remover turma"}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remover
                  </button>
                )}
              </div>
              {open && <EquipesPanel turma={t} onChanged={refresh} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function EquipesPanel({ turma, onChanged }: { turma: Turma; onChanged: () => void }) {
  const [nome, setNome] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Turma["equipes"][number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onError = (fallback: string) => (err: any) => setError(err?.response?.data?.erro ?? fallback);

  const { mutate: criar, isPending: creating } = useMutation({
    mutationFn: () => criarEquipe(turma.id, nome.trim()),
    onSuccess: () => {
      setNome("");
      onChanged();
    },
    onError: onError("Falha ao criar a equipe."),
  });

  const { mutate: renomear } = useMutation({
    mutationFn: ({ id, novo }: { id: string; novo: string }) => renomearEquipe(id, novo),
    onSuccess: onChanged,
    onError: onError("Falha ao renomear a equipe."),
  });

  const { mutate: remover } = useMutation({
    mutationFn: (id: string) => removerEquipe(id),
    onSuccess: onChanged,
    onError: onError("Falha ao excluir a equipe."),
  });

  return (
    <div className="border-t border-[var(--border)] px-3 py-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (nome.trim()) criar();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          required
          maxLength={120}
          placeholder="Nome da equipe"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={`${inputCls} min-w-0 flex-1`}
        />
        <button type="submit" disabled={creating || !nome.trim()} className={primaryBtnCls}>
          {creating ? "Criando…" : "Adicionar"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
      {turma.equipes.length === 0 && (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">Nenhuma equipe nessa turma ainda.</p>
      )}

      <ul className="mt-2 flex flex-col gap-1">
        {turma.equipes.map((e) => (
          <li key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--surface-hover)]">
            {editingId === e.id ? (
              <input
                autoFocus
                defaultValue={e.nome}
                maxLength={120}
                aria-label="Novo nome da equipe"
                onBlur={(ev) => {
                  setEditingId(null);
                  const novo = ev.target.value.trim();
                  if (novo && novo !== e.nome) renomear({ id: e.id, novo });
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") ev.currentTarget.blur();
                  if (ev.key === "Escape") setEditingId(null);
                }}
                className={`${inputCls} min-w-0 flex-1 py-1`}
              />
            ) : (
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm text-[var(--text-primary)]">{e.nome}</span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {plural(e.alunos, "pessoa cadastrada", "pessoas cadastradas")}
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditingId(e.id)}
              title="Renomear equipe"
              aria-label={`Renomear ${e.nome}`}
              className="icon-btn h-7 w-7"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => setToDelete(e)}
              title="Excluir equipe"
              aria-label={`Excluir ${e.nome}`}
              className="icon-btn h-7 w-7 hover:text-[var(--danger)]"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={Boolean(toDelete)}
        tone="danger"
        title={`Excluir a equipe "${toDelete?.nome ?? ""}"?`}
        description={
          toDelete?.alunos
            ? `${plural(toDelete.alunos, "pessoa continua", "pessoas continuam")} na turma, mas sem equipe.`
            : "A equipe não tem ninguém cadastrado."
        }
        confirmLabel="Excluir equipe"
        onConfirm={() => {
          if (toDelete) remover(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function UploadProjectSection() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: criarProjeto,
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.erro ?? "Falha ao enviar o PDF.");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Selecione um arquivo PDF.");
      return;
    }
    mutate({ title, description: description || undefined, pdf: file });
  }

  return (
    <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Novo projeto (PDF)</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          required
          placeholder="Título do projeto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        <input
          type="text"
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        <div className="flex items-center gap-3">
          <label
            htmlFor="project-pdf-input"
            className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]  hover:bg-[var(--surface-hover)]"
          >
            Escolher PDF…
          </label>
          <input
            id="project-pdf-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <span className="truncate text-sm text-[var(--text-secondary)]">
            {file ? file.name : "Nenhum arquivo selecionado"}
          </span>
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 self-start rounded-xl bg-[var(--accent)]  hover:bg-[var(--accent-hover)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
        >
          {isPending ? "Enviando…" : "Enviar PDF"}
        </button>
      </form>
    </section>
  );
}

function ProjectsSection() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: listarProjetosAdmin,
  });

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
        Projetos cadastrados
      </h2>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        Clique num projeto para escolher quais turmas podem vê-lo. Sem turma marcada, só professores e superadmins
        veem o projeto.
      </p>
      {isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}
      <ul className="flex flex-col gap-2">
        {projects?.map((project) => {
          const open = openId === project.id;
          return (
            <li key={project.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-[var(--text-primary)]">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : project.id)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronRight
                    size={16}
                    className={`shrink-0 text-[var(--text-secondary)] transition-transform ${open ? "rotate-90" : ""}`}
                  />
                  <span className="min-w-0">
                    <span className="block break-words">{project.title}</span>
                    <span className="block text-xs text-[var(--text-secondary)]">
                      {project.turmaIds.length
                        ? `Liberado para ${plural(project.turmaIds.length, "turma", "turmas")}`
                        : "Oculto para os alunos"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTarget({ id: project.id, title: project.title })}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--danger)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  Deletar
                </button>
              </div>
              {open && <ProjectTurmasChecklist project={project} />}
            </li>
          );
        })}
      </ul>

      {target && (
        <DeleteProjectModal
          project={target}
          onClose={() => setTarget(null)}
          onDeleted={() => {
            setTarget(null);
            queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["unanswered-questions"] });
            queryClient.invalidateQueries({ queryKey: ["log-filter-options"] });
          }}
        />
      )}
    </section>
  );
}

function ProjectTurmasChecklist({ project }: { project: AdminProject }) {
  const queryClient = useQueryClient();
  const { data: turmas, isLoading } = useQuery({ queryKey: ["admin-turmas"], queryFn: listarTurmasAdmin });

  const { mutate, isPending, isError } = useMutation({
    mutationFn: (turmaIds: string[]) => definirTurmasDoProjeto(project.id, turmaIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  function toggle(id: string) {
    const cur = project.turmaIds;
    mutate(cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]);
  }

  return (
    <div className="border-t border-[var(--border)] px-3 py-3">
      <p className="mb-2 text-xs text-[var(--text-secondary)]">Turmas que podem ver este projeto:</p>
      {isLoading && <p className="text-xs text-[var(--text-secondary)]">Carregando…</p>}
      {!isLoading && turmas?.length === 0 && (
        <p className="text-xs text-[var(--text-secondary)]">Nenhuma turma cadastrada ainda.</p>
      )}
      <div className="flex flex-col gap-1">
        {turmas?.map((t) => (
          <label
            key={t.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            <input
              type="checkbox"
              checked={project.turmaIds.includes(t.id)}
              onChange={() => toggle(t.id)}
              disabled={isPending}
              className="size-4 accent-[var(--accent)]"
            />
            <span className="min-w-0 break-words">{t.nome}</span>
          </label>
        ))}
      </div>
      {isError && <p className="mt-2 text-xs text-[var(--danger)]">Falha ao salvar as turmas do projeto.</p>}
    </div>
  );
}

function DeleteProjectModal({
  project,
  onClose,
  onDeleted,
}: {
  project: { id: string; title: string };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  // O título do projeto precisa ser digitado exatamente: "delete NOMEDOPROJETO".
  const expected = `delete ${project.title}`;
  const matches = typed.trim() === expected;

  const { mutate, isPending } = useMutation({
    mutationFn: () => removerProjeto(project.id),
    onSuccess: onDeleted,
    onError: (err: any) => setError(err?.response?.data?.erro ?? "Falha ao deletar o projeto."),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!matches || isPending) return;
    setError(null);
    mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <h3 id="delete-project-title" className="text-base font-semibold text-[var(--text-primary)]">
          Deletar projeto
        </h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Isso apaga o projeto <strong className="break-words text-[var(--text-primary)]">{project.title}</strong>, o
          PDF do relatório, os chats dos alunos e as perguntas não respondidas dele. Não dá para desfazer. Os logs no
          dashboard de conversas continuam.
        </p>

        <label className="mt-4 block text-xs text-[var(--text-secondary)]">
          Para confirmar, digite{" "}
          <code className="break-all rounded bg-[var(--background)] px-1 py-0.5 text-[var(--text-primary)]">
            {expected}
          </code>
        </label>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={`mt-1 w-full ${inputCls}`}
        />

        {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!matches || isPending}
            className="rounded-xl bg-[var(--danger)] px-3 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Deletando…" : "Deletar projeto"}
          </button>
        </div>
      </form>
    </div>
  );
}

function UnansweredQuestionsSection() {
  const { data: questions, isLoading } = useQuery({
    queryKey: ["unanswered-questions"],
    queryFn: listarPerguntasNaoRespondidas,
  });
  const [projectId, setProjectId] = useState<string | null>(null);

  // Projetos com pendências e a contagem de cada um, na ordem em que aparecem.
  const projects = new Map<string, { title: string; count: number }>();
  for (const q of questions ?? []) {
    const p = projects.get(q.project.id);
    if (p) p.count++;
    else projects.set(q.project.id, { title: q.project.title, count: 1 });
  }
  // Se o projeto filtrado ficou sem pendências, volta para "Todos".
  const activeId = projectId && projects.has(projectId) ? projectId : null;
  const visible = activeId ? questions?.filter((q) => q.project.id === activeId) : questions;

  const chipCls = (active: boolean) =>
    `rounded-lg border px-2 py-1 text-xs transition-colors ${
      active
        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
        : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
    }`;

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
        Perguntas que o relatório não cobria
      </h2>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        Ficam aqui sempre que o relatório não tinha informação pra responder — inclui tanto
        invenções corrigidas quanto um "não sei" honesto do stakeholder. Responda pra virar
        contexto do projeto, ou descarte se não fizer sentido guardar.
      </p>

      {isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}
      {!isLoading && questions?.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">Nenhuma pendência no momento.</p>
      )}

      {projects.size > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por projeto">
          <button type="button" onClick={() => setProjectId(null)} aria-pressed={!activeId} className={chipCls(!activeId)}>
            Todos ({questions?.length})
          </button>
          {[...projects].map(([id, p]) => (
            <button
              key={id}
              type="button"
              onClick={() => setProjectId(id)}
              aria-pressed={activeId === id}
              className={`${chipCls(activeId === id)} max-w-full break-words text-left`}
            >
              {p.title} ({p.count})
            </button>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {visible?.map((q) => (
          <UnansweredQuestionItem key={q.id} question={q} />
        ))}
      </ul>
    </section>
  );
}

function UnansweredQuestionItem({ question: q }: { question: UnansweredQuestion }) {
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState("");
  const [showContext, setShowContext] = useState(false);

  const { mutate: responder, isPending: isAnswering } = useMutation({
    mutationFn: (texto: string) => responderPergunta(q.id, texto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["unanswered-questions"] }),
  });

  const { mutate: descartar, isPending: isDeleting } = useMutation({
    mutationFn: () => deletarPergunta(q.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["unanswered-questions"] }),
  });

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="text-sm text-[var(--text-primary)]">{q.question}</p>
      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
        Projeto: {q.project.title}
        {` · Turma: ${q.user?.turma?.nome ?? "Sem turma"}`}
      </p>

      {/* Perguntas antigas não guardavam a sessão do chat. */}
      {q.sessionId && (
        <>
          <button
            type="button"
            onClick={() => setShowContext((v) => !v)}
            aria-expanded={showContext}
            className="mt-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            {showContext ? "Ocultar contexto" : "Ver contexto da conversa"}
          </button>
          {showContext && (
            <SessionView
              queryKey={["unanswered-context", q.id]}
              load={() => contextoDaPergunta(q.id)}
              isCurrent={(entry) => entry.prompt === q.question}
            />
          )}
        </>
      )}

      <div className="mt-2 flex items-end gap-2">
        <textarea
          rows={2}
          placeholder="Escreva a resposta certa — ela vira contexto do relatório"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => answer.trim() && responder(answer.trim())}
            disabled={isAnswering || !answer.trim()}
            className="rounded-lg bg-[var(--accent)]  hover:bg-[var(--accent-hover)] px-2 py-1 text-xs font-medium text-[var(--accent-contrast)] disabled:opacity-50"
          >
            Responder
          </button>
          <button
            type="button"
            onClick={() => descartar()}
            disabled={isDeleting}
            className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Descartar
          </button>
        </div>
      </div>
    </li>
  );
}