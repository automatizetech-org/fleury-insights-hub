import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const projectRoot = path.resolve(__dirname, "..");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: projectRoot,
  envPrefix: /^(SUPABASE_|SERVER_|WHATSAPP_)/,
  css: {
    postcss: path.resolve(projectRoot, "config/postcss.config.js"),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
}));
