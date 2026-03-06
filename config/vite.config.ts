import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const projectRoot = path.resolve(__dirname, "..");

// Carrega .env na raiz para o build local (define usa process.env)
const envPath = path.join(projectRoot, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: projectRoot,
  envPrefix: "VITE_", // string explícita (evita RegExp no Node da Vercel)
  define: {
    "import.meta.env.SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL ?? ""),
    "import.meta.env.SUPABASE_ANON_KEY": JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ""),
    "import.meta.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY ?? ""),
    "import.meta.env.SERVER_API_URL": JSON.stringify(process.env.SERVER_API_URL ?? ""),
    "import.meta.env.WHATSAPP_API": JSON.stringify(process.env.WHATSAPP_API ?? ""),
  },
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
