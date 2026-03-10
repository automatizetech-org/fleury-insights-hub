# Configuração global de robôs na VM

Os robôs ficam em `C:\Users\ROBO\Documents\ROBOS`, cada um em sua pasta (ex.: `NFs Padrao`). O **.env** pode ser global (apenas três variáveis) e o restante vem do **dashboard** (Supabase).

## .env nos robôs (apenas 3 variáveis)

```env
SERVER_API_URL=https://seu-ngrok.ngrok-free.app
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
```

**Removidos do .env:**

- **BASE_PATH** — Definido no **painel Admin** (Pasta base na VM). O server-api lê do Supabase na inicialização; os robôs obtêm via `GET /api/robot-config`.
- **ROBOT_SEGMENT_PATH** — Definido na **edição de cada robô** no painel (campo "Departamento (caminho na estrutura)", ex.: `FISCAL/NFS`, `DPTO. PESSOAL`, `Contabil`). Fica na tabela `robots.segment_path`.

## Fluxo

1. **Admin** define no dashboard a **Pasta base na VM** (ex.: `C:\Users\ROBO\Documents`). Valor é salvo em `admin_settings.base_path`.
2. **Admin** edita cada robô e define o **Departamento** (ex.: `FISCAL/NFS`). Valor é salvo em `robots.segment_path`.
3. **Estrutura de pastas** no painel (FISCAL > NFS, Recebidas/Emitidas, etc.) define o **date_rule** (ano, ano/mês ou ano/mês/dia) por nó. Assim o dashboard sabe que, por exemplo, arquivos em `.../Recebidas/2026/03/01` são do dia 01/03/2026.
4. **Server-api** na VM: na inicialização lê `base_path` do Supabase (com `SUPABASE_SERVICE_ROLE_KEY`); usa esse valor para montar caminhos. Fallback: `BASE_PATH` do .env.
5. **Robô** na VM: chama `GET {SERVER_API_URL}/api/robot-config?technical_id=xxx` e recebe `base_path`, `segment_path`, `date_rule` e `folder_structure`. Monta o caminho por empresa:  
   `{base_path}/EMPRESAS/{nome_empresa}/{segment_path}/Recebidas|Emitidas/{ano}/{mês}/{dia}` conforme o date_rule.

## Exemplo de caminho final

- Pasta base (Admin): `C:\Users\ROBO\Documents`
- Segmento do robô NFS (edição do robô): `FISCAL/NFS`
- date_rule do nó NFS: `year_month_day`

Arquivos do dia 01/03/2026 da empresa "EG FLEURY ASSESSORIA E SERVICOS LTDA":

```
C:\Users\ROBO\Documents\EMPRESAS\EG FLEURY ASSESSORIA E SERVICOS LTDA\FISCAL\NFS\Recebidas\2026\03\01
```

O dashboard interpreta essa estrutura (ano/mês/dia) ao listar e sincronizar documentos fiscais.

## Server-api na VM

- Configure **SUPABASE_SERVICE_ROLE_KEY** no .env do server-api para ele ler `admin_settings.base_path` na inicialização.
- Se não configurar, o server-api usa `BASE_PATH` do .env como antes.

## Robôs (Python, etc.)

- Na inicialização, chamar `GET /api/robot-config?technical_id=SEU_TECHNICAL_ID` (o `technical_id` é o mesmo cadastrado no painel para esse robô).
- Usar `base_path`, `segment_path` e `date_rule` da resposta para montar caminhos e salvar arquivos.
- A mesma lógica vale para outros segmentos (DPTO. PESSOAL, Contabil): configurar o segment_path na edição do robô e a estrutura de pastas no painel com o date_rule desejado.
