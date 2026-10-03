import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { listPublicTurmas } from "../controllers/turmas.controller";

// Pública: a tela de cadastro precisa listar as turmas antes do login.
export const turmasRouter = Router();

turmasRouter.get("/", asyncHandler(listPublicTurmas));
