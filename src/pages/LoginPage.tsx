import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Lock, Loader2, AlertCircle } from "lucide-react"
import { supabase } from "@/services/supabaseClient"
import { getProfile } from "@/services/profilesService"
import logoUrl from "@/assets/images/logo.png"

const SUPABASE_URL = import.meta.env.SUPABASE_URL ?? ""
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY ?? ""

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Garantir tema escuro como padrão na tela de login (mesma lógica do AppLayout)
  useEffect(() => {
    const stored = localStorage.getItem("theme")
    const isDark = stored !== "light"
    document.documentElement.classList.toggle("dark", isDark)
    if (!stored) localStorage.setItem("theme", "dark")
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = res.status === 404
          ? "Endpoint de login não encontrado (404). No .env use a SUPABASE_URL do seu projeto no Supabase (https://seu-projeto.supabase.co), não localhost. Depois publique a Edge Function 'auth'."
          : (data.error ?? "Falha no login")
        throw new Error(msg)
      }
      const { access_token, refresh_token } = data
      if (!access_token || !refresh_token) throw new Error("Sessão inválida")
      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
      if (sessionError) throw sessionError
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id
      if (!userId) throw new Error("Usuário não retornado")
      const profile = await getProfile(userId)
      setLoading(false)
      if (profile.role === "super_admin") {
        navigate("/admin", { replace: true })
      } else {
        navigate(from && from !== "/login" ? from : "/dashboard", { replace: true })
      }
    } catch (err: unknown) {
      setLoading(false)
      let message = "Falha no login"
      if (err && typeof err === "object" && "message" in err) {
        const msg = String((err as { message: string }).message)
        if (msg === "Failed to fetch" || msg.includes("fetch")) {
          message = "Não foi possível contactar o servidor. Confira o .env (SUPABASE_URL) e publique a Edge Function 'auth' no Supabase."
        } else if (msg.includes("404") || msg.includes("não encontrado")) {
          message = msg
        } else {
          message = msg
        }
      }
      setError(message)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_35%,rgba(220,38,38,0.12),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(37,99,235,0.14),transparent_55%),radial-gradient(circle_at_50%_15%,rgba(37,99,235,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNGMwIDMuMzE0LTIuNjg2IDYtNiA2cy02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiA2IDIuNjg2IDYgNnoiIGZpbGw9InJnYmEoNTksMTMwLDI0NiwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-40 dark:opacity-20" />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <div className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800/50 p-6 md:p-8 animate-in slide-in-from-bottom-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-3 mb-6 md:mb-8 min-w-0">
          <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl md:rounded-2xl overflow-hidden ring-2 ring-[#2563EB]/20 zoom-in-anim animate-in flex-shrink-0 flex items-center justify-center bg-white/80 dark:bg-slate-800/80">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="text-center sm:text-left min-w-0">
            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">Fleury • Dashboard Web</div>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white truncate">Login</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div className="space-y-2.5 md:space-y-3">
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nome de usuário"
              autoFocus
              autoComplete="username"
              className="w-full px-4 py-3 md:py-3.5 rounded-lg md:rounded-xl border-2 border-gray-200 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 focus:border-[#2563EB] transition-all text-base touch-manipulation"
              disabled={loading}
            />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              autoComplete="current-password"
              className="w-full px-4 py-3 md:py-3.5 rounded-lg md:rounded-xl border-2 border-gray-200 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 focus:border-[#2563EB] transition-all text-base touch-manipulation"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs md:text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 border border-red-200 dark:border-red-800 slide-in-from-top-2 animate-in">
              <AlertCircle size={16} className="md:w-[18px] md:h-[18px] flex-shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 md:py-3.5 px-4 bg-gradient-to-r from-[#2563EB] to-blue-600 hover:from-[#1E40AF] hover:to-blue-700 text-white font-semibold rounded-lg md:rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/25 hover:shadow-[#2563EB]/40 transform hover:scale-[1.02] active:scale-[0.98] touch-manipulation text-base"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="md:w-5 md:h-5 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <Lock size={16} className="md:w-[18px] md:h-[18px]" />
                Entrar
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
