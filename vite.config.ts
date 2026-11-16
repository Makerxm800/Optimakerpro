import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and plain http (no strict host checks) in dev.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri devUrl in tauri.conf.json must match this port.
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    // allow the Arena/Tauri preview host in addition to localhost
    allowedHosts: true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
  },
  clearScreen: false,
  build: {
    target: "es2021",
    sourcemap: false,
  },
});
