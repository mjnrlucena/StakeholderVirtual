import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAdmin, requireAuth, requireSuperAdmin } from "../middleware/auth";
import {
  answerQuestion,
  createProject,
  deleteQuestion,
  listAdminProjects,
  listUnansweredQuestions,
  addAdmin,
} from "../controllers/admin.controller";

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

adminRouter.use(requireAuth, requireAdmin);

adminRouter.post("/add-admin", requireSuperAdmin, addAdmin);
adminRouter.get("/projects", asyncHandler(listAdminProjects));
adminRouter.post("/projects", upload.single("pdf"), asyncHandler(createProject));
adminRouter.get("/unanswered-questions", asyncHandler(listUnansweredQuestions));
adminRouter.patch("/unanswered-questions/:id/answer", asyncHandler(answerQuestion));
adminRouter.delete("/unanswered-questions/:id", asyncHandler(deleteQuestion));
