import { LogKind, Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";

/**
 * Busca + filtros do dashboard de logs.
 *
 * Todos os critérios são combinados com AND: o que o professor preencher
 * (busca geral, "prompt contém", "resposta contém", turmas, projetos,
 * perfil, tipo, cobertura, fundamentação, período, erros) restringe o
 * mesmo conjunto. Dentro de um mesmo filtro de lista (ex.: várias turmas)
 * vale OR.
 *
 * Busca de texto: sem acento, sem diferença de maiúsculas, vários termos
 * (todos precisam aparecer), "frase exata" entre aspas e tolerância a
 * erros de digitação em termos com 4+ letras (pg_trgm). Os índices GIN
 * criados na migration usam exatamente a expressão de `col()`.
 */

const TZ = "America/Fortaleza";
const MAX_TERMS = 8;

// --- Schema dos parâmetros --------------------------------------------------

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const toArray = (v: unknown) => (v === undefined || v === "" ? undefined : Array.isArray(v) ? v : [v]);
const dateStr = z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());

export const logFiltersSchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
  prompt: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
  resposta: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
  turmas: z.preprocess(toArray, z.array(z.string().min(1)).max(100).optional()),
  projetos: z.preprocess(toArray, z.array(z.string().min(1)).max(100).optional()),
  perfis: z.preprocess(toArray, z.array(z.nativeEnum(Role)).optional()),
  tipos: z.preprocess(toArray, z.array(z.nativeEnum(LogKind)).optional()),
  cobertura: z.preprocess(emptyToUndefined, z.enum(["coberta", "nao_coberta"]).optional()),
  fundamentacao: z.preprocess(emptyToUndefined, z.enum(["fundamentada", "nao_fundamentada"]).optional()),
  somenteErros: z.preprocess((v) => v === "true" || v === true, z.boolean()),
  de: dateStr,
  ate: dateStr,
  ordem: z.preprocess(emptyToUndefined, z.enum(["recentes", "antigas", "relevancia"]).default("recentes")),
  pagina: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
  porPagina: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(20)),
});

export type LogFilters = z.infer<typeof logFiltersSchema>;

// --- Termos de busca ----------------------------------------------------------

interface Term {
  text: string;
  fuzzy: boolean;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseTerms(input?: string): Term[] {
  if (!input) return [];
  const terms: Term[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(input)) && terms.length < MAX_TERMS) {
    const isPhrase = match[1] !== undefined;
    let text = normalize(match[1] ?? match[2]);
    // "como?" deve achar "como": tira pontuação das pontas de termos soltos.
    if (!isPhrase) text = text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!text) continue;
    terms.push({ text, fuzzy: !isPhrase && /^[a-z0-9]{4,}$/.test(text) });
  }
  return terms;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

type TextColumn = "prompt" | "response";

// Mesma expressão dos índices GIN da migration.
const col = (c: TextColumn) => Prisma.raw(`public.immutable_unaccent(lower("${c}"))`);

function termCondition(term: Term, columns: TextColumn[]): Prisma.Sql {
  const like = `%${escapeLike(term.text)}%`;
  const checks: Prisma.Sql[] = [];
  for (const c of columns) {
    checks.push(Prisma.sql`${col(c)} LIKE ${like}`);
    if (term.fuzzy) checks.push(Prisma.sql`${term.text}::text <% ${col(c)}`);
  }
  return Prisma.sql`(${Prisma.join(checks, " OR ")})`;
}

function termScore(term: Term, columns: TextColumn[]): Prisma.Sql {
  const sims = columns.map((c) => Prisma.sql`word_similarity(${term.text}::text, ${col(c)})`);
  return Prisma.sql`greatest(${Prisma.join(sims)})`;
}

// --- WHERE ----------------------------------------------------------------------

interface Built {
  conditions: Prisma.Sql[];
  score: Prisma.Sql | null;
}

function build(f: LogFilters): Built {
  const conditions: Prisma.Sql[] = [];
  const scores: Prisma.Sql[] = [];

  const textSets: { input?: string; columns: TextColumn[] }[] = [
    { input: f.q, columns: ["prompt", "response"] },
    { input: f.prompt, columns: ["prompt"] },
    { input: f.resposta, columns: ["response"] },
  ];
  for (const set of textSets) {
    for (const term of parseTerms(set.input)) {
      conditions.push(termCondition(term, set.columns));
      scores.push(termScore(term, set.columns));
    }
  }

  if (f.turmas?.length) {
    const ids = f.turmas.filter((t) => t !== "none");
    const parts: Prisma.Sql[] = [];
    if (ids.length) parts.push(Prisma.sql`"turmaId" IN (${Prisma.join(ids)})`);
    if (f.turmas.includes("none")) parts.push(Prisma.sql`"turmaId" IS NULL`);
    conditions.push(Prisma.sql`(${Prisma.join(parts, " OR ")})`);
  }

  if (f.projetos?.length) {
    conditions.push(Prisma.sql`"projectId" IN (${Prisma.join(f.projetos)})`);
  }

  if (f.perfis?.length) {
    const roles = f.perfis.map((r) => Prisma.sql`${r}::"Role"`);
    conditions.push(Prisma.sql`"userRole" IN (${Prisma.join(roles)})`);
  }

  if (f.tipos?.length) {
    const kinds = f.tipos.map((k) => Prisma.sql`${k}::"LogKind"`);
    conditions.push(Prisma.sql`kind IN (${Prisma.join(kinds)})`);
  }

  if (f.cobertura === "coberta") conditions.push(Prisma.sql`"coveredByReport" = true`);
  if (f.cobertura === "nao_coberta") conditions.push(Prisma.sql`"coveredByReport" = false`);
  if (f.fundamentacao === "fundamentada") conditions.push(Prisma.sql`grounded = true`);
  if (f.fundamentacao === "nao_fundamentada") conditions.push(Prisma.sql`grounded = false`);
  if (f.somenteErros) conditions.push(Prisma.sql`error IS NOT NULL`);

  // createdAt é "timestamp" gravado em UTC; o período é interpretado no
  // fuso de Natal (America/Fortaleza), que é o que o professor enxerga.
  if (f.de) {
    conditions.push(
      Prisma.sql`("createdAt" AT TIME ZONE 'UTC') >= (${f.de}::date)::timestamp AT TIME ZONE 'America/Fortaleza'`,
    );
  }
  if (f.ate) {
    conditions.push(
      Prisma.sql`("createdAt" AT TIME ZONE 'UTC') < ((${f.ate}::date + 1)::timestamp AT TIME ZONE 'America/Fortaleza')`,
    );
  }

  return { conditions, score: scores.length ? Prisma.sql`(${Prisma.join(scores, " + ")})` : null };
}

const whereOf = (conditions: Prisma.Sql[]) =>
  conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

// --- Consultas ------------------------------------------------------------------

export interface LogRow {
  id: string;
  createdAt: Date;
  kind: LogKind;
  sessionId: string;
  userRole: Role;
  turmaId: string | null;
  turmaNome: string;
  projectId: string;
  projectTitle: string;
  prompt: string;
  response: string;
  grounded: boolean | null;
  coveredByReport: boolean | null;
  latencyMs: number;
  error: string | null;
}

export async function searchLogs(f: LogFilters) {
  const { conditions, score } = build(f);
  const where = whereOf(conditions);

  const orderBy =
    f.ordem === "antigas"
      ? Prisma.sql`"createdAt" ASC`
      : f.ordem === "relevancia" && score
        ? Prisma.sql`${score} DESC, "createdAt" DESC`
        : Prisma.sql`"createdAt" DESC`;

  const offset = (f.pagina - 1) * f.porPagina;

  const [items, totals] = await Promise.all([
    prisma.$queryRaw<LogRow[]>(Prisma.sql`
      SELECT id, "createdAt", kind, "sessionId", "userRole", "turmaId", "turmaNome",
             "projectId", "projectTitle", prompt, response, grounded, "coveredByReport",
             "latencyMs", error
      FROM "InteractionLog"
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${f.porPagina}::int OFFSET ${offset}::int
    `),
    prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT count(*)::int AS count FROM "InteractionLog" ${where}
    `),
  ]);

  const total = totals[0]?.count ?? 0;
  return {
    items,
    total,
    pagina: f.pagina,
    porPagina: f.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / f.porPagina)),
  };
}

// O resumo respeita os mesmos filtros da lista: os cards e rankings
// mostram exatamente o recorte que está sendo visto.
export async function summarizeLogs(f: LogFilters) {
  const { conditions } = build(f);
  const where = whereOf(conditions);

  // Sem período escolhido, o gráfico diário mostra só os últimos 14 dias.
  const dayConditions =
    f.de || f.ate
      ? conditions
      : [...conditions, Prisma.sql`"createdAt" >= (now() AT TIME ZONE 'UTC') - interval '14 days'`];

  const [totals, byTurma, byProject, byDay] = await Promise.all([
    prisma.$queryRaw<
      {
        total: number;
        activeUsers: number;
        questions: number;
        notCovered: number;
        ungrounded: number;
        avgLatencyMs: number;
        errors: number;
      }[]
    >(Prisma.sql`
      SELECT count(*)::int AS total,
             count(DISTINCT "userId")::int AS "activeUsers",
             count(*) FILTER (WHERE kind = 'PERGUNTA')::int AS questions,
             count(*) FILTER (WHERE kind = 'PERGUNTA' AND "coveredByReport" = false)::int AS "notCovered",
             count(*) FILTER (WHERE grounded = false)::int AS ungrounded,
             coalesce(round(avg("latencyMs")), 0)::int AS "avgLatencyMs",
             count(*) FILTER (WHERE error IS NOT NULL)::int AS errors
      FROM "InteractionLog" ${where}
    `),
    prisma.$queryRaw<{ turmaId: string | null; turmaNome: string; count: number }[]>(Prisma.sql`
      SELECT "turmaId", max("turmaNome") AS "turmaNome", count(*)::int AS count
      FROM "InteractionLog" ${where}
      GROUP BY "turmaId"
      ORDER BY count DESC, max("turmaNome") ASC
      LIMIT 8
    `),
    prisma.$queryRaw<{ projectId: string; projectTitle: string; count: number }[]>(Prisma.sql`
      SELECT "projectId", max("projectTitle") AS "projectTitle", count(*)::int AS count
      FROM "InteractionLog" ${where}
      GROUP BY "projectId"
      ORDER BY count DESC, max("projectTitle") ASC
      LIMIT 6
    `),
    prisma.$queryRaw<{ day: string; count: number }[]>(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date, 'YYYY-MM-DD') AS day,
             count(*)::int AS count
      FROM "InteractionLog" ${whereOf(dayConditions)}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 31
    `),
  ]);

  const t = totals[0];
  return {
    total: t?.total ?? 0,
    activeUsers: t?.activeUsers ?? 0,
    questions: t?.questions ?? 0,
    notCovered: t?.notCovered ?? 0,
    ungrounded: t?.ungrounded ?? 0,
    avgLatencyMs: t?.avgLatencyMs ?? 0,
    errors: t?.errors ?? 0,
    byTurma,
    byProject,
    byDay: byDay.reverse(),
  };
}

// Opções dos filtros: todas as turmas e projetos cadastrados (mesmo os
// ainda sem logs) + "Sem turma" quando a equipe também gerou logs.
export async function getLogFilterOptions() {
  const [turmas, projetos, semTurma] = await Promise.all([
    prisma.turma.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.project.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.interactionLog.count({ where: { turmaId: null } }),
  ]);

  return {
    turmas: semTurma > 0 ? [...turmas, { id: "none", nome: "Sem turma" }] : turmas,
    projetos,
  };
}

// Conversa completa de uma sessão (entre dois "Nova conversa").
export async function getSessionLogs(sessionId: string) {
  return prisma.interactionLog.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      kind: true,
      prompt: true,
      response: true,
      grounded: true,
      coveredByReport: true,
      latencyMs: true,
      error: true,
    },
  });
}
