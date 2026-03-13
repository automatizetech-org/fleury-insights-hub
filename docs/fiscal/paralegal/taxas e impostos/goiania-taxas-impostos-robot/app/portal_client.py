from __future__ import annotations

import asyncio
import re
from typing import Any

from playwright.async_api import BrowserContext, Frame, Page, async_playwright

from .config import settings
from .models import CompanyItem, DebtRow

LOGIN_URL = "https://www10.goiania.go.gov.br/Internet/Login.aspx?OriginalURL="
HOME_URL = "https://servicos.goiania.go.gov.br/SicaePortal/HomePageNovo.aspx"
PORTAL_TRIBUTOS_URL_PART = "PortalTributos/ConsultaTributos"
MOSTRA_DEBITOS_URL_PART = "MostraDebitos.aspx"


def _digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def _parse_money(value: str | None) -> float:
    if not value:
        return 0.0
    cleaned = value.replace("R$", "").replace(".", "").replace(",", ".").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"(\d{2})/(\d{2})/(\d{4})", value)
    if not match:
        return None
    day, month, year = match.groups()
    return f"{year}-{month}-{day}"


class GoianiaPortalClient:
    def __init__(self) -> None:
        self._playwright = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    async def __aenter__(self) -> "GoianiaPortalClient":
        self._playwright = await async_playwright().start()
        self._context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=settings.playwright_user_data_dir,
            channel=settings.playwright_channel,
            headless=settings.playwright_headless,
            viewport={"width": 1440, "height": 960},
        )
        self._page = self._context.pages[0] if self._context.pages else await self._context.new_page()
        await self._page.goto(LOGIN_URL, wait_until="networkidle")
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._context:
            await self._context.close()
        if self._playwright:
            await self._playwright.stop()

    @property
    def page(self) -> Page:
        if not self._page:
            raise RuntimeError("Browser not initialized")
        return self._page

    async def ensure_login(self) -> None:
        if self.page.url.startswith(HOME_URL):
            return

        await self.page.goto(LOGIN_URL, wait_until="domcontentloaded")
        await self.page.get_by_label("CPF").fill(settings.goiania_portal_cpf)
        await self.page.get_by_label("Senha").fill(settings.goiania_portal_password)
        keep_connected = self.page.get_by_label("Mantenha-me Conectado")
        if await keep_connected.count():
            await keep_connected.check()
        await self.page.get_by_role("button", name=re.compile("Entrar", re.I)).click()
        await self.page.wait_for_load_state("networkidle")

        if "Intranet/Login.aspx" in self.page.url:
            await self.page.get_by_label("CPF").fill(settings.goiania_portal_cpf)
            await self.page.get_by_label("Senha").fill(settings.goiania_portal_password)
            await self.page.get_by_role("button", name=re.compile("Entrar", re.I)).click()
            await self.page.wait_for_load_state("networkidle")

        if not self.page.url.startswith(HOME_URL):
            raise RuntimeError("Nao foi possivel concluir o login no portal de Goiania")

    async def collect_company_debts(self, company: CompanyItem) -> list[DebtRow]:
        await self.ensure_login()
        await self._select_company(company)
        await self._wait_notification_modal()
        await self._open_municipal_tax_area()
        tributos_frame = await self._open_duam_frame()
        await self._wait_for_recaptcha_and_submit(tributos_frame)
        return await self._extract_debts_table(company, tributos_frame)

    async def _select_company(self, company: CompanyItem) -> None:
        select = self.page.locator("select").first
        await select.wait_for(timeout=20000)
        options = await select.locator("option").all_text_contents()
        target_value = None
        company_name = company.name.upper()
        company_document = _digits(company.document)
        for index, option in enumerate(options):
            option_normalized = option.upper()
            if company_name in option_normalized or (company_document and company_document in _digits(option)):
                values = await select.locator("option").evaluate_all("(nodes) => nodes.map((node) => node.value)")
                target_value = values[index]
                break
        if not target_value:
            raise RuntimeError(f"Empresa nao localizada no seletor do portal: {company.name}")
        await select.select_option(target_value)
        await self.page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

    async def _wait_notification_modal(self) -> None:
        modal = self.page.locator("text=/Notificação Fiscalização/i, text=/Notificacao Fiscalizacao/i").first
        try:
            await modal.wait_for(timeout=4000)
            await modal.wait_for(state="hidden", timeout=12000)
        except Exception:
            return

    async def _open_municipal_tax_area(self) -> None:
        finance_group = self.page.get_by_role("group", name=re.compile("Financeiro", re.I))
        finance_link = finance_group.get_by_role("link", name=re.compile("^Taxas e Impostos$", re.I))
        if await finance_link.count():
            await finance_link.click()
            return
        fallback = self.page.locator("a[href*='MostraDebitos.aspx']").first
        if await fallback.count():
            await fallback.click()
            return
        raise RuntimeError("Link Financeiro > Taxas e Impostos nao encontrado")

    async def _open_duam_frame(self) -> Frame:
        duam_dialog = self.page.locator("[role='dialog'], .ui-dialog, .modal").filter(has=self.page.locator("iframe")).first
        await duam_dialog.wait_for(timeout=20000)
        for _ in range(30):
            tributos_frame = self._find_tributos_frame()
            if tributos_frame:
                body_text = await tributos_frame.locator("body").inner_text()
                if "Consulta e Emissão de Guia para Pagamento (DUAM)" in body_text or "Consulta e Emissao de Guia para Pagamento (DUAM)" in body_text:
                    return tributos_frame
            await asyncio.sleep(1)
        raise RuntimeError("Modal DUAM abriu, mas a pagina interna de consulta nao carregou")

    def _find_tributos_frame(self) -> Frame | None:
        for frame in self.page.frames():
            if PORTAL_TRIBUTOS_URL_PART in frame.url():
                return frame
        return None

    def _find_recaptcha_anchor_frame(self) -> Frame | None:
        for frame in self.page.frames():
            if "recaptcha/api2/anchor" in frame.url():
                return frame
        return None

    async def _wait_for_recaptcha_and_submit(self, tributos_frame: Frame) -> None:
        # O reCAPTCHA pode exigir acao manual. O robo aguarda o checkbox validar
        # antes de enviar a consulta para manter o fluxo compatível com o portal real.
        for _ in range(180):
            anchor_frame = self._find_recaptcha_anchor_frame()
            if anchor_frame:
                checked = await anchor_frame.locator("#recaptcha-anchor").get_attribute("aria-checked")
                if checked == "true":
                    break
            await asyncio.sleep(1)
        else:
            raise RuntimeError("reCAPTCHA nao foi validado no modal DUAM")

        await tributos_frame.get_by_role("button", name=re.compile("Consultar", re.I)).click()

        for _ in range(60):
            if await tributos_frame.locator("table").count():
                return
            body_text = await tributos_frame.locator("body").inner_text()
            if "Nenhum débito" in body_text or "Nenhum debito" in body_text:
                return
            await asyncio.sleep(1)
        raise RuntimeError("A consulta DUAM nao retornou tabela nem mensagem de vazio")

    async def _extract_debts_table(self, company: CompanyItem, tributos_frame: Frame) -> list[DebtRow]:
        await tributos_frame.wait_for_load_state()
        table = tributos_frame.locator("table").filter(has_text=re.compile("Vencimento|Documento|Tributo|Situacao|Situação", re.I)).first
        await table.wait_for(timeout=20000)
        headers = [header.strip().lower() for header in await table.locator("thead th, tr th").all_text_contents()]
        rows = await table.locator("tbody tr").all()
        debts: list[DebtRow] = []
        for row in rows:
            cells = [cell.strip() for cell in await row.locator("td").all_text_contents()]
            if not cells:
                continue
            mapped = self._map_row(headers, cells)
            if not mapped["numero_documento"] and not mapped["tributo"]:
                continue
            debts.append(
                DebtRow(
                    ano=int(mapped["ano"]) if mapped["ano"] and str(mapped["ano"]).isdigit() else None,
                    tributo=mapped["tributo"] or "Tributo nao identificado",
                    numero_documento=mapped["numero_documento"] or f"sem-documento-{len(debts)+1}",
                    data_vencimento=_parse_date(mapped["data_vencimento"]),
                    valor=_parse_money(mapped["valor"]),
                    situacao=mapped["situacao"],
                    portal_inscricao=mapped.get("inscricao"),
                    portal_cai=mapped.get("cai"),
                    detalhes={"empresa": company.name, "linha_original": mapped},
                )
            )
        return debts

    def _map_row(self, headers: list[str], cells: list[str]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "ano": None,
            "tributo": None,
            "numero_documento": None,
            "data_vencimento": None,
            "valor": None,
            "situacao": None,
            "inscricao": None,
            "cai": None,
        }
        for index, cell in enumerate(cells):
            header = headers[index] if index < len(headers) else ""
            if "ano" in header:
                payload["ano"] = cell
            elif "tribut" in header:
                payload["tributo"] = cell
            elif "document" in header or "numero" in header:
                payload["numero_documento"] = cell
            elif "venc" in header:
                payload["data_vencimento"] = cell
            elif "valor" in header:
                payload["valor"] = cell
            elif "situ" in header:
                payload["situacao"] = cell
            elif "inscri" in header:
                payload["inscricao"] = cell
            elif "cai" in header:
                payload["cai"] = cell
        if not payload["tributo"] and len(cells) >= 2:
            payload["tributo"] = cells[1]
        if not payload["numero_documento"] and len(cells) >= 3:
            payload["numero_documento"] = cells[2]
        return payload
