# Robo Goiania - Taxas e Impostos

Aplicacao desktop em arquivo unico (`Goiânia taxas impostos.py`) para:

- sincronizar empresas do Supabase
- selecionar empresas manualmente
- iniciar e parar a execucao
- abrir o portal da Prefeitura de Goiania com Playwright
- trocar o `PERFIL` da empresa
- entrar em `Servicos Fazenda > Taxas e Impostos`
- aguardar o reCAPTCHA manual
- consultar a tabela de debitos
- salvar os dados em `municipal_tax_debts`
- registrar o historico em `municipal_tax_collection_runs`

## Execucao

```bash
pip install -r requirements.txt
python -m playwright install chrome
python "Goiânia taxas impostos.py"
```

Ou use `start.bat`.

## Estrutura

- `Goiânia taxas impostos.py`: toda a logica do robo e da interface
- `data/`: icones, imagens e binarios do Playwright reaproveitados do padrao visual do `bot.py`
- `.env`: credenciais do Supabase e do portal
