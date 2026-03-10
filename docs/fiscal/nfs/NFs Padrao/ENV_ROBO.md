# Variáveis .env para o robô NFS (estrutura centralizada + painel/agendador)

**Python 3.11** — O robô deve rodar com Python 3.11. Use um venv dedicado.

```powershell
# Na pasta do robô (NFs Padrao)
py -3.11 -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
# Rodar: .\venv\Scripts\python.exe bot.py
```

## .env global (recomendado)

Na VM, use um **único .env** para todos os robôs (ex.: em `C:\Users\ROBO\Documents\ROBOS\.env` ou em cada pastinha do robô) com **apenas**:

- **SERVER_API_URL** — URL do server-api (ex.: ngrok na porta 3001).
- **SUPABASE_URL** e **SUPABASE_ANON_KEY** — Mesmo projeto do dashboard.

**Não** é mais necessário definir no .env:

- **BASE_PATH** — Definido no **painel Admin** (Pasta base na VM). O server-api e os robôs leem do Supabase.
- **ROBOT_SEGMENT_PATH** — Definido na **edição de cada robô** no painel (campo "Departamento (caminho na estrutura)", ex.: `FISCAL/NFS`). O robô obtém pelo Supabase (tabela `robots`) ou pela API.

## Como o robô obtém base_path e segment_path

O robô chama na inicialização:

```http
GET {SERVER_API_URL}/api/robot-config?technical_id=SEU_TECHNICAL_ID
```

Resposta (exemplo):

```json
{
  "base_path": "C:\\Users\\ROBO\\Documents",
  "segment_path": "FISCAL/NFS",
  "date_rule": "year_month_day",
  "folder_structure": [ ... ]
}
```

- **base_path** — Valor definido no Admin (global para todos os robôs).
- **segment_path** — Valor da linha do robô na tabela `robots` (configurado na edição do robô no painel).
- **date_rule** — Regra do nó na estrutura de pastas (year, year_month ou year_month_day), para montar caminhos com ano/mês/dia.
- **folder_structure** — Árvore de nós do painel (para o robô montar caminhos e relatórios).

Com isso, o caminho por empresa fica, por exemplo:

`{base_path}/EMPRESAS/EG FLEURY ASSESSORIA E SERVICOS LTDA/FISCAL/NFS/Recebidas/2026/03/01`

O dashboard já interpreta essa estrutura (ano/mês/dia) quando exibe ou sincroniza documentos.

## Exemplo .env (mínimo)

```env
SERVER_API_URL=https://seu-ngrok.ngrok-free.app
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
```

## Agendador e painel

- **SUPABASE_URL** e **SUPABASE_ANON_KEY** são obrigatórios para o robô se registrar no painel e fazer poll da fila (cron/agendador).
- O **technical_id** do robô (ex.: `nfs-padrao`) deve ser o mesmo usado no painel para que a API devolva o segment_path correto.

Sem essas variáveis, o robô não conecta ao painel; sem chamar `/api/robot-config`, o robô pode usar fallback de BASE_PATH/ROBOT_SEGMENT_PATH do .env se o código do robô ainda suportar (legado).
