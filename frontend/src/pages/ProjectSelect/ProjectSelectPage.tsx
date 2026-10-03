import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { listarProjetos } from "@/services/api";

export function ProjectSelectPage() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listarProjetos,
  });

  // Garante que é um array para evitar crash
  const projectList = Array.isArray(projects) ? projects : [];

  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-y-auto px-4 pb-10 pt-20">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text-primary)]">
        Escolha um projeto
      </h1>
      <p className="mb-6 text-sm text-[var(--text-secondary)]">
        Cada projeto tem um relatório diferente por trás do stakeholder virtual.
        Seu chat com cada um é salvo separadamente.
      </p>

      {isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}

      {!isLoading && projectList.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">
          Nenhum projeto cadastrado ainda.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {projectList.map((project) => (
          <Link
            key={project.id}
            to={`/projetos/${project.id}`}
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4  hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
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
            <ChevronRight size={18} className="shrink-0 text-[var(--text-secondary)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}