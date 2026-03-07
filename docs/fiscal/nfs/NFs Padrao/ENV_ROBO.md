# Variáveis .env para o robô NFS (estrutura centralizada + painel/agendador)

**Python 3.11** — O robô deve rodar com Python 3.11. Use um venv dedicado para não misturar com outros projetos (evita erros de compilação como pyroaring/pyiceberg):

```powershell
# Na pasta do robô (NFs Padrao)
py -3.11 -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
# Rodar: .\venv\Scripts\python.exe bot.py
```

Quando o painel administrativo define a estrutura de pastas, o robô pode usar a mesma base e a mesma árvore. Para o **agendador** disparar o robô (cron/test run), use o mesmo projeto Supabase do dashboard.

## Obrigatórias para estrutura centralizada

- **BASE_PATH** — Pasta raiz onde ficam os arquivos (ex.: `C:\Users\ROBO\Documents`).  
  Se não for definida, o robô usa o caminho salvo no “Gerenciador” (path.json).

- **FOLDER_STRUCTURE_API_URL** ou **SERVER_API_URL** — URL base da API (ex.: `https://xxxx.ngrok.io`).  
  O robô chama `GET {URL}/api/folder-structure` para obter a árvore de pastas.

## Obrigatórias para o agendador startar o robô

- **SUPABASE_URL** e **SUPABASE_ANON_KEY** — Mesmo projeto do dashboard (Fleury Insights Hub).  
  Sem isso o robô não se registra no painel e **não faz poll da fila**; o cron pode criar o job mas o robô não pega.

- Ao abrir o robô, confira no console:
  - **"[Robô] Conectado ao painel. Status: ativo."** → registro ok, poll a cada ~15 s.
  - **"[Robô] Não foi possível registrar no painel."** → URL/key erradas ou RLS bloqueando; corrija o .env.
  - **"[Robô] Job da fila (agendador) iniciado."** → pegou um job e está rodando.
  - **"[Robô] Nenhuma empresa com config no painel..."** → empresas do job precisam estar em company_robot_config (habilitadas para este robô, auth_mode e senha no dashboard).

## Opcionais

- **ROBOT_SEGMENT_PATH** — Caminho lógico deste robô na árvore (padrão: `FISCAL/NFS`).  
  Deve corresponder a um nó configurado no painel (ex.: departamento FISCAL, subpasta NFS).  
  A regra de data (ano/mês/dia) é lida desse nó.

## Exemplo .env (na VM ou na pasta do .exe)

```env
BASE_PATH=C:\Users\ROBO\Documents
SERVER_API_URL=https://xxxx.ngrok-free.app
ROBOT_SEGMENT_PATH=FISCAL/NFS

# Mesmo projeto do dashboard (agendador + lista de robôs)
SUPABASE_URL=https://ymrzpunyxhroawfwfaod.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

## Comportamento

1. Na inicialização, o robô usa **BASE_PATH** (se existir) como pasta base; caso contrário, usa o valor do Gerenciador.
2. Se **FOLDER_STRUCTURE_API_URL** ou **SERVER_API_URL** estiver definida, o robô busca a estrutura em `GET /api/folder-structure`.
3. Com a estrutura, o caminho de gravação fica:  
   `{BASE_PATH}/EMPRESAS/{nome_empresa}/{ROBOT_SEGMENT_PATH}/Emitidas|Recebidas/{ano}/{mês}/{dia}`  
   (ou só ano, ou ano/mês, conforme a regra do nó no painel).
4. O nome da pasta da empresa deve ser **igual ao nome da empresa no dashboard** (ex.: “Grupo Fleury”).
5. Para o **cron/test run** startar o robô: server-api com **SUPABASE_SERVICE_ROLE_KEY**, cron chama a API, API cria `execution_requests`; robô (aberto e conectado) pega o job em até ~15 s e inicia como se fosse o botão Iniciar.

Sem essas variáveis, o robô continua funcionando como antes (pasta escolhida no Gerenciador e opções de estrutura da tela de configuração).
