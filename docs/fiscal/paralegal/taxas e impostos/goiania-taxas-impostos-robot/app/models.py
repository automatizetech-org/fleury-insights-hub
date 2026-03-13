from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class CompanyItem:
    id: str
    name: str
    document: str | None
    active: bool
    enabled_for_robot: bool
    status: str = "inactive"
    last_message: str | None = None
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DebtRow:
    ano: int | None
    tributo: str
    numero_documento: str
    data_vencimento: str | None
    valor: float
    situacao: str | None
    portal_inscricao: str | None = None
    portal_cai: str | None = None
    detalhes: dict[str, Any] = field(default_factory=dict)
