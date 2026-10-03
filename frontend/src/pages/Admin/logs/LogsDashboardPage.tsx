import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDebounced } from "@/hooks/useDebounced";
import { listarLogs, opcoesFiltroLogs, resumoLogs } from "@/services/api";
import type { LogOrder, LogParams } from "@/types/logs";
import { FiltersPanel } from "./FiltersPanel";
import { parseTerms } from "./highlight";
import { LogItem } from "./LogItem";
import { SummarySection } from "./SummarySection";

const PAGE_SIZE = 20;

// Conta quantos filtros (fora a busca geral e a ordem) estão ativos.
function countActiveFilters(f: LogParams): number {
  return [
    f.prompt,
    f.resposta,
    f.turmas?.length,
    f.projetos?.length,
    f.perfis?.length,
    f.tipos?.length,
    f.cobertura,
    f.fundamentacao,
    f.somenteErros,
    f.de,
    f.ate,
  ].filter(Boolean).length;
}

export function LogsDashboardPage() {
  const [filters, setFilters] = useState<LogParams>({ ordem: "recentes", pagina: 1 });
  const [showFilters, setShowFilters] = useState(false);

  // A digitação é debounced; chips, selects e datas também passam por aqui (300 ms).
  const applied = useDebounced(filters, 300);

  function update(patch: Partial<LogParams>) {
    setFilters((prev) => ({ ...prev, ...patch, pagina: patch.pagina ?? 1 }));
  }

  function toggleIn(key: "turmas" | "projetos", id: string) {
    const cur = filters[key] ?? [];
    update({ [key]: cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id] });
  }

  function clearAll() {
    setFilters({ ordem: "recentes", pagina: 1 });
  }

  // O resumo olha o mesmo recorte da lista, mas sem paginação nem ordem.
  const summaryParams = useMemo<LogParams>(() => {
    const { pagina: _p, porPagina: _pp, ordem: _o, ...rest } = applied;
    return rest;
  }, [applied]);

  const listQuery = useQuery({
    queryKey: ["logs", applied],
    queryFn: () => listarLogs({ ...applied, porPagina: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const summaryQuery = useQuery({
    queryKey: ["logs-summary", summaryParams],
    queryFn: () => resumoLogs(summaryParams),
    placeholderData: keepPreviousData,
  });

  const optionsQuery = useQuery({ queryKey: ["log-filter-options"], queryFn: opcoesFiltroLogs });

  const generalTerms = useMemo(() => parseTerms(applied.q), [applied.q]);
  const promptTerms = useMemo(() => parseTerms(applied.prompt), [applied.prompt]);
  const responseTerms = useMemo(() => parseTerms(applied.resposta), [applied.resposta]);

  const activeFilters = countActiveFilters(filters);
  const hasAnything = activeFilters > 0 || Boolean(filters.q);
  const hasTextSearch = Boolean(filters.q || filters.prompt || filters.resposta);
  const page = listQuery.data;

  return (
    <div className="no-scrollbar h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-20">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Dashboard de conversas</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Perguntas e respostas registradas, identificadas pela turma.{" "}
            <Link to="/admin" className="text-[var(--accent)]">
              Voltar ao hub
            </Link>
          </p>
        </div>

        {summaryQuery.data && (
          <SummarySection
            summary={summaryQuery.data}
            activeTurmas={filters.turmas ?? []}
            activeProjetos={filters.projetos ?? []}
            onPickTurma={(id) => toggleIn("turmas", id)}
            onPickProjeto={(id) => toggleIn("projetos", id)}
          />
        )}

        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Conversas</h2>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="search"
              value={filters.q ?? ""}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Buscar em perguntas e respostas…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="topbar-btn"
          >
            <SlidersHorizontal size={15} />
            Filtros
            {activeFilters > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-[11px] text-[var(--accent-contrast)]">
                {activeFilters}
              </span>
            )}
          </button>

          <select
            value={filters.ordem}
            onChange={(e) => update({ ordem: e.target.value as LogOrder })}
            aria-label="Ordenar por"
            className="h-9 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigas">Mais antigas</option>
            <option value="relevancia" disabled={!hasTextSearch}>
              Mais relevantes
            </option>
          </select>
        </div>

        <p className="mb-3 text-xs text-[var(--text-secondary)]">
          A busca ignora acentos e maiúsculas, aceita várias palavras (todas precisam aparecer), "frase exata" entre
          aspas e perdoa pequenos erros de digitação. Ela funciona junto com todos os filtros.
        </p>

        {showFilters && <FiltersPanel filters={filters} options={optionsQuery.data} onChange={update} />}

        {hasAnything && (
          <button
            type="button"
            onClick={clearAll}
            className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={13} /> Limpar busca e filtros
          </button>
        )}

        {listQuery.isLoading && <p className="text-sm text-[var(--text-secondary)]">Carregando…</p>}
        {listQuery.isError && (
          <p className="text-sm text-[var(--danger)]">Não foi possível carregar os logs. Tente novamente.</p>
        )}
        {page && page.items.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-secondary)]">
            {hasAnything ? "Nenhuma conversa encontrada com esses filtros." : "Nenhuma conversa registrada ainda."}
          </div>
        )}

        {page && page.items.length > 0 && (
          <>
            <p className="mb-2 text-xs text-[var(--text-secondary)]">
              {page.total} {page.total === 1 ? "resultado" : "resultados"}
            </p>

            <ul className={`flex flex-col gap-2 transition-opacity ${listQuery.isPlaceholderData ? "opacity-60" : ""}`}>
              {page.items.map((log) => (
                <LogItem
                  key={log.id}
                  log={log}
                  generalTerms={generalTerms}
                  promptTerms={promptTerms}
                  responseTerms={responseTerms}
                />
              ))}
            </ul>

            {page.totalPaginas > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  className="topbar-btn"
                  disabled={page.pagina <= 1}
                  onClick={() => update({ pagina: page.pagina - 1 })}
                >
                  <ChevronLeft size={15} /> Anterior
                </button>
                <span className="text-xs text-[var(--text-secondary)]">
                  Página {page.pagina} de {page.totalPaginas}
                </span>
                <button
                  type="button"
                  className="topbar-btn"
                  disabled={page.pagina >= page.totalPaginas}
                  onClick={() => update({ pagina: page.pagina + 1 })}
                >
                  Próxima <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
