import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Chrome loads manifest content scripts as classic scripts. Build this entry
// separately as an IIFE so that all of its imports are embedded in content.js.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(fileURLToPath(new URL(".", import.meta.url)), "src/content/index.ts"),
      name: "IdealistaPersonalScoreContent",
      formats: ["iife"],
      fileName: () => "content.js"
    }
  }
});
