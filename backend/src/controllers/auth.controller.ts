import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { env } from "../env";
import { HttpError } from "../middleware/errorHandler";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "../services/token.service";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

const cookieOpts = {
  httpOnly: true,
  secure: env.cookieSecure,
  // "none" é obrigatório para cookies cross-domain (Vercel <-> Render);
  // exige secure=true, então em produção COOKIE_SECURE deve ser "true".
  sameSite: env.cookieSecure ? ("none" as const) : ("lax" as const),
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("accessToken", accessToken, {
    ...cookieOpts,
    maxAge: env.accessTokenTtlMin * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOpts,
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    path: "/auth", // só é enviado de volta nas rotas de auth (refresh/logout)
  });
}

export async function register(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "Já existe uma conta com esse e-mail");

  const passwordHash = await bcrypt.hash(password, 12);
  // Autocadastro sempre cria papel USER — admins só são promovidos manualmente.
  const user = await prisma.user.create({ data: { email, passwordHash } });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json({ id: user.id, email: user.email, role: user.role });
}

export async function login(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(401, "E-mail ou senha inválidos");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new HttpError(401, "E-mail ou senha inválidos");

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  res.json({ id: user.id, email: user.email, role: user.role });
}

export async function refresh(req: Request, res: Response) {
  const rawRefreshToken = req.cookies?.refreshToken;
  if (!rawRefreshToken) throw new HttpError(401, "Sem sessão para renovar");

  const result = await rotateRefreshToken(rawRefreshToken);
  if (!result) throw new HttpError(401, "Sessão inválida ou expirada, faça login novamente");

  const accessToken = signAccessToken({ sub: result.userId, role: result.role });
  setAuthCookies(res, accessToken, result.newRefreshToken);

  res.json({ ok: true });
}

export async function logout(req: Request, res: Response) {
  const rawRefreshToken = req.cookies?.refreshToken;
  if (rawRefreshToken) await revokeRefreshToken(rawRefreshToken);

  res.clearCookie("accessToken", cookieOpts);
  res.clearCookie("refreshToken", { ...cookieOpts, path: "/auth" });
  res.json({ ok: true });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ id: user.id, email: user.email, role: user.role });
}
