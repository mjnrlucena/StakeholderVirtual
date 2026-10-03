import type { Role } from "@/types/auth";
import type { LogFilterOptions, LogKind, LogParams } from "@/types/logs";
import { ROLE_LABEL } from "@/lib/roles";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

// Um <label> envolvendo vários botões faz o navegador repassar o :hover (e o
// clique no rótulo) ao PRIMEIRO botão do grupo. Por isso grupos de chips usam
// <div role="group">; <label> fica só para campos de formulário de verdade.
function Field({ label, group = false, children }: { label: string; group?: boolean; children: React.ReactNode }) {
  const title = <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>;

  if (group) {
    return (
      <div role="group" aria-label={label} className="flex flex-col gap-1">
        {title}
        {children}
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      {title}
      {children}
    </label>
  );
}

function Chips<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            aria-pressed={on}
            className={`max-w-full cursor-pointer break-words rounded-full border px-3 py-1 text-left text-xs  ${
              on
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function toggle<T>(list: T[] | undefined, value: T): T[] {
  const cur = list ?? [];
  return cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
}

const ROLES: Role[] = ["ALUNO", "PROFESSOR", "GESTOR", "SUPERADMIN"];
const KINDS: { value: LogKind; label: string }[] = [
  { value: "PERGUNTA", label: "Perguntas" },
  { value: "FEEDBACK", label: "Feedbacks" },
];

export function FiltersPanel({
  filters,
  options,
  onChange,
}: {
  filters: LogParams;
  options?: LogFilterOptions;
  onChange: (patch: Partial<LogParams>) => void;
}) {
  return (
    <div className="mb-4 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field group label="Turmas (uma ou mais)">
          <Chips
            options={(options?.turmas ?? []).map((t) => ({ value: t.id, label: t.nome }))}
            selected={filters.turmas ?? []}
            onToggle={(v) => onChange({ turmas: toggle(filters.turmas, v) })}
          />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field group label="Projetos (um ou mais)">
          <Chips
            options={(options?.projetos ?? []).map((p) => ({ value: p.id, label: p.title }))}
            selected={filters.projetos ?? []}
            onToggle={(v) => onChange({ projetos: toggle(filters.projetos, v) })}
          />
        </Field>
      </div>

      <Field label="Prompt contém">
        <input
          className={inputCls}
          placeholder="Só na pergunta enviada"
          value={filters.prompt ?? ""}
          onChange={(e) => onChange({ prompt: e.target.value })}
        />
      </Field>

      <Field label="Resposta contém">
        <input
          className={inputCls}
          placeholder="Só na resposta recebida"
          value={filters.resposta ?? ""}
          onChange={(e) => onChange({ resposta: e.target.value })}
        />
      </Field>

      <Field label="Cobertura pelo relatório">
        <select
          className={inputCls}
          value={filters.cobertura ?? ""}
          onChange={(e) => onChange({ cobertura: (e.target.value || undefined) as LogParams["cobertura"] })}
        >
          <option value="">Todas</option>
          <option value="coberta">Cobertas</option>
          <option value="nao_coberta">Não cobertas</option>
        </select>
      </Field>

      <Field label="Fidelidade ao relatório">
        <select
          className={inputCls}
          value={filters.fundamentacao ?? ""}
          onChange={(e) => onChange({ fundamentacao: (e.target.value || undefined) as LogParams["fundamentacao"] })}
        >
          <option value="">Todas</option>
          <option value="fundamentada">Fiéis ao relatório</option>
          <option value="nao_fundamentada">Invenção barrada pelo verificador</option>
        </select>
      </Field>

      <Field label="De">
        <input type="date" className={inputCls} value={filters.de ?? ""} max={filters.ate || undefined} onChange={(e) => onChange({ de: e.target.value || undefined })} />
      </Field>

      <Field label="Até">
        <input type="date" className={inputCls} value={filters.ate ?? ""} min={filters.de || undefined} onChange={(e) => onChange({ ate: e.target.value || undefined })} />
      </Field>

      <Field group label="Tipo">
        <Chips
          options={KINDS}
          selected={filters.tipos ?? []}
          onToggle={(v) => onChange({ tipos: toggle(filters.tipos, v) })}
        />
      </Field>

      <Field group label="Perfil de quem perguntou">
        <Chips
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          selected={filters.perfis ?? []}
          onToggle={(v) => onChange({ perfis: toggle(filters.perfis, v) })}
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)] sm:col-span-2">
        <input
          type="checkbox"
          checked={filters.somenteErros ?? false}
          onChange={(e) => onChange({ somenteErros: e.target.checked })}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Mostrar só interações com falha
      </label>
    </div>
  );
}
