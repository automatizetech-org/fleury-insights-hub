# Instalação em outro escritório (nova VM)

O projeto já está preparado para escalar: você pode copiar a pasta **Servidor** para outra VM e colocar para rodar em outro escritório sem dificuldade. Tudo é configurável por variáveis de ambiente.

---

## 1. O que copiar

- Toda a pasta **`Servidor`** (server-api, whatsapp-emissor, ecosystem.config.cjs).
- **Opcional:** pasta **`Ngrok`** com o `ngrok.exe` dentro de `Servidor/Ngrok/`, se for usar túnel.
- **Não precisa** copiar `node_modules` (será gerado com `npm install` na nova VM).
- **WhatsApp:** a pasta `.wwebjs_auth` em `whatsapp-emissor` contém a sessão. Se for **outro número** no novo escritório, não copie; deixe gerar nova sessão e escanear o QR. Se for o **mesmo número**, pode copiar para não precisar escanear de novo.

---

## 2. Pré-requisitos na nova VM

- **Node.js** (LTS, ex.: 18 ou 20).
- **PM2** (opcional, recomendado): `npm i -g pm2`.
- **Estrutura de pastas:** na VM, defina onde ficarão os arquivos das empresas (ex.: `D:\Dados` ou `C:\Users\Escritorio2\Documents`). Dentro dessa pasta deve existir (ou você cria) a pasta **`EMPRESAS`**, e dentro dela uma pasta por empresa com o **mesmo nome** cadastrado no dashboard (ex.: `Grupo Fleury`).

---

## 3. Configuração na nova VM

### 3.1 Server-API (`Servidor/server-api/`)

1. Copie o `.env` de uma VM que já funciona (ou crie um novo com as variáveis abaixo).
2. Ajuste **apenas** o que for específico desta VM:

| Variável | O que colocar na nova VM |
|----------|---------------------------|
| `BASE_PATH` | Caminho nesta VM onde está (ou estará) a pasta `EMPRESAS`. Ex.: `D:\Dados` ou `C:\Users\NovaVM\Documents`. |
| `PORT` | 3001 (ou outra porta livre). |
| `WHATSAPP_BACKEND_URL` | `http://localhost:3010` (o server-api e o WhatsApp rodam na mesma máquina). |
| `SUPABASE_URL` | Mesmo do projeto (todos os escritórios usam o mesmo Supabase). |
| `SUPABASE_ANON_KEY` | Mesmo do projeto. |
| `SUPABASE_SERVICE_ROLE_KEY` | Mesmo do projeto. |

**Alternativa ao BASE_PATH no .env:** você pode configurar o caminho pelo **Supabase** (tabela `admin_settings`, chave `base_path`). Na inicialização, a API chama `loadBasePathFromSupabase()` e, se existir esse valor, **sobrescreve** o `BASE_PATH` do .env. Assim dá para mudar o path sem mexer no arquivo na VM.

**Não está fixo:** o único valor “fixo” é o fallback quando nada está configurado (`C:\Users\ROBO\Documents`). Quem manda é, nesta ordem: Supabase `base_path` (se existir) → senão, `BASE_PATH` do .env → senão, o fallback acima. Em outra VM basta definir `BASE_PATH` no .env (ou `base_path` no Supabase).

### 3.2 WhatsApp emissor (`Servidor/whatsapp-emissor/`)

- Não precisa de `.env` obrigatório. Se quiser definir pasta de dados da sessão: `WA_APP_DATA_DIR` (caminho absoluto). Porta: `WA_SERVER_PORT=3010` (padrão).

### 3.3 PM2 (`Servidor/ecosystem.config.cjs`)

- Não precisa alterar. Os caminhos são relativos à pasta `Servidor` (`__dirname`). Só garanta que na nova VM exista `Servidor/Ngrok/ngrok.exe` se for usar ngrok.

---

## 4. Comandos na nova VM

Na pasta **`Servidor`**:

```bash
# Instalar dependências
cd server-api && npm install && cd ..
cd whatsapp-emissor && npm install && cd ..

# Subir com PM2 (a partir da pasta Servidor)
pm2 start ecosystem.config.cjs
```

Se não usar PM2:

```bash
# Terminal 1 – WhatsApp
cd whatsapp-emissor && node server.js

# Terminal 2 – API
cd server-api && node index.js

# Se usar ngrok: executar ngrok http 3001 (a partir de Servidor/Ngrok)
```

---

## 5. Frontend (dashboard) no outro escritório

O **frontend** (Vite/React) usa a variável **`SERVER_API_URL`** para downloads e sincronização. Ela é lida em **build time** (`.env` do projeto).

- **Cenário A – Um build para todos:**  
  Se todos os escritórios usarem o **mesmo** frontend hospedado (ex.: um único deploy), hoje a URL da API está fixa no build. Para cada escritório usar sua própria VM, seria preciso ter a URL da API configurável em **runtime** (ex.: via Supabase ou tela de configuração). Hoje não está assim; o frontend espera uma única `SERVER_API_URL`.

- **Cenário B – Um build por escritório (recomendado para multi-escritório):**  
  No **outro escritório**, faça o build do frontend com o `.env` apontando para a **URL da API daquele escritório** (ex.: o ngrok ou IP da VM deles):

  ```env
  SERVER_API_URL=https://url-ngrok-ou-ip-da-vm-deste-escritorio
  WHATSAPP_API=https://mesma-url-acima
  ```

  Depois rode `npm run build` e sirva o `dist/` (ou faça deploy desse build em um host que esse escritório acesse). Assim cada escritório usa seu próprio backend na sua VM.

---

## 6. Resumo

| Item | Dificuldade |
|------|-------------|
| Copiar pasta Servidor | Nenhuma |
| Ajustar `.env` (só `BASE_PATH` e manter Supabase) | Baixa |
| `npm install` + PM2 start | Baixa |
| Estrutura EMPRESAS na VM | Mesma convenção de nomes do dashboard |
| Frontend para o escritório | Um build com `SERVER_API_URL` da VM desse escritório |

Não há nada hardcoded que impeça rodar em outra VM: paths do PM2 são relativos, BASE_PATH é por .env (ou Supabase), e Supabase é o mesmo para todos. A única coisa “por escritório” é o **caminho dos arquivos** (`BASE_PATH`) e a **URL da API** que o frontend desse escritório usa (`SERVER_API_URL` no build).
