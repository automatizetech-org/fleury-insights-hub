# Configuração do servidor — parâmetro único (IP)

Toda a configuração de URLs (API de arquivos e WhatsApp) é derivada do **IP/host do servidor**. Um único lugar define esse valor: **[env.example](./env.example)**.

## Parâmetro central

| Variável       | Valor exemplo   | Uso |
|----------------|------------------|-----|
| `SERVER_HOST`  | `192.168.50.9`   | IP ou hostname da máquina onde rodam a API e o WhatsApp. Altere só aqui; as URLs abaixo usam esse valor. |

## Serviços e portas no servidor

| Serviço            | Porta | URL base (rede local)     | Variável de env |
|--------------------|-------|---------------------------|------------------|
| API de arquivos    | 3001  | `http://192.168.50.9:3001` | `SERVER_API_URL` |
| Backend WhatsApp   | 3010  | `http://192.168.50.9:3010` | `WHATSAPP_API` |

## Onde usar

- **Robôs** (NFe/NFC, NFS, guias DP): usar `SERVER_API_URL` de `docs/env.example`.
- **Frontend**: copiar para o `.env` na **raiz do projeto** as variáveis `SERVER_API_URL` e `WHATSAPP_API` (valores em `docs/env.example`).
- **API de arquivos** (seu servidor): pode usar `SERVER_API_URL` como base para URLs absolutas.
- **whatsapp-emissor**: roda na mesma máquina; o front chama `WHATSAPP_API` (porta 3010).

## Trocar o IP do servidor

1. Edite **`docs/env.example`**: altere `SERVER_HOST=192.168.50.9` para o novo IP/host.
2. Atualize as URLs no mesmo arquivo para usar o novo valor (ex.: `http://NOVO_IP:3001` e `http://NOVO_IP:3010`).
3. Se usar `.env` na raiz (frontend), atualize `SERVER_API_URL` e `WHATSAPP_API` com as mesmas URLs.
4. Robôs que leem `docs/env.example` ou um `.env` copiado dele passarão a usar o novo endereço.

## Túnel (acesso pela internet)

Se o site estiver na internet (ex.: Vercel) e precisar acessar a API/WhatsApp, use um túnel (ngrok, Cloudflare Tunnel, etc.) e coloque a **URL pública** em `docs/env.example` no lugar de `http://192.168.50.9:...`. Detalhes: [api/SERVER_FILES_API.md](./api/SERVER_FILES_API.md).
