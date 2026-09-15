import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega o .env da raiz de /frontend (PORT, VITE_API_URL etc.)
  const env = loadEnv(mode, process.cwd(), "");

  const devPort = Number(env.PORT) || 5173;
  // Endereço do Flask local (python main.py) usado só em desenvolvimento.
  const flaskTarget = env.VITE_API_URL;

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
        "/api": {
          target: flaskTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
