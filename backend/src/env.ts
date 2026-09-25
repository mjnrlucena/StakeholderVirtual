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
};
