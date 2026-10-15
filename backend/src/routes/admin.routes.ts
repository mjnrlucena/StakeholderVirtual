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
  setProjectTurmas,
  unansweredQuestionContext,
} from "../controllers/admin.controller";
import {
  createEquipe,
  createTurma,
  deleteEquipe,
  deleteTurma,
  listTurmasAdmin,
  listUsersAdmin,
  renameEquipe,
  updateUserTurma,
} from "../controllers/turmas.controller";

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

// Superadmin: promover/rebaixar usuários e criar/remover turmas.
adminRouter.post("/promover", requireSuperAdmin, asyncHandler(promoteUser));
adminRouter.post("/turmas", requireSuperAdmin, asyncHandler(createTurma));
adminRouter.delete("/turmas/:id", requireSuperAdmin, asyncHandler(deleteTurma));

// Professor (e superadmin): equipes e turma/equipe de cada cadastro.
adminRouter.get("/turmas", requireProfessor, asyncHandler(listTurmasAdmin));
adminRouter.post("/turmas/:turmaId/equipes", requireProfessor, asyncHandler(createEquipe));
adminRouter.patch("/equipes/:id", requireProfessor, asyncHandler(renameEquipe));
adminRouter.delete("/equipes/:id", requireProfessor, asyncHandler(deleteEquipe));
adminRouter.get("/usuarios", requireProfessor, asyncHandler(listUsersAdmin));
adminRouter.patch("/usuarios/:id", requireProfessor, asyncHandler(updateUserTurma));

// Professor (e superadmin): projetos e dashboard de logs. Gestor não acessa.
adminRouter.get("/projects", requireProfessor, asyncHandler(listAdminProjects));
adminRouter.post("/projects", requireProfessor, upload.single("pdf"), asyncHandler(createProject));
adminRouter.delete("/projects/:id", requireProfessor, asyncHandler(deleteProject));
adminRouter.put("/projects/:id/turmas", requireProfessor, asyncHandler(setProjectTurmas));
adminRouter.get("/logs", requireProfessor, asyncHandler(listLogs));
adminRouter.get("/logs/summary", requireProfessor, asyncHandler(logsSummary));
adminRouter.get("/logs/filters", requireProfessor, asyncHandler(logsFilterOptions));
adminRouter.get("/logs/sessions/:sessionId", requireProfessor, asyncHandler(logSession));

// Equipe inteira (professor, gestor, superadmin): perguntas não respondidas.
adminRouter.get("/unanswered-questions", requireStaff, asyncHandler(listUnansweredQuestions));
adminRouter.patch("/unanswered-questions/:id/answer", requireStaff, asyncHandler(answerQuestion));
adminRouter.delete("/unanswered-questions/:id", requireStaff, asyncHandler(deleteQuestion));
adminRouter.get("/unanswered-questions/:id/context", requireStaff, asyncHandler(unansweredQuestionContext));
