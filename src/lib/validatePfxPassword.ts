/**
 * Valida se a senha informada abre o certificado .pfx (PKCS#12).
 * Retorna { valid, validUntil } — validUntil é a data de vencimento em ISO (YYYY-MM-DD).
 */
import forge from "node-forge"

export function validatePfxPassword(pfxBase64: string, password: string): boolean {
  const r = getPfxInfo(pfxBase64, password)
  return r.valid
}

export function getPfxInfo(
  pfxBase64: string,
  password: string
): { valid: boolean; validUntil?: string } {
  if (!pfxBase64 || !password) return { valid: false }
  try {
    const binary = atob(pfxBase64)
    const p12Asn1 = forge.asn1.fromDer(binary)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const bags = certBags[forge.pki.oids.certBag]
    const cert = bags?.[0]?.cert
    if (!cert?.validity?.notAfter) return { valid: true }
    const d = cert.validity.notAfter
    const validUntil = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    return { valid: true, validUntil }
  } catch {
    return { valid: false }
  }
}
