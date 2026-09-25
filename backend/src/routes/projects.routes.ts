import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { listProjects } from "../controllers/projects.controller";
import { getChat, resetChat, sendFeedback, sendMessage } from "../controllers/chats.controller";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", asyncHandler(listProjects));
projectsRouter.get("/:projectId/chat", asyncHandler(getChat));
projectsRouter.post("/:projectId/chat/message", asyncHandler(sendMessage));
projectsRouter.post("/:projectId/chat/feedback", asyncHandler(sendFeedback));
projectsRouter.post("/:projectId/chat/reset", asyncHandler(resetChat));
