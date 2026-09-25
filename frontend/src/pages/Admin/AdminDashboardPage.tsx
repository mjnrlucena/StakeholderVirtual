import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  criarProjeto,
  deletarPergunta,
  listarPerguntasNaoRespondidas,
  listarProjetosAdmin,
  responderPergunta,
  adicionarAdmin, // <--- Adicione esta função na sua API de serviços
} from "@/services/api";
import type { UnansweredQuestion } from "@/types/project";
import { useAuthStore } from "@/store/useAuthStore";

export function AdminDashboardPage() {
  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-y-auto px-4 pb-10 pt-20">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Hub de administração</h1>

      <AddAdminSection />
      <UploadProjectSection />
      <ProjectsSection />
      <UnansweredQuestionsSection />
    </div>
  );
}

function AddAdminSection() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const user = useAuthStore((s) => s.user);

  const { mutate, isPending } = useMutation({
    mutationFn: (emailAdmin: string) => adicionarAdmin(emailAdmin),
    onSuccess: () => {
      setMessage({ text: "Administrador adicionado com sucesso!", type: "success" });
      setEmail("");
    },
    onError: (err: any) => {
      setMessage({
        text: err?.response?.data?.erro ?? "Falha ao adicionar administrador.",
        type: "error",
      });
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!email.trim()) return;
    mutate(email.trim());
  }

  return (
    (user?.role === "SUPERADMIN" && (<section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
        Promover novo Administrador
      </h2>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        Exclusivo para SuperAdmin. Insira o e-mail de um usuário cadastrado para dar privilégios de administrador.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="email"
            required
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={isPending || !email.trim()}
            className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          >
            {isPending ? "Promovendo…" : "Adicionar Admin"}
          </button>
        </div>

        {message && (
          <p
            className={`text-xs ${
              message.type === "success" ? "text-emerald-500" : "text-[var(--danger)]"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>
    </section>))
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
            className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
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
          className="mt-1 self-start rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
        >
          {isPending ? "Enviando…" : "Enviar PDF"}
        </button>
      </form>
    </section>
  );
}

function ProjectsSection() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: listarProjetosAdmin,
  });

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
        Projetos cadastrados
      </h2>
      {isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}
      <ul className="flex flex-col gap-2">
        {projects?.map((project) => (
          <li
            key={project.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {project.title}
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnansweredQuestionsSection() {
  const { data: questions, isLoading } = useQuery({
    queryKey: ["unanswered-questions"],
    queryFn: listarPerguntasNaoRespondidas,
  });

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

      <ul className="flex flex-col gap-2">
        {questions?.map((q) => (
          <UnansweredQuestionItem key={q.id} question={q} />
        ))}
      </ul>
    </section>
  );
}

function UnansweredQuestionItem({ question: q }: { question: UnansweredQuestion }) {
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState("");

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
        {q.user ? ` · ${q.user.email}` : ""}
      </p>

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
            className="rounded-lg bg-[var(--accent)] px-2 py-1 text-xs font-medium text-[var(--accent-contrast)] disabled:opacity-50"
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