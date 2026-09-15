import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/medconsult/",
  resolve: {
    alias: { "@": path.resolve(dir, "src") },
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
});
