from __future__ import annotations

from .models import CompanyItem
from .portal_client import GoianiaPortalClient
from .state import RobotState
from .supabase_gateway import SupabaseGateway


class MunicipalTaxCollector:
    def __init__(self, gateway: SupabaseGateway, state: RobotState) -> None:
        self.gateway = gateway
        self.state = state

    async def collect_company(self, portal: GoianiaPortalClient, company: CompanyItem) -> None:
        run_id = self.gateway.create_run(company, status="running")
        await self.state.set_company_status(company.id, "executando", "Consultando portal")
        try:
            debts = await portal.collect_company_debts(company)
            self.gateway.upsert_debts(company, debts)
            self.gateway.finish_run(run_id, status="completed", debts_found=len(debts))
            await self.state.set_company_status(company.id, "concluido", f"{len(debts)} debito(s)")
        except Exception as exc:
            self.gateway.finish_run(run_id, status="failed", error_message=str(exc))
            await self.state.set_company_status(company.id, "erro", str(exc))
            raise
