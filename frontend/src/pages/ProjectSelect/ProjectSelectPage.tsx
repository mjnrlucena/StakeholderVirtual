import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText } from "lucide-react";
import { useState } from "react";
import { SessionList } from "@/components/chat/SessionList";
import { listarProjetos } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

export function ProjectSelectPage() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listarProjetos,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const trocarTurma = useAuthStore((s) => s.trocarTurma);

  // Garante que é um array para evitar crash
  const projectList = Array.isArray(projects) ? projects : [];

  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-y-auto px-4 pb-10 pt-20">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text-primary)]">
        Escolha um projeto
      </h1>
      <p className="mb-6 text-sm text-[var(--text-secondary)]">
        Cada projeto tem um relatório diferente por trás do stakeholder virtual.
        Clique num projeto para continuar uma sessão de conversa ou começar uma nova.
      </p>
      {user && user.turmas.length > 1 && (
        <p className="-mt-4 mb-6 text-xs text-[var(--text-secondary)]">
          Turma: <span className="text-[var(--text-primary)]">{user.turma?.nome ?? "nenhuma"}</span> ·{" "}
          <button type="button" onClick={trocarTurma} className="text-[var(--accent)]">
            Trocar turma
          </button>
        </p>
      )}

      {isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}

      {!isLoading && projectList.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">
          Nenhum projeto disponível para a sua turma ainda.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {projectList.map((project) => {
          const open = openId === project.id;
          return (
            <div
              key={project.id}
              className={`rounded-2xl border bg-[var(--surface)] ${open ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : project.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {project.title}
                  </p>
                  {project.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {project.description}
                    </p>
                  )}
                </div>
                <ChevronRight
                  size={18}
                  className={`shrink-0 text-[var(--text-secondary)] transition-transform ${open ? "rotate-90" : ""}`}
                />
              </button>
              {open && (
                <div className="border-t border-[var(--border)] p-3">
                  <SessionList projectId={project.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}