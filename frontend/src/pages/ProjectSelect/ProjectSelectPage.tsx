import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { listarProjetos } from "@/services/api";

export function ProjectSelectPage() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listarProjetos,
  });

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

      {!isLoading && projects?.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">
          Nenhum projeto cadastrado ainda.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {projects?.map((project) => (
          <Link
            key={project.id}
            to={`/projetos/${project.id}`}
            className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:bg-[var(--surface-hover)]"
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-[var(--text-secondary)]">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {project.title}
              </p>
              {project.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                  {project.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
