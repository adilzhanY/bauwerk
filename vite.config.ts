/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// GitHub Pages serves the app under /bauwerk/. Locally the base stays "/".
// The deploy workflow sets VITE_BASE_PATH=/bauwerk/.
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    // Three.js plus drei is about 1 MB minified and lives in its own cached chunk.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          react: ["react", "react-dom", "zustand", "immer"],
        },
      },
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // The panel tests render the whole app with jsdom; CI runners need more than the 5 s default.
    testTimeout: 20000,
    coverage: { include: ["src/geometry/**", "src/store/**"] },
  },
});
