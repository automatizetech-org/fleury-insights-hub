# Deploy na Vercel

## Vai funcionar?

**Sim**, o repositório pode ser deployado na Vercel e o **frontend (React/Vite)** sobe e funciona normalmente.

O que a Vercel publica é só o **build do frontend** (HTML, JS, CSS). Os backends (API de arquivos e whatsapp-emissor) **não rodam na Vercel** — eles continuam no seu servidor (ex.: VM com IP 192.168.50.9).

---

## O que sobe na Vercel

| Parte | Na Vercel? | Onde fica |
|-------|------------|-----------|
| Site (React/Vite) | ✅ Sim | Vercel |
| Supabase (auth, banco) | ✅ Já é na nuvem | Supabase |
| API de arquivos (download XMLs/guias) | ❌ Não | Seu servidor (porta 3001) |
| Backend WhatsApp (whatsapp-emissor) | ❌ Não | Seu servidor (porta 3010) |

---

## Variáveis de ambiente na Vercel

No projeto na Vercel, em **Settings → Environment Variables**, configure:

| Variável | Obrigatório | Valor |
|----------|-------------|--------|
| `SUPABASE_URL` | ✅ Sim | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | ✅ Sim | Chave anônima do Supabase |
| `SERVER_API_URL` | Se usar download de arquivos | **URL pública** da API de arquivos (veja abaixo) |
| `WHATSAPP_API` | Se usar WhatsApp (Alteração Empresarial) | **URL pública** do backend WhatsApp (veja abaixo) |

---

## Acesso à API e ao WhatsApp com o site na Vercel

O site na Vercel é acessado pela **internet**. O navegador do usuário **não** consegue acessar `http://192.168.50.9:...` — esse IP é da sua rede local.

Para o site (na Vercel) conseguir chamar sua API e o WhatsApp:

1. **Exponha o servidor na internet** com uma URL fixa, por exemplo:
   - **Ngrok** (domínio fixo): ex. `https://seu-dominio.ngrok-free.app`
   - **Cloudflare Tunnel**: ex. `https://api.seudominio.com.br`
2. Na Vercel, defina:
   - `SERVER_API_URL` = URL pública da API de arquivos (ex.: `https://seu-dominio.ngrok-free.app` se o ngrok apontar para a porta 3001).
   - `WHATSAPP_API` = URL pública do WhatsApp (ex.: outro túnel/domínio apontando para a porta 3010).

Se você **não** configurar túnel e deixar as URLs com `192.168.50.9`, o site na Vercel abre, mas **download de arquivos** e **conexão WhatsApp** vão falhar para quem acessar de fora da sua rede.

---

## Uso só na rede local

Se o site for acessado **apenas** por quem está na mesma rede do servidor (ex.: escritório), você pode:

- Fazer deploy na Vercel mesmo e, nas variáveis da Vercel, usar `http://192.168.50.9:3001` e `http://192.168.50.9:3010` — **só vai funcionar para quem estiver na mesma rede**. Para o resto, não.

Ou hospedar o frontend no próprio servidor (ex.: servir o build com nginx na mesma máquina) e aí usar o IP local sem problema.

---

## Resumo

- **Subir o repo na Vercel:** ✅ funciona; só o frontend é publicado.
- **Login e dados (Supabase):** ✅ funcionam após configurar `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
- **Download de arquivos e WhatsApp:** ✅ só funcionam se a API e o WhatsApp estiverem acessíveis por **URL pública** (túnel) e essas URLs forem colocadas em `SERVER_API_URL` e `WHATSAPP_API` nas variáveis de ambiente da Vercel.
