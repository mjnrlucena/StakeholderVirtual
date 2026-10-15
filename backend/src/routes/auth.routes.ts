import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { forgotPassword, login, logout, me, refresh, register, resetPassword, selectTurma } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(register));
authRouter.post("/login", asyncHandler(login));
authRouter.post("/refresh", asyncHandler(refresh));
authRouter.post("/logout", asyncHandler(logout));
authRouter.post("/forgot-password", asyncHandler(forgotPassword));
authRouter.post("/reset-password", asyncHandler(resetPassword));
authRouter.get("/me", requireAuth, asyncHandler(me));
authRouter.patch("/turma", requireAuth, asyncHandler(selectTurma));
