// Roda antes de `prisma migrate deploy` (ver script "prisma:migrate").
//
// Bancos criados com `prisma db push` (antes de as migrations irem pro git) já
// têm as tabelas, mas não têm a migration inicial registrada — o deploy
// tentaria criá-las de novo e falharia. Aqui a init é marcada como aplicada só
// nesse caso: tabela "User" existe e a init não consta em _prisma_migrations.
// Banco novo (vazio) ou já migrado: não faz nada.
const { execSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const INIT = "20261002202542_init";

async function needsBaseline(prisma) {
  const [{ user, migrations }] = await prisma.$queryRaw`
    SELECT to_regclass('public."User"') IS NOT NULL AS "user",
           to_regclass('public."_prisma_migrations"') IS NOT NULL AS "migrations"`;
  if (!user) return false;
  if (!migrations) return true;
  const applied = await prisma.$queryRaw`
    SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${INIT} AND finished_at IS NOT NULL`;
  return applied.length === 0;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    if (!(await needsBaseline(prisma))) return;
  } finally {
    await prisma.$disconnect();
  }
  console.log(`[baseline] banco criado sem migrations: marcando ${INIT} como aplicada`);
  execSync(`npx prisma migrate resolve --applied ${INIT}`, { stdio: "inherit" });
}

main().catch((err) => {
  console.error("[baseline] falhou:", err);
  process.exit(1);
});
