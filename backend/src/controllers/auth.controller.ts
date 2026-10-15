import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";
import { env } from "../env";
import { HttpError } from "../middleware/errorHandler";
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken, signAccessToken } from "../services/token.service";
import { sendMail } from "../services/mail.service";
import { comVinculos, turmasDoUsuario, vinculosDoUsuario } from "./turmas.controller";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

const registerSchema = credentialsSchema.extend({
  nome: z.string().trim().min(2, "Informe o seu nome").max(120, "Nome muito longo (máx. 120)"),
  turmaId: z.string().min(1, "Escolha a sua turma"),
  equipeId: z.string().min(1).optional(),
});

type UserWithTurma = {
  id: string;
  email: string;
  nome: string | null;
  role: string;
} & Parameters<typeof turmasDoUsuario>[0];

const withTurmas = comVinculos;

function toAuthUser(user: UserWithTurma) {
  return {
    id: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role,
    turma: user.turma ? { id: user.turma.id, nome: user.turma.nome } : null,
    // Mais de uma: o frontend pede para escolher qual usar depois do login.
    turmas: turmasDoUsuario(user),
  };
}

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
    path: "/", // só é enviado de volta nas rotas de auth (refresh/logout)
  });
}

export async function register(req: Request, res: Response) {
  const { email, password, nome, turmaId, equipeId } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "Já existe uma conta com esse e-mail");

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) throw new HttpError(400, "Turma inválida");
  if (equipeId) {
    const equipe = await prisma.equipe.findUnique({ where: { id: equipeId }, select: { turmaId: true } });
    if (equipe?.turmaId !== turma.id) throw new HttpError(400, "Equipe inválida para essa turma");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Autocadastro sempre cria papel ALUNO — professores/gestores só são
  // promovidos pelo superadmin.
  const user = await prisma.user.create({
    data: { email, nome, passwordHash, turmaId: turma.id, equipeId },
    include: withTurmas,
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json(toAuthUser(user));
}

export async function login(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email }, include: withTurmas });
  if (!user) throw new HttpError(401, "E-mail ou senha inválidos");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new HttpError(401, "E-mail ou senha inválidos");

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  res.json(toAuthUser(user));
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
  res.clearCookie("refreshToken", { ...cookieOpts, path: "/" });
  res.json({ ok: true });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    include: withTurmas,
  });
  res.json(toAuthUser(user));
}

// A própria pessoa altera o nome de exibição.
export async function updateProfile(req: Request, res: Response) {
  const { nome } = registerSchema.pick({ nome: true }).parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { nome },
    include: withTurmas,
  });
  res.json(toAuthUser(user));
}

// --- Redefinição de senha ------------------------------------------------
// O token é um JWT assinado com segredo + hash da senha atual: quando a senha
// muda, todo link antigo deixa de valer (uso único sem precisar de tabela).
function resetSecret(passwordHash: string) {
  return env.jwtAccessSecret + passwordHash;
}

// ponytail: limite em memória, zera ao reiniciar e não vale entre réplicas; trocar por Redis se escalar.
const resetRequests = new Map<string, number[]>();
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX = 3;

function allowResetRequest(email: string): boolean {
  const now = Date.now();
  const recent = (resetRequests.get(email) ?? []).filter((t) => now - t < RESET_WINDOW_MS);
  if (recent.length >= RESET_MAX) return false;
  recent.push(now);
  resetRequests.set(email, recent);
  return true;
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const key = email.toLowerCase();

  // Resposta sempre igual, exista a conta ou não.
  res.json({ ok: true });

  if (!allowResetRequest(key)) return;
  // Já respondeu: daqui em diante erros só vão pro log.
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = jwt.sign({ sub: user.id, purpose: "reset" }, resetSecret(user.passwordHash), {
      expiresIn: `${env.passwordResetTtlMin}m`,
    });
    const link = `${env.frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;

    await sendMail(
      user.email,
      "Redefinição de senha — Stakeholder Virtual",
      `Para criar uma nova senha, acesse: ${link}\n\nO link vale ${env.passwordResetTtlMin} minutos e só pode ser usado uma vez. Se você não pediu isso, ignore este e-mail.`,
      `<p>Para criar uma nova senha, clique no link abaixo:</p><p><a href="${link}">Redefinir minha senha</a></p><p>O link vale ${env.passwordResetTtlMin} minutos e só pode ser usado uma vez. Se você não pediu isso, ignore este e-mail.</p>`,
    );
  } catch (err) {
    console.error("[auth] falha ao enviar redefinição de senha:", err);
  }
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = z
    .object({
      token: z.string().min(1),
      password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
    })
    .parse(req.body);

  const invalid = new HttpError(400, "Link inválido ou expirado. Peça um novo.");
  const decoded = jwt.decode(token) as { sub?: string } | null;
  if (!decoded?.sub) throw invalid;

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user) throw invalid;

  try {
    const payload = jwt.verify(token, resetSecret(user.passwordHash)) as { purpose?: string };
    if (payload.purpose !== "reset") throw invalid;
  } catch {
    throw invalid;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Condiciona ao hash antigo: dois usos simultâneos do mesmo link, só um passa.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, passwordHash: user.passwordHash },
    data: { passwordHash },
  });
  if (count === 0) throw invalid;

  // Encerra as sessões abertas da conta.
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  res.json({ ok: true });
}

// A pessoa escolhe com qual das turmas dela vai usar o app: os próximos logs e
// a lista de projetos seguem só essa turma.
// ponytail: fica salva no usuário, então duas sessões abertas ao mesmo tempo
// compartilham a turma; mover para o token se isso virar problema.
export async function selectTurma(req: Request, res: Response) {
  const { turmaId } = z.object({ turmaId: z.string().min(1) }).parse(req.body);
  const atual = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: withTurmas });
  const vinculos = vinculosDoUsuario(atual);
  const alvo = vinculos.find((v) => v.turma.id === turmaId);
  if (!alvo) throw new HttpError(403, "Você não está cadastrado nessa turma");

  // Regrava as matrículas (a ativa de contas antigas passa a ter uma) e
  // ativa a turma escolhida junto com a equipe dela.
  const userId = atual.id;
  const [, , user] = await prisma.$transaction([
    prisma.matricula.deleteMany({ where: { userId } }),
    prisma.matricula.createMany({
      data: vinculos.map((v) => ({ userId, turmaId: v.turma.id, equipeId: v.equipe?.id ?? null })),
    }),
    prisma.user.update({
      where: { id: userId },
      data: { turmaId, equipeId: alvo.equipe?.id ?? null },
      include: withTurmas,
    }),
  ]);
  res.json(toAuthUser(user));
}
