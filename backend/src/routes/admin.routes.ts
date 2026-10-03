import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, requireProfessor, requireStaff, requireSuperAdmin } from "../middleware/auth";
import {
  answerQuestion,
  createProject,
  deleteProject,
  deleteQuestion,
  listAdminProjects,
  listLogs,
  listUnansweredQuestions,
  logSession,
  logsFilterOptions,
  logsSummary,
  promoteUser,
} from "../controllers/admin.controller";
import { createTurma, deleteTurma, listTurmasAdmin } from "../controllers/turmas.controller";

// Arquivo fica só em memória (buffer) — nunca é gravado em disco local,
// já que o backend roda em disco efêmero no Render. Vai direto pro
// Supabase Storage a partir do buffer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Apenas arquivos PDF são aceitos"));
    }
    cb(null, true);
  },
});

export const adminRouter = Router();

adminRouter.use(requireAuth);

// Superadmin: promover/rebaixar usuários e gerenciar turmas.
adminRouter.post("/promover", requireSuperAdmin, asyncHandler(promoteUser));
adminRouter.get("/turmas", requireSuperAdmin, asyncHandler(listTurmasAdmin));
adminRouter.post("/turmas", requireSuperAdmin, asyncHandler(createTurma));
adminRouter.delete("/turmas/:id", requireSuperAdmin, asyncHandler(deleteTurma));

// Professor (e superadmin): projetos e dashboard de logs. Gestor não acessa.
adminRouter.get("/projects", requireProfessor, asyncHandler(listAdminProjects));
adminRouter.post("/projects", requireProfessor, upload.single("pdf"), asyncHandler(createProject));
adminRouter.delete("/projects/:id", requireProfessor, asyncHandler(deleteProject));
adminRouter.get("/logs", requireProfessor, asyncHandler(listLogs));
adminRouter.get("/logs/summary", requireProfessor, asyncHandler(logsSummary));
adminRouter.get("/logs/filters", requireProfessor, asyncHandler(logsFilterOptions));
adminRouter.get("/logs/sessions/:sessionId", requireProfessor, asyncHandler(logSession));

// Equipe inteira (professor, gestor, superadmin): perguntas não respondidas.
adminRouter.get("/unanswered-questions", requireStaff, asyncHandler(listUnansweredQuestions));
adminRouter.patch("/unanswered-questions/:id/answer", requireStaff, asyncHandler(answerQuestion));
adminRouter.delete("/unanswered-questions/:id", requireStaff, asyncHandler(deleteQuestion));
