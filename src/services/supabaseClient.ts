import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (import.meta.env.DEV && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.warn(
    "Supabase: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env."
  )
}

export const supabase = createClient<Database>(
  SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY ?? "",
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
