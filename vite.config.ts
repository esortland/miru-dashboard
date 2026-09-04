import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        dashboard: resolve(rootDir, "index.html"),
        background: resolve(rootDir, "background.html")
      }
    }
  }
});
