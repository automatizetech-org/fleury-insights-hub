import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, BarChart3, Shield } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      navigate("/dashboard");
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-red-50 via-background to-blue-50">
      {/* Dot pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* Radial gradients */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-6" style={{ animation: "slide-in-from-bottom 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards" }}>
        <div className="bg-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8" style={{ animation: "zoom-in 0.5s ease-out 0.2s both" }}>
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl scale-150" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-destructive to-primary shadow-lg ring-4 ring-primary/10">
                <BarChart3 className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-lg font-bold font-display text-foreground">
              Fleury <span className="text-muted-foreground">•</span> Dashboard Web
            </h1>
            <p className="text-2xl font-bold font-display mt-2 text-foreground">Login</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/90 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-border bg-card py-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-primary/30 transition-all"
            >
              <Shield className="h-3.5 w-3.5" />
              Acessar como Admin
            </button>
          </form>

          <p className="text-center text-[10px] text-muted-foreground mt-8">
            © 2025 Fleury Analytics — Plataforma de Gestão
          </p>
        </div>
      </div>
    </div>
  );
}
