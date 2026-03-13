from __future__ import annotations

import asyncio
from dataclasses import asdict
from datetime import datetime

from .models import CompanyItem


class RobotState:
    def __init__(self) -> None:
        self._companies: dict[str, CompanyItem] = {}
        self._status: str = "idle"
        self._lock = asyncio.Lock()

    async def sync_companies(self, companies: list[CompanyItem]) -> None:
        async with self._lock:
            current_status = {company_id: item.status for company_id, item in self._companies.items()}
            current_message = {company_id: item.last_message for company_id, item in self._companies.items()}
            self._companies = {}
            for company in companies:
                company.status = current_status.get(company.id, "inactive" if not company.active else "ativo")
                company.last_message = current_message.get(company.id)
                company.updated_at = datetime.utcnow()
                self._companies[company.id] = company

    async def set_global_status(self, value: str) -> None:
        async with self._lock:
            self._status = value

    async def set_company_status(self, company_id: str, status: str, message: str | None = None) -> None:
        async with self._lock:
            if company_id in self._companies:
                self._companies[company_id].status = status
                self._companies[company_id].last_message = message
                self._companies[company_id].updated_at = datetime.utcnow()

    async def snapshot(self) -> dict:
        async with self._lock:
            return {
                "robot_status": self._status,
                "companies": [asdict(item) for item in self._companies.values()],
            }
