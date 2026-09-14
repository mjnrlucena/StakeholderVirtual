import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega o .env da raiz de /frontend (PORT, VITE_API_URL etc.)
  const env = loadEnv(mode, process.cwd(), "");

  const devPort = Number(env.PORT) || 5173;
  // Endereço do Flask local (python main.py) usado só em desenvolvimento.
  const flaskTarget = env.VITE_API_URL || "http://localhost:5000";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      port: devPort,
      proxy: {
        // Em dev, tudo que for /pergunta é redirecionado para o Flask local,
        // evitando CORS. Em produção o próprio Flask serve o build e essa
        // rota já existe na mesma origem, então o proxy não é necessário.
        "/pergunta": {
          target: flaskTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
