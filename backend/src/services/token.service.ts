import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../env";
import { prisma } from "../prisma";

export interface AccessTokenPayload {
  sub: string; // userId
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: `${env.accessTokenTtlMin}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// O refresh token em si nunca é salvo no banco, só o hash dele — assim,
// se o banco vazar, os tokens de sessão continuam inúteis para um atacante.
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt,
    },
  });

  // Concatena o id do usuário só para facilitar o lookup na hora do refresh
  // (evita ter que varrer a tabela inteira procurando o hash igual).
  return `${userId}.${raw}`;
}

export async function rotateRefreshToken(
  rawToken: string
): Promise<{ userId: string; role: Role; newRefreshToken: string } | null> {
  const [userId, raw] = rawToken.split(".");
  if (!userId || !raw) return null;

  const tokenHash = hashToken(raw);
  const stored = await prisma.refreshToken.findFirst({
    where: { userId, tokenHash, revokedAt: null },
  });

  if (!stored || stored.expiresAt < new Date()) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Rotação: revoga o token usado e emite um novo — se o mesmo token
  // aparecer de novo depois disso, é sinal de reuso indevido/roubo.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const newRefreshToken = await issueRefreshToken(userId);
  return { userId: user.id, role: user.role, newRefreshToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const [userId, raw] = rawToken.split(".");
  if (!userId || !raw) return;
  const tokenHash = hashToken(raw);
  await prisma.refreshToken.updateMany({
    where: { userId, tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
