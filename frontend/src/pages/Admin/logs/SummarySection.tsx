import type { LogsSummary } from "@/types/logs";
import { formatDayLabel, formatLatency, percent } from "./format";

function Card({ label, value, hint, tone = "accent" }: { label: string; value: string; hint?: string; tone?: "accent" | "danger" }) {
  return (
    <div
      className={`rounded-2xl border border-t-2 border-[var(--border)] bg-[var(--surface)] p-4 ${
        tone === "danger" ? "border-t-[var(--danger)]" : "border-t-[var(--accent)]"
      }`}
    >
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{hint}</div>}
    </div>
  );
}

function Ranking({
  title,
  items,
  isActive,
  onPick,
}: {
  title: string;
  items: { key: string; label: string; count: number }[];
  isActive: (key: string) => boolean;
  onPick: (key: string) => void;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      {items.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Sem dados para este filtro.</p>}
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onPick(item.key)}
              title="Clique para filtrar"
              className={`w-full cursor-pointer rounded-lg px-2 py-1 text-left  hover:bg-[var(--surface-hover)] ${
                isActive(item.key) ? "bg-[var(--accent-soft)]" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words text-[var(--text-primary)]">
                  <span className="mr-2 text-[var(--text-secondary)]">{i + 1}</span>
                  {item.label}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">{item.count}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-[var(--border)]">
                <div
                  className="h-1 rounded-full bg-[var(--accent)]"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Preenche os dias sem interações com zero, para o gráfico não enganar.
function fillDays(byDay: { day: string; count: number }[]) {
  if (byDay.length === 0) return [];
  const map = new Map(byDay.map((d) => [d.day, d.count]));
  const out: { day: string; count: number }[] = [];
  const cursor = new Date(`${byDay[0].day}T12:00:00Z`);
  const end = new Date(`${byDay[byDay.length - 1].day}T12:00:00Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ day: key, count: map.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function SummarySection({
  summary,
  activeTurmas,
  activeProjetos,
  onPickTurma,
  onPickProjeto,
}: {
  summary: LogsSummary;
  activeTurmas: string[];
  activeProjetos: string[];
  onPickTurma: (id: string) => void;
  onPickProjeto: (id: string) => void;
}) {
  const days = fillDays(summary.byDay);
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card label="Interações" value={String(summary.total)} hint={`${summary.questions} perguntas`} />
        <Card label="Pessoas ativas" value={String(summary.activeUsers)} />
        <Card
          label="Não cobertas pelo relatório"
          value={String(summary.notCovered)}
          hint={percent(summary.notCovered, summary.questions) + " das perguntas"}
          tone="danger"
        />
        <Card label="Invenções barradas" value={String(summary.ungrounded)} hint="respostas corrigidas pelo verificador" tone="danger" />
        <Card label="Tempo médio de resposta" value={formatLatency(summary.avgLatencyMs)} />
        <Card label="Falhas" value={String(summary.errors)} tone={summary.errors > 0 ? "danger" : "accent"} />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <Ranking
          title="Interações por turma"
          items={summary.byTurma.map((t) => ({ key: t.turmaId ?? "none", label: t.turmaNome, count: t.count }))}
          isActive={(k) => activeTurmas.includes(k)}
          onPick={onPickTurma}
        />
        <Ranking
          title="Projetos mais consultados"
          items={summary.byProject.map((p) => ({ key: p.projectId, label: p.projectTitle, count: p.count }))}
          isActive={(k) => activeProjetos.includes(k)}
          onPick={onPickProjeto}
        />
      </div>

      <div className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Atividade por dia</h3>
        {days.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Sem dados para este filtro.</p>
        ) : (
          <div className="no-scrollbar overflow-x-auto">
            <div className="flex h-28 items-end gap-1.5" style={{ minWidth: days.length * 28 }}>
              {days.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${formatDayLabel(d.day)}: ${d.count}`}>
                  <span className="text-[10px] tabular-nums text-[var(--text-secondary)]">{d.count || ""}</span>
                  <div
                    className="w-full rounded-t bg-[var(--accent)]"
                    style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / maxDay) * 72)}px`, opacity: d.count ? 1 : 0.25 }}
                  />
                  <span className="text-[10px] text-[var(--text-secondary)]">{formatDayLabel(d.day)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
