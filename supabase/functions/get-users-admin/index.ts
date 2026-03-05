import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const userToken = req.headers.get("X-User-Token") ?? req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
  if (!userToken) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: callerProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single()
  if (callerProfile?.role !== "super_admin") {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    return new Response(JSON.stringify({ error: "List users failed", detail: listError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, username, role, panel_access, created_at")
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const list = (users ?? []).map((u) => {
    const p = profileMap.get(u.id)
    return {
      id: u.id,
      email: u.email ?? null,
      username: p?.username ?? "",
      role: p?.role ?? "user",
      panel_access: p?.panel_access ?? {},
      created_at: p?.created_at,
    }
  }).filter((r) => r.username || r.email)

  return new Response(JSON.stringify(list), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
})
