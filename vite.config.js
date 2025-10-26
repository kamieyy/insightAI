import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: "background.js",
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
    outDir: "dist",
    minify: false,
    emptyOutDir: true,
  },
});
