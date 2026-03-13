from __future__ import annotations

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

if __package__ in (None, ""):
    current_dir = Path(__file__).resolve().parent
    package_root = current_dir.parent
    if str(package_root) not in sys.path:
        sys.path.insert(0, str(package_root))
    from app.collector import MunicipalTaxCollector
    from app.config import settings
    from app.models import CompanyItem
    from app.portal_client import GoianiaPortalClient
    from app.state import RobotState
    from app.supabase_gateway import SupabaseGateway
else:
    from .collector import MunicipalTaxCollector
    from .config import settings
    from .models import CompanyItem
    from .portal_client import GoianiaPortalClient
    from .state import RobotState
    from .supabase_gateway import SupabaseGateway

gateway = SupabaseGateway()
state = RobotState()
collector = MunicipalTaxCollector(gateway, state)


class RunRequest(BaseModel):
    company_ids: list[str]


@asynccontextmanager
async def lifespan(_: FastAPI):
    await sync_companies()
    yield


app = FastAPI(title="Robo Goiânia - Taxas e Impostos", lifespan=lifespan)


async def sync_companies() -> None:
    companies = await asyncio.to_thread(gateway.fetch_companies)
    await state.sync_companies(companies)


async def run_selected_companies(company_ids: list[str]) -> None:
    snapshot = await state.snapshot()
    companies = [item for item in snapshot["companies"] if item["id"] in company_ids]
    if not companies:
        return
    await state.set_global_status("running")
    try:
        async with GoianiaPortalClient() as portal:
            for company in companies:
                await collector.collect_company(
                    portal,
                    CompanyItem(
                        id=company["id"],
                        name=company["name"],
                        document=company.get("document"),
                        active=company["active"],
                        enabled_for_robot=company["enabled_for_robot"],
                        status=company["status"],
                        last_message=company.get("last_message"),
                    ),
                )
    finally:
        await state.set_global_status("idle")
        await sync_companies()


@app.get("/", response_class=HTMLResponse)
async def dashboard() -> str:
    return """
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Robo Goiânia - Taxas e Impostos</title>
  <style>
    :root { color-scheme: dark; --bg:#0f172a; --card:#111827; --line:#243041; --accent:#2563eb; --muted:#94a3b8; }
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:linear-gradient(180deg,#0f172a,#111827); color:#e5e7eb; }
    .wrap { max-width:1200px; margin:0 auto; padding:24px; }
    .grid { display:grid; gap:16px; }
    .top { grid-template-columns: 1.2fr .8fr; }
    .card { background:rgba(17,24,39,.9); border:1px solid var(--line); border-radius:18px; padding:18px; }
    .toolbar { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
    button { background:var(--accent); color:white; border:0; border-radius:12px; padding:10px 14px; cursor:pointer; }
    button.secondary { background:#1e293b; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th,td { padding:10px; border-top:1px solid var(--line); text-align:left; }
    .badge { display:inline-block; border-radius:999px; padding:4px 9px; font-size:12px; }
    .ativo,.concluido { background:rgba(16,185,129,.15); color:#6ee7b7; }
    .executando { background:rgba(59,130,246,.15); color:#93c5fd; }
    .erro { background:rgba(244,63,94,.15); color:#fda4af; }
    .inativo { background:rgba(148,163,184,.15); color:#cbd5e1; }
    .muted { color:var(--muted); }
    @media (max-width: 900px) { .top { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="wrap grid">
    <div class="toolbar">
      <button onclick="refreshCompanies()">Sincronizar empresas</button>
      <button class="secondary" onclick="runSelected()">Executar selecionadas</button>
      <span id="robot-status" class="muted">Carregando...</span>
    </div>
    <div class="grid top">
      <section class="card">
        <h2>Empresas</h2>
        <p class="muted">Lista sincronizada do Supabase. Empresas ativas podem ser selecionadas; a configuracao do robo aparece apenas como referencia.</p>
        <div id="companies"></div>
      </section>
      <section class="card">
        <h2>Status</h2>
        <p class="muted">Execucao manual do robo municipal de Goiania.</p>
        <div id="summary"></div>
      </section>
    </div>
  </div>
  <script>
    async function loadState() {
      const res = await fetch('/api/state');
      const data = await res.json();
      document.getElementById('robot-status').textContent = 'Status do robo: ' + data.robot_status;
      const enabled = data.companies.filter(c => c.enabled_for_robot);
      document.getElementById('summary').innerHTML = `
        <p>Total sincronizadas: ${data.companies.length}</p>
        <p>Configuradas para o robo: ${enabled.length}</p>
        <p>Ativas: ${data.companies.filter(c => c.active).length}</p>
      `;
      document.getElementById('companies').innerHTML = `
        <table>
          <thead><tr><th></th><th>Empresa</th><th>Documento</th><th>Ativa</th><th>Config robo</th><th>Status</th><th>Mensagem</th></tr></thead>
          <tbody>
            ${data.companies.map(company => `
              <tr>
                <td><input type="checkbox" value="${company.id}" ${company.active ? '' : 'disabled'}></td>
                <td>${company.name}</td>
                <td>${company.document ?? '-'}</td>
                <td><span class="badge ${company.active ? 'ativo' : 'inativo'}">${company.active ? 'sim' : 'nao'}</span></td>
                <td><span class="badge ${company.enabled_for_robot ? 'ativo' : 'inativo'}">${company.enabled_for_robot ? 'sim' : 'nao'}</span></td>
                <td><span class="badge ${company.status}">${company.status}</span></td>
                <td>${company.last_message ?? '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    async function refreshCompanies() {
      await fetch('/api/companies/sync', { method: 'POST' });
      await loadState();
    }
    async function runSelected() {
      const ids = [...document.querySelectorAll('input[type=checkbox]:checked')].map(item => item.value);
      if (!ids.length) { alert('Selecione pelo menos uma empresa'); return; }
      const res = await fetch('/api/run', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ company_ids: ids }) });
      if (!res.ok) { alert('Falha ao iniciar'); return; }
      alert('Execucao iniciada');
      await loadState();
    }
    loadState();
    setInterval(loadState, 8000);
  </script>
</body>
</html>
    """


@app.get("/api/state")
async def get_state() -> dict:
    return await state.snapshot()


@app.post("/api/companies/sync")
async def sync_companies_endpoint() -> dict:
    await sync_companies()
    return {"ok": True}


@app.post("/api/run")
async def run_robot(payload: RunRequest) -> dict:
    snapshot = await state.snapshot()
    available = {company["id"] for company in snapshot["companies"] if company["active"]}
    selected = [company_id for company_id in payload.company_ids if company_id in available]
    if not selected:
        raise HTTPException(status_code=400, detail="Nenhuma empresa valida foi selecionada")
    asyncio.create_task(run_selected_companies(selected))
    return {"ok": True, "queued": len(selected)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.robot_host, port=settings.robot_port, reload=False)
