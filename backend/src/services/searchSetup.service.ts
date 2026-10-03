import { prisma } from "../prisma";

/**
 * Garante, a cada start do backend, a infraestrutura SQL da busca dos logs:
 * extensões unaccent/pg_trgm, a função immutable_unaccent() e os índices GIN.
 *
 * Tudo é idempotente. Existe porque esses objetos só são criados pela
 * migration (SQL escrito à mão): se o banco foi criado com `prisma db push`,
 * ou a migration foi aplicada de outra forma, a função não existe e toda
 * busca falha com "function public.immutable_unaccent(text) does not exist".
 */
export async function ensureLogSearchSetup(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public`);
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public`);

    // Se as extensões já existiam em outro schema (ex.: "extensions" no
    // Supabase), usa o schema real em vez de assumir "public".
    const rows = await prisma.$queryRawUnsafe<{ extname: string; schema: string }[]>(
      `SELECT e.extname, n.nspname AS schema
         FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname IN ('unaccent', 'pg_trgm')`,
    );
    const schemaOf = (name: string) => rows.find((r) => r.extname === name)?.schema ?? "public";
    const unaccentSchema = schemaOf("unaccent");
    const trgmSchema = schemaOf("pg_trgm");

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      PARALLEL SAFE
      STRICT
      AS $fn$ SELECT "${unaccentSchema}".unaccent('${unaccentSchema}.unaccent'::regdictionary, $1) $fn$
    `);

    for (const column of ["prompt", "response"]) {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "InteractionLog_${column}_trgm_idx" ON "InteractionLog"
          USING GIN (public.immutable_unaccent(lower("${column}")) "${trgmSchema}".gin_trgm_ops)
      `);
    }
  } catch (err) {
    // Não derruba o backend: o resto do app funciona sem a busca dos logs.
    console.error("[search-setup] não foi possível preparar a busca dos logs:", err);
  }
}
