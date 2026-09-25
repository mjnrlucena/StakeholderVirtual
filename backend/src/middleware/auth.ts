import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken } from "../services/token.service";
import { HttpError } from "./errorHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "SUPERADMIN") {
    throw new HttpError(403, "Acesso permitido apenas para SuperAdmin");
  }
  next();
}

// Lê o access token do cookie httpOnly. Se estiver expirado/ausente, o
// frontend deve chamar POST /auth/refresh (que usa o cookie de refresh)
// e tentar a requisição original de novo.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken;
  if (!token) throw new HttpError(401, "Não autenticado");

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new HttpError(401, "Sessão expirada");
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user ||(req.user?.role !== Role.ADMIN && req.user?.role !== "SUPERADMIN")) {
    throw new HttpError(403, "Acesso restrito a administradores");
  }
  next();
}
