import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export type StorageDriver = "local" | "supabase";

const storageDriver: StorageDriver = process.env.STORAGE_DRIVER === "local" ? "local" : "supabase";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  accessTokenTtlMin: Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 15),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),

  // STORAGE_DRIVER=local: PDFs vão pra backend/uploads/reports (só para
  // desenvolvimento — disco efêmero no Render, não usar em produção).
  // STORAGE_DRIVER=supabase (padrão): PDFs vão pro Supabase Storage.
  storageDriver,
  supabaseUrl: storageDriver === "supabase" ? required("SUPABASE_URL") : process.env.SUPABASE_URL,
  supabaseServiceKey:
    storageDriver === "supabase" ? required("SUPABASE_SERVICE_KEY") : process.env.SUPABASE_SERVICE_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "reports",

  adkServiceUrl: required("ADK_SERVICE_URL"),
  corsOrigin: required("CORS_ORIGIN"),
  cookieSecure: process.env.COOKIE_SECURE === "true",

  // Endereço do site usado nos links dos e-mails (cai no CORS_ORIGIN se vazio).
  frontendUrl: (process.env.FRONTEND_URL || required("CORS_ORIGIN")).replace(/\/+$/, ""),
  passwordResetTtlMin: Number(process.env.PASSWORD_RESET_TTL_MIN ?? 30),

  // SMTP. Sem MAIL_HOST, o link de redefinição só aparece no console (dev).
  mail: {
    host: process.env.MAIL_HOST || "",
    port: Number(process.env.MAIL_PORT ?? 465),
    secure: process.env.MAIL_SECURE !== "false",
    user: process.env.MAIL_USER || "",
    password: process.env.MAIL_PASSWORD || "",
    from: process.env.MAIL_FROM || process.env.MAIL_USER || "",
  },
};
