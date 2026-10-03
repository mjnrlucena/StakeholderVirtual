import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { conversaDoLog } from "@/services/api";
import { ROLE_LABEL } from "@/lib/roles";
import type { LogEntry } from "@/types/logs";
import { formatDateTime, formatLatency } from "./format";
import { highlight } from "./highlight";

interface Props {
  log: LogEntry;
  /** Termos da busca geral (valem para pergunta e resposta). */
  generalTerms: string[];
  promptTerms: string[];
  responseTerms: string[];
}

const pillBase = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";
const pillNeutral = `${pillBase} border-[var(--border)] text-[var(--text-secondary)]`;
const pillAccent = `${pillBase} border-transparent bg-[var(--accent-soft)] text-[var(--accent)]`;
const pillDanger = `${pillBase} border-[var(--danger)] text-[var(--danger)]`;

export function LogItem({ log, generalTerms, promptTerms, responseTerms }: Props) {
  const [open, setOpen] = useState(false);
  const [showSession, setShowSession] = useState(false);

  const isFeedback = log.kind === "FEEDBACK";
  const pTerms = [...generalTerms, ...promptTerms];
  const rTerms = [...generalTerms, ...responseTerms];

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start gap-3 rounded-2xl p-3 text-left  hover:bg-[var(--surface-hover)]"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={pillAccent}>{log.turmaNome}</span>
            <span className="text-xs text-[var(--text-secondary)]">{log.projectTitle}</span>
            <span className="text-xs text-[var(--text-secondary)]">· {formatDateTime(log.createdAt)}</span>
            {isFeedback && <span className={pillNeutral}>Feedback</span>}
            {log.coveredByReport === false && <span className={pillDanger}>Não coberta pelo relatório</span>}
            {log.grounded === false && (
              <span
                className={pillDanger}
                title="A IA tentou inventar algo que não está no relatório; o verificador barrou e a resposta mostrada ao aluno já é a versão corrigida."
              >
                Invenção barrada
              </span>
            )}
            {log.error && <span className={pillDanger}>Falha</span>}
          </div>

          <p className={`text-sm text-[var(--text-primary)] ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
            {highlight(log.prompt, pTerms)}
          </p>
          <p
            className={`mt-1 text-sm text-[var(--text-secondary)] ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}
          >
            {log.error ? `Erro: ${log.error}` : highlight(log.response, rTerms)}
          </p>
        </div>

        <ChevronDown
          size={16}
          className={`mt-1 shrink-0 text-[var(--text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-3 pb-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={pillNeutral}>{ROLE_LABEL[log.userRole]}</span>
            <span className={pillNeutral}>Resposta em {formatLatency(log.latencyMs)}</span>
            {log.coveredByReport === true && <span className={pillNeutral}>Coberta pelo relatório</span>}
            {log.grounded === true && <span className={pillNeutral}>Fiel ao relatório</span>}
          </div>

          <button
            type="button"
            onClick={() => setShowSession((v) => !v)}
            className="mt-3 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]  hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            {showSession ? "Ocultar conversa" : "Ver conversa completa"}
          </button>

          {showSession && <SessionView sessionId={log.sessionId} currentId={log.id} />}
        </div>
      )}
    </li>
  );
}

function SessionView({ sessionId, currentId }: { sessionId: string; currentId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["log-session", sessionId],
    queryFn: () => conversaDoLog(sessionId),
  });

  if (isLoading) return <p className="mt-3 text-xs text-[var(--text-secondary)]">Carregando conversa…</p>;
  if (isError || !data) return <p className="mt-3 text-xs text-[var(--danger)]">Não foi possível carregar a conversa.</p>;

  return (
    <ol className="mt-3 flex flex-col gap-2">
      {data.map((entry) => (
        <li
          key={entry.id}
          className={`rounded-xl border px-3 py-2 ${
            entry.id === currentId ? "border-[var(--accent)]" : "border-[var(--border)]"
          } bg-[var(--background)]`}
        >
          <p className="text-[11px] text-[var(--text-secondary)]">
            {formatDateTime(entry.createdAt)}
            {entry.kind === "FEEDBACK" ? " · Feedback" : ""}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{entry.prompt}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
            {entry.error ? `Erro: ${entry.error}` : entry.response}
          </p>
        </li>
      ))}
    </ol>
  );
}
