import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { createCompany } from "@/services/companiesService"
import { useSelectedCompanyIds } from "@/hooks/useSelectedCompanies"
import { GlassCard } from "@/components/dashboard/GlassCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BRASIL_API_CNPJ = "https://brasilapi.com.br/api/cnpj/v1"

function onlyDigits(s: string) {
  return s.replace(/\D/g, "")
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result)
        let binary = ""
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        resolve(btoa(binary))
      } else {
        reject(new Error("Leitura do arquivo falhou"))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export default function EmpresasNovaPage() {
  const navigate = useNavigate()
  const { setSelectedCompanyIds } = useSelectedCompanyIds()
  const [name, setName] = useState("")
  const [document, setDocument] = useState("")
  const [useCertificate, setUseCertificate] = useState(false)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPassword, setCertPassword] = useState("")
  const certInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingCnpj, setLoadingCnpj] = useState(false)

  const fetchByCnpj = async () => {
    const digits = onlyDigits(document)
    if (digits.length !== 14) {
      setError("Informe um CNPJ válido (14 dígitos) para buscar.")
      return
    }
    setError("")
    setLoadingCnpj(true)
    try {
      const res = await fetch(`${BRASIL_API_CNPJ}/${digits}`)
      if (!res.ok) {
        if (res.status === 404) setError("CNPJ não encontrado.")
        else setError("Não foi possível consultar o CNPJ. Tente novamente.")
        return
      }
      const data = await res.json()
      const razaoSocial = data.razao_social
      if (razaoSocial && !name.trim()) setName(razaoSocial)
    } catch {
      setError("Erro ao consultar a Receita. Verifique a conexão.")
    } finally {
      setLoadingCnpj(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (useCertificate && (!certFile || !certPassword.trim())) {
      setError("Ao usar certificado digital, selecione o arquivo .pfx e informe a senha.")
      return
    }
    setLoading(true)
    try {
      let cert_blob_b64: string | null = null
      let cert_password: string | null = null
      if (useCertificate && certFile && certPassword.trim()) {
        cert_blob_b64 = await fileToBase64(certFile)
        cert_password = certPassword.trim()
      }
      const company = await createCompany({
        name: name.trim(),
        document: document.trim() || null,
        auth_mode: useCertificate ? "certificate" : null,
        cert_blob_b64,
        cert_password,
      })
      setSelectedCompanyIds([company.id])
      navigate("/dashboard", { replace: true })
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Erro ao cadastrar"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Nova empresa</h1>
        <p className="text-sm text-muted-foreground mt-1">Cadastre uma nova empresa para gerenciar no dashboard.</p>
      </div>

      <GlassCard className="p-6 max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Razão social"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document">Documento (CNPJ)</Label>
            <div className="flex gap-2">
              <Input
                id="document"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                onBlur={() => {
                  if (!name.trim() && onlyDigits(document).length === 14) fetchByCnpj()
                }}
                placeholder="00.000.000/0001-00"
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={fetchByCnpj}
                disabled={loading || loadingCnpj}
                title="Preencher nome pela Receita Federal se estiver vazio"
              >
                {loadingCnpj ? "Buscando..." : "Buscar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Se o nome estiver vazio, use Buscar para preencher pela Receita.</p>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-cert"
                checked={useCertificate}
                onChange={(e) => setUseCertificate(e.target.checked)}
                disabled={loading}
                className="rounded border-input"
              />
              <Label htmlFor="use-cert" className="font-normal cursor-pointer">Certificado digital (NFS-e)</Label>
            </div>
            <p className="text-xs text-muted-foreground">Opcional. Use para o robô NFS-e baixar notas com certificado A1 (.pfx) em vez de usuário/senha.</p>
            {useCertificate && (
              <div className="space-y-2 pl-4 border-l-2 border-border">
                <div className="space-y-1">
                  <Label>Arquivo .pfx</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      ref={certInputRef}
                      type="file"
                      accept=".pfx"
                      onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                      disabled={loading}
                      className="flex-1"
                    />
                    {certFile && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{certFile.name}</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Senha do certificado</Label>
                  <Input
                    type="password"
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    placeholder="Senha do .pfx"
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Cadastrar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
