# Robo Goiânia - Taxas e Impostos

Robo Python para consultar debitos municipais no portal da Prefeitura de Goiania e enviar os resultados para o Supabase.

## O que entrega

- Lista de empresas vinda do Supabase atual
- Filtro pelas empresas habilitadas no `company_robot_config`
- Interface web para selecionar empresas e executar manualmente
- Coleta via Playwright com contexto persistente
- Upsert em `municipal_tax_debts`
- Log de execucao em `municipal_tax_collection_runs`

## Preparacao

1. Criar `.env` a partir de `.env.example`
2. Instalar dependencias:

```bash
pip install -r requirements.txt
python -m playwright install chrome
```

3. Subir a interface:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8092
```

## Observacoes operacionais

- O navegador roda com perfil persistente para reduzir falhas de sessao e de reCAPTCHA.
- O fluxo tenta usar o seletor de empresa nativo do portal e, como fallback, busca por links/botoes de `Taxas e Impostos`.
- Se o reCAPTCHA bloquear a consulta, o operador pode validar manualmente na janela do navegador aberta pelo Playwright.
