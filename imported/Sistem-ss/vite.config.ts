import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Alvo do back-end Python em desenvolvimento (FastAPI/Django). Sobrescreva com
// a env API_PROXY se rodar em outra porta.
const API_TARGET = process.env.API_PROXY ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5180,
    // Encaminha as chamadas /api para o back Python, evitando CORS em dev.
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
});
