/**
 * Script opcional para popular o banco com os PDFs que já existiam em
 * /pdfs no repositório antigo. Rode com `npm run seed` depois de
 * configurar o .env (precisa de DATABASE_URL e das credenciais do
 * Supabase Storage já funcionando).
 */
import fs from "node:fs/promises";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");
import { prisma } from "./prisma";
import { uploadReportPdf } from "./services/storage.service";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "superadmin@gmail.com" },
    update: {
      role: Role.SUPERADMIN,
    },
    create: {
      email: "superadmin@gmail.com",
      passwordHash: hashedPassword,
      role: Role.SUPERADMIN,
    },
  });

  console.log("Superadmin cadastrado com sucesso!");

  const pdfsDir = path.join(__dirname, "..", "..", "pdfs");
  
  try {
    const files = (await fs.readdir(pdfsDir)).filter((f) => f.toLowerCase().endsWith(".pdf"));

    for (const file of files) {
      const buffer = await fs.readFile(path.join(pdfsDir, file));
      const { text } = await pdfParse(buffer);
      const pdfPath = await uploadReportPdf(buffer, file);

      const project = await prisma.project.create({
        data: {
          title: file.replace(/\.pdf$/i, ""),
          pdfPath,
          reportText: text,
        },
      });

      console.log(`Projeto criado: ${project.title} (${project.id})`);
    }
  } catch (error) {
    console.log("Nenhum PDF processado (pasta /pdfs não encontrada ou vazia).");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());