import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

// Diretório local usado só quando STORAGE_DRIVER=local (desenvolvimento).
// Fora do container/versão de produção — nunca use isso no Render, o
// disco é efêmero e some a cada deploy/restart.
const LOCAL_UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "reports");

const supabase =
  env.storageDriver === "supabase" ? createClient(env.supabaseUrl!, env.supabaseServiceKey!) : null;

// Faz upload do PDF e devolve a chave salva em Project.pdfPath. O arquivo
// em si nunca passa pelo disco do backend antes disso — chega como buffer
// em memória (multer.memoryStorage()) — exceto no driver "local", que é
// disco de propósito (só pra dev sem depender do Supabase).
export async function uploadReportPdf(fileBuffer: Buffer, originalName: string): Promise<string> {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `projects/${randomUUID()}-${safeName}`;

  if (env.storageDriver === "local") {
    const filePath = path.join(LOCAL_UPLOADS_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, fileBuffer);
    return key;
  }

  const { error } = await supabase!.storage
    .from(env.supabaseStorageBucket)
    .upload(key, fileBuffer, { contentType: "application/pdf", upsert: false });

  if (error) {
    throw new Error(`Falha ao enviar PDF para o Supabase Storage: ${error.message}`);
  }

  return key;
}
