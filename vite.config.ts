import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "background.html")
      }
    }
  }
});
