from __future__ import annotations

from datetime import datetime
from typing import Any

from supabase import Client, create_client

from .config import settings
from .models import CompanyItem, DebtRow


class SupabaseGateway:
    def __init__(self) -> None:
        self.client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)

    def fetch_companies(self) -> list[CompanyItem]:
        response = (
            self.client.table("companies")
            .select("id,name,document,active,company_robot_config(enabled,robot_technical_id)")
            .order("name")
            .execute()
        )
        items: list[CompanyItem] = []
        for row in response.data or []:
            configs = row.get("company_robot_config") or []
            has_explicit_config = any(
                config.get("robot_technical_id") == settings.robot_technical_id
                for config in configs
            )
            enabled = any(
                config.get("robot_technical_id") == settings.robot_technical_id and config.get("enabled") is True
                for config in configs
            )
            if not has_explicit_config:
                enabled = bool(row.get("active", True))
            items.append(
                CompanyItem(
                    id=row["id"],
                    name=row["name"],
                    document=row.get("document"),
                    active=bool(row.get("active", True)),
                    enabled_for_robot=enabled,
                )
            )
        return items

    def create_run(self, company: CompanyItem | None, status: str = "pending") -> str:
        payload = {
            "robot_technical_id": settings.robot_technical_id,
            "company_id": company.id if company else None,
            "company_name": company.name if company else None,
            "status": status,
            "started_at": datetime.utcnow().isoformat(),
        }
        response = self.client.table("municipal_tax_collection_runs").insert(payload).execute()
        return response.data[0]["id"]

    def finish_run(self, run_id: str, status: str, debts_found: int = 0, error_message: str | None = None, metadata: dict[str, Any] | None = None) -> None:
        self.client.table("municipal_tax_collection_runs").update(
            {
                "status": status,
                "debts_found": debts_found,
                "error_message": error_message,
                "metadata": metadata or {},
                "finished_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", run_id).execute()

    def upsert_debts(self, company: CompanyItem, debts: list[DebtRow]) -> None:
        if not debts:
            return
        payload = [
            {
                "company_id": company.id,
                "ano": debt.ano,
                "tributo": debt.tributo,
                "numero_documento": debt.numero_documento,
                "data_vencimento": debt.data_vencimento,
                "valor": debt.valor,
                "situacao": debt.situacao,
                "portal_inscricao": debt.portal_inscricao,
                "portal_cai": debt.portal_cai,
                "detalhes": debt.detalhes,
                "fetched_at": datetime.utcnow().isoformat(),
            }
            for debt in debts
        ]
        self.client.table("municipal_tax_debts").upsert(
            payload,
            on_conflict="company_id,tributo,numero_documento,data_vencimento",
        ).execute()
