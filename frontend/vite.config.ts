import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the browser talks only to the Vite origin (http://localhost:5173)
// and /api is proxied to the FastAPI backend. Cookies stay same-origin this way.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5100",
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
