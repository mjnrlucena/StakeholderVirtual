import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { listProjects } from "../controllers/projects.controller";
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  renameSession,
  sendMessage,
} from "../controllers/chats.controller";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", asyncHandler(listProjects));
projectsRouter.get("/:projectId/sessions", asyncHandler(listSessions));
projectsRouter.post("/:projectId/sessions", asyncHandler(createSession));
projectsRouter.get("/:projectId/sessions/:chatId", asyncHandler(getSession));
projectsRouter.patch("/:projectId/sessions/:chatId", asyncHandler(renameSession));
projectsRouter.delete("/:projectId/sessions/:chatId", asyncHandler(deleteSession));
projectsRouter.post("/:projectId/sessions/:chatId/message", asyncHandler(sendMessage));
