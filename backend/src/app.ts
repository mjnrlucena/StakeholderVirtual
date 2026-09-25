import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth.routes";
import { projectsRouter } from "./routes/projects.routes";
import { adminRouter } from "./routes/admin.routes";

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true, // obrigatório para o navegador enviar/receber cookies cross-domain
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/admin", adminRouter);

app.use(errorHandler);
