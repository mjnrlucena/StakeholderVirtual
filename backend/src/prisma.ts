import { PrismaClient } from "@prisma/client";

// Uma única instância do Prisma Client reaproveitada em toda a aplicação
// (evita esgotar as conexões do Postgres em ambientes com hot-reload).
export const prisma = new PrismaClient();
