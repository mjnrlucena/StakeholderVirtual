import { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erro: err.message });
  }
  console.error(err);
  return res.status(500).json({ erro: `Erro interno do servidor. ${err}` });
}
