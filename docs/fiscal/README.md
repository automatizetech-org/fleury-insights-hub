# Fiscal — Documentos fiscais (NFe/NFC, NFS)

Documentos fiscais são servidos pela **mesma API** (URL em [../env.example](../env.example)), endpoint `GET /api/fiscal-documents/:id/download`. A diferença está no **tipo** (`type` na tabela `fiscal_documents`) e na **convenção de pasta** que cada robô usa.

| Tipo   | Pasta de config      | Tabela             | Uso no site        |
|--------|----------------------|--------------------|--------------------|
| NFe/NFC| [nfe-nfc/](./nfe-nfc/)| `fiscal_documents` | Fiscal → NFE, NFC  |
| NFS    | [nfs/](./nfs/)       | `fiscal_documents` | Fiscal → NFS       |

Cada subpasta tem a convenção de `file_path` que o robô deve gravar e que a API usa para localizar o arquivo no disco.
