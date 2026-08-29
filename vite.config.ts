import path from "node:path";
import { getRequestListener } from "@hono/node-server";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { sites } from "./sites-vite-plugin";
import { localMemoryStore } from "./src/lib/live/store-memory";
import { createApp } from "./src/worker";

const api = getRequestListener(createApp(localMemoryStore).fetch);

function miseApi() {
  return {
    name: "mise-live-api",
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: { url?: string }, res: unknown, next: () => void) => {
        if (!req.url?.startsWith("/api")) return next();
        return api(req as never, res as never);
      });
    },
    configurePreviewServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: { url?: string }, res: unknown, next: () => void) => {
        if (!req.url?.startsWith("/api")) return next();
        return api(req as never, res as never);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), miseApi(), sites()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 43417,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 43417,
  },
  build: {
    outDir: "dist",
  },
});
