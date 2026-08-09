import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    // Smart TV browsers can support ES modules but still fail on newer
    // syntax such as optional chaining. Emit a transpiled/ polyfilled
    // fallback bundle as well as the normal modern bundle.
    legacy({
      // Covers older Chromium/Tizen-era TV browsers while retaining the
      // modern bundle for current Chrome/Safari/Android browsers.
      targets: ["chrome >= 49", "safari >= 10", "ios >= 10", "android >= 5.1"],
      // Native modules appeared before optional chaining. This target also
      // transpiles the middle generation of TV browsers that can load
      // modules but cannot parse ?. or ??.
      modernTargets: ["chrome >= 79", "safari >= 13.1", "ios >= 13.4", "android >= 80"],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
