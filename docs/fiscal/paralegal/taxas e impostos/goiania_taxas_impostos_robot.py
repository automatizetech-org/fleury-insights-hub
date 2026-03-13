import asyncio
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from playwright.async_api import BrowserContext, Frame, Page, async_playwright
from postgrest.exceptions import APIError
from PySide6.QtCore import QObject, Qt, QThread, Signal
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)
from supabase import Client, create_client


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / "goiania-taxas-impostos-robot" / ".env"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
GOIANIA_PORTAL_CPF = os.getenv("GOIANIA_PORTAL_CPF", "71361170115")
GOIANIA_PORTAL_PASSWORD = os.getenv("GOIANIA_PORTAL_PASSWORD", "12345678")
PLAYWRIGHT_USER_DATA_DIR = os.getenv("PLAYWRIGHT_USER_DATA_DIR", str(BASE_DIR / ".playwright-profile"))
PLAYWRIGHT_CHANNEL = os.getenv("PLAYWRIGHT_CHANNEL", "chrome")
PLAYWRIGHT_HEADLESS = os.getenv("PLAYWRIGHT_HEADLESS", "false").lower() == "true"
ROBOT_TECHNICAL_ID = "goiania_taxas_impostos"
LOGIN_URL = "https://www10.goiania.go.gov.br/Internet/Login.aspx?OriginalURL="
HOME_URL = "https://servicos.goiania.go.gov.br/SicaePortal/HomePageNovo.aspx"


def digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def parse_money(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return float(value.replace("R$", "").replace(".", "").replace(",", ".").strip())
    except ValueError:
        return 0.0


def parse_date(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"(\d{2})/(\d{2})/(\d{4})", value)
    if not match:
        return None
    day, month, year = match.groups()
    return f"{year}-{month}-{day}"


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


@dataclass
class CompanyItem:
    id: str
    name: str
    document: str | None
    active: bool
    enabled_for_robot: bool
    selected: bool = False
    status: str = "ATIVO"
    message: str | None = None


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


class RobotBackend:
    def __init__(self) -> None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError(f"Arquivo .env inválido ou ausente em {ENV_PATH}")
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        self.playwright = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None

    def fetch_companies(self) -> list[CompanyItem]:
        response = (
            self.supabase.table("companies")
            .select("id,name,document,active,company_robot_config(enabled,robot_technical_id)")
            .order("name")
            .execute()
        )
        items: list[CompanyItem] = []
        for row in response.data or []:
            configs = row.get("company_robot_config") or []
            explicit = any(config.get("robot_technical_id") == ROBOT_TECHNICAL_ID for config in configs)
            enabled = any(
                config.get("robot_technical_id") == ROBOT_TECHNICAL_ID and config.get("enabled") is True
                for config in configs
            )
            if not explicit:
                enabled = bool(row.get("active", True))
            items.append(
                CompanyItem(
                    id=row["id"],
                    name=row["name"],
                    document=row.get("document"),
                    active=bool(row.get("active", True)),
                    enabled_for_robot=enabled,
                    status="ATIVO" if row.get("active", True) else "INATIVO",
                )
            )
        return items

    async def ensure_browser(self) -> None:
        if self.page:
            return
        self.playwright = await async_playwright().start()
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=PLAYWRIGHT_USER_DATA_DIR,
            channel=PLAYWRIGHT_CHANNEL,
            headless=PLAYWRIGHT_HEADLESS,
            viewport={"width": 1440, "height": 960},
        )
        self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()

    async def ensure_login(self) -> None:
        await self.ensure_browser()
        assert self.page is not None
        if self.page.url.startswith(HOME_URL):
            return
        await self.page.goto(LOGIN_URL, wait_until="domcontentloaded")

        if await self._is_login_form_visible():
            await self._submit_login_form()
            await self.page.wait_for_load_state("networkidle")

        if not self.page.url.startswith(HOME_URL):
            if await self.page.get_by_role("link", name=re.compile("Portal do Contribuinte", re.I)).count():
                await self.page.get_by_role("link", name=re.compile("Portal do Contribuinte", re.I)).click()
                await self.page.wait_for_load_state("networkidle")

        if "Intranet/Login.aspx" in self.page.url or await self._is_login_form_visible():
            await self._submit_login_form()
            await self.page.wait_for_load_state("networkidle")

        if not self.page.url.startswith(HOME_URL):
            raise RuntimeError(f"Login nao concluiu no portal. URL atual: {self.page.url}")

    async def _is_login_form_visible(self) -> bool:
        assert self.page is not None
        cpf_candidates = [
            self.page.get_by_placeholder("Informe o CPF"),
            self.page.locator("input[placeholder='Informe o CPF']"),
            self.page.locator("input[id*='wtLoginInput']"),
            self.page.locator("input[type='text']").first,
        ]
        for candidate in cpf_candidates:
            try:
                if await candidate.count() and await candidate.first.is_visible():
                    return True
            except Exception:
                continue
        return False

    async def _find_cpf_input(self):
        assert self.page is not None
        candidates = [
            self.page.get_by_placeholder("Informe o CPF"),
            self.page.locator("input[placeholder='Informe o CPF']"),
            self.page.locator("input[id*='wtLoginInput']"),
            self.page.locator("input[type='text']").first,
        ]
        for candidate in candidates:
            try:
                target = candidate.first if hasattr(candidate, "first") else candidate
                if await target.count() and await target.is_visible():
                    return target
            except Exception:
                continue
        raise RuntimeError("Campo de CPF nao encontrado na tela de login")

    async def _find_password_input(self):
        assert self.page is not None
        candidates = [
            self.page.locator("input[type='password']").first,
            self.page.locator("input[id*='wtPasswordInput']").first,
        ]
        for candidate in candidates:
            try:
                if await candidate.count() and await candidate.is_visible():
                    return candidate
            except Exception:
                continue
        raise RuntimeError("Campo de senha nao encontrado na tela de login")

    async def _submit_login_form(self) -> None:
        assert self.page is not None
        cpf_input = await self._find_cpf_input()
        password_input = await self._find_password_input()
        await cpf_input.fill(GOIANIA_PORTAL_CPF)
        await password_input.fill(GOIANIA_PORTAL_PASSWORD)
        keep_connected = self.page.get_by_label("Mantenha-me Conectado")
        try:
            if await keep_connected.count():
                await keep_connected.check()
        except Exception:
            pass
        submit_candidates = [
            self.page.get_by_role("button", name=re.compile("Entrar", re.I)),
            self.page.locator("button:has-text('ENTRAR')").first,
            self.page.locator("input[type='submit']").first,
        ]
        for candidate in submit_candidates:
            try:
                target = candidate.first if hasattr(candidate, "first") else candidate
                if await target.count() and await target.is_visible():
                    await target.click()
                    return
            except Exception:
                continue
        raise RuntimeError("Botao de entrar nao encontrado na tela de login")

    async def select_company(self, company: CompanyItem) -> None:
        assert self.page is not None
        select = self.page.locator("select").first
        await select.wait_for(timeout=20000)
        options = await select.locator("option").evaluate_all("(nodes) => nodes.map((n) => ({ value: n.value, text: n.textContent }))")
        target_value = None
        for option in options:
            text = option["text"] or ""
            if company.name.upper() in text.upper() or (digits(company.document) and digits(company.document) in digits(text)):
                target_value = option["value"]
                break
        if not target_value:
            raise RuntimeError(f"Empresa nao localizada no seletor PERFIL: {company.name}")
        await select.select_option(target_value)
        await self.page.wait_for_load_state("networkidle")
        await self.wait_notification_modal()

    async def wait_notification_modal(self) -> None:
        assert self.page is not None
        modal = self.page.locator("text=/Notificação Fiscalização/i, text=/Notificacao Fiscalizacao/i").first
        try:
            await modal.wait_for(timeout=3000)
            await modal.wait_for(state="hidden", timeout=12000)
        except Exception:
            return

    async def open_duam(self) -> Frame:
        assert self.page is not None
        finance_group = self.page.get_by_role("group", name=re.compile("Financeiro", re.I))
        finance_link = finance_group.get_by_role("link", name=re.compile("^Taxas e Impostos$", re.I))
        await finance_link.click()
        modal = self.page.locator("[role='dialog'], .ui-dialog, .modal").filter(has=self.page.locator("iframe")).first
        await modal.wait_for(timeout=20000)
        for _ in range(30):
            for frame in self.page.frames():
                if "PortalTributos/ConsultaTributos" in frame.url():
                    body_text = await frame.locator("body").inner_text()
                    if "Consulta e Emissão de Guia para Pagamento (DUAM)" in body_text or "Consulta e Emissao de Guia para Pagamento (DUAM)" in body_text:
                        return frame
            await asyncio.sleep(1)
        raise RuntimeError("Frame do DUAM nao carregou")

    async def wait_recaptcha_manual(self, on_status) -> None:
        assert self.page is not None
        on_status("AGUARDANDO RECAPTCHA", "Resolva manualmente o reCAPTCHA na janela do navegador")
        for _ in range(180):
            for frame in self.page.frames():
                if "recaptcha/api2/anchor" in frame.url():
                    checked = await frame.locator("#recaptcha-anchor").get_attribute("aria-checked")
                    if checked == "true":
                        return
            await asyncio.sleep(1)
        raise RuntimeError("reCAPTCHA nao concluido a tempo")

    async def extract_debts(self, frame: Frame, company: CompanyItem) -> list[DebtRow]:
        await frame.get_by_role("button", name=re.compile("Consultar", re.I)).click()
        for _ in range(60):
            body_text = await frame.locator("body").inner_text()
            if "Nenhum débito" in body_text or "Nenhum debito" in body_text:
                return []
            tables = await frame.locator("table").count()
            if tables:
                break
            await asyncio.sleep(1)
        table = frame.locator("table").filter(has_text=re.compile("Vencimento|Documento|Tributo|Situacao|Situação|Rubrica|Processo", re.I)).first
        await table.wait_for(timeout=15000)
        headers = [value.strip().lower() for value in await table.locator("thead th, tr th").all_text_contents()]
        rows = await table.locator("tbody tr").all()
        debts: list[DebtRow] = []
        for row in rows:
            cells = [value.strip() for value in await row.locator("td").all_text_contents()]
            if not cells:
                continue
            mapped: dict[str, Any] = {"ano": None, "tributo": None, "numero_documento": None, "data_vencimento": None, "valor": None, "situacao": None}
            for index, cell in enumerate(cells):
                header = headers[index] if index < len(headers) else ""
                if "ano" in header:
                    mapped["ano"] = cell
                elif "rubrica" in header or "tribut" in header:
                    mapped["tributo"] = cell
                elif "document" in header or "processo" in header:
                    mapped["numero_documento"] = cell
                elif "venc" in header:
                    mapped["data_vencimento"] = cell
                elif "valor" in header:
                    mapped["valor"] = cell
                elif "situ" in header:
                    mapped["situacao"] = cell
            debts.append(
                DebtRow(
                    ano=int(mapped["ano"]) if mapped["ano"] and str(mapped["ano"]).isdigit() else None,
                    tributo=mapped["tributo"] or "Tributo nao identificado",
                    numero_documento=mapped["numero_documento"] or f"{company.id}-{len(debts)+1}",
                    data_vencimento=parse_date(mapped["data_vencimento"]),
                    valor=parse_money(mapped["valor"]),
                    situacao=mapped["situacao"],
                    portal_cai=digits(company.document),
                    detalhes={"linha": mapped},
                )
            )
        return debts

    def create_run(self, company: CompanyItem) -> str:
        try:
            response = self.supabase.table("municipal_tax_collection_runs").insert(
                {
                    "robot_technical_id": ROBOT_TECHNICAL_ID,
                    "company_id": company.id,
                    "company_name": company.name,
                    "status": "running",
                    "started_at": utc_now_iso(),
                }
            ).execute()
            return response.data[0]["id"]
        except APIError as exc:
            if exc.code == "PGRST205":
                return ""
            raise

    def finish_run(self, run_id: str, status: str, debts_found: int = 0, error_message: str | None = None) -> None:
        if not run_id:
            return
        try:
            self.supabase.table("municipal_tax_collection_runs").update(
                {
                    "status": status,
                    "debts_found": debts_found,
                    "error_message": error_message,
                    "finished_at": utc_now_iso(),
                }
            ).eq("id", run_id).execute()
        except APIError as exc:
            if exc.code != "PGRST205":
                raise

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
                "fetched_at": utc_now_iso(),
            }
            for debt in debts
        ]
        try:
            self.supabase.table("municipal_tax_debts").upsert(
                payload,
                on_conflict="company_id,tributo,numero_documento,data_vencimento",
            ).execute()
        except APIError as exc:
            if exc.code != "PGRST205":
                raise


class RobotWorker(QObject):
    status_changed = Signal(str)
    log_message = Signal(str)
    company_changed = Signal(str, str, str)
    finished = Signal()

    def __init__(self, backend: RobotBackend, companies: list[CompanyItem]) -> None:
        super().__init__()
        self.backend = backend
        self.companies = companies

    def run(self) -> None:
        asyncio.run(self._run())

    async def _run(self) -> None:
        self.status_changed.emit("EXECUTANDO")
        try:
            await self.backend.ensure_login()
            self.log_message.emit("Login concluido no portal da Prefeitura de Goiania.")
            for company in self.companies:
                run_id = self.backend.create_run(company)
                try:
                    self.company_changed.emit(company.id, "EXECUTANDO", "Selecionando empresa no PERFIL")
                    await self.backend.select_company(company)
                    self.company_changed.emit(company.id, "EXECUTANDO", "Abrindo Financeiro > Taxas e Impostos")
                    frame = await self.backend.open_duam()
                    await self.backend.wait_recaptcha_manual(lambda status, message: self.company_changed.emit(company.id, status, message))
                    self.company_changed.emit(company.id, "EXECUTANDO", "Consultando tabela de debitos")
                    debts = await self.backend.extract_debts(frame, company)
                    self.backend.upsert_debts(company, debts)
                    self.backend.finish_run(run_id, "completed", debts_found=len(debts))
                    self.company_changed.emit(company.id, "CONCLUIDO", f"{len(debts)} debito(s) sincronizado(s)")
                    self.log_message.emit(f"{company.name}: {len(debts)} debito(s) sincronizado(s).")
                except Exception as exc:
                    self.backend.finish_run(run_id, "failed", error_message=str(exc))
                    self.company_changed.emit(company.id, "ERRO", str(exc))
                    self.log_message.emit(f"{company.name}: erro - {exc}")
        finally:
            self.status_changed.emit("AGUARDANDO")
            self.finished.emit()


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.backend = RobotBackend()
        self.companies: list[CompanyItem] = []
        self.checkboxes: dict[str, QCheckBox] = {}
        self.worker_thread: QThread | None = None
        self.worker: RobotWorker | None = None
        self.setWindowTitle("Robô Goiânia - Taxas e Impostos")
        self.resize(1480, 900)
        self._build_ui()
        self.sync_companies()

    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        header = QLabel("Robô Goiânia - Taxas e Impostos")
        header.setFont(QFont("Segoe UI", 20, QFont.Weight.Bold))
        layout.addWidget(header)

        subheader = QLabel("Interface desktop em Python para sincronizar empresas, acompanhar status e executar a coleta municipal.")
        subheader.setStyleSheet("color: #94a3b8;")
        layout.addWidget(subheader)

        cards_row = QHBoxLayout()
        self.status_card = self._stat_card("Status do robô", "AGUARDANDO")
        self.total_card = self._stat_card("Empresas", "0")
        self.active_card = self._stat_card("Ativas", "0")
        self.selected_card = self._stat_card("Selecionadas", "0")
        for card in [self.status_card[0], self.total_card[0], self.active_card[0], self.selected_card[0]]:
            cards_row.addWidget(card)
        layout.addLayout(cards_row)

        toolbar = QHBoxLayout()
        self.sync_button = QPushButton("Sincronizar empresas")
        self.run_button = QPushButton("Executar selecionadas")
        self.sync_button.clicked.connect(self.sync_companies)
        self.run_button.clicked.connect(self.start_execution)
        toolbar.addWidget(self.sync_button)
        toolbar.addWidget(self.run_button)
        toolbar.addStretch()
        layout.addLayout(toolbar)

        self.table = QTableWidget(0, 7)
        self.table.setHorizontalHeaderLabels(["Selecionar", "Empresa", "Documento", "Ativa", "Config robô", "Status", "Mensagem"])
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(6, QHeaderView.ResizeMode.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setShowGrid(False)
        self.table.setAlternatingRowColors(True)
        self.table.setSelectionMode(QTableWidget.SelectionMode.NoSelection)
        self.table.setFrameShape(QFrame.Shape.NoFrame)
        layout.addWidget(self.table, 1)

        log_title = QLabel("Log de execução")
        log_title.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        layout.addWidget(log_title)

        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setFixedHeight(180)
        layout.addWidget(self.log_box)

        self.setStyleSheet(
            """
            QMainWindow, QWidget { background: #0f172a; color: #e2e8f0; font-family: 'Segoe UI'; }
            QPushButton {
                background: #0f766e; color: white; border: none; border-radius: 12px;
                padding: 12px 18px; font-weight: 600;
            }
            QPushButton:hover { background: #115e59; }
            QTableWidget {
                background: #111827; border: 1px solid #1f2937; border-radius: 16px;
                alternate-background-color: #0b1220;
            }
            QHeaderView::section {
                background: #172033; color: #94a3b8; border: none; padding: 10px; font-weight: 600;
            }
            QTextEdit {
                background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 10px;
            }
            QCheckBox::indicator {
                width: 18px; height: 18px; border-radius: 6px; border: 1px solid #334155; background: #0b1220;
            }
            QCheckBox::indicator:checked { background: #2563eb; border: 1px solid #2563eb; }
            """
        )

    def _stat_card(self, title: str, value: str) -> tuple[QFrame, QLabel]:
        frame = QFrame()
        frame.setStyleSheet("QFrame { background: #111827; border: 1px solid #1f2937; border-radius: 16px; }")
        frame.setMinimumHeight(96)
        grid = QGridLayout(frame)
        title_label = QLabel(title)
        title_label.setStyleSheet("color: #94a3b8; font-size: 12px;")
        value_label = QLabel(value)
        value_label.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        grid.addWidget(title_label, 0, 0)
        grid.addWidget(value_label, 1, 0)
        return frame, value_label

    def sync_companies(self) -> None:
        try:
            previous_selection = {company.id: company.selected for company in self.companies}
            self.companies = self.backend.fetch_companies()
            for company in self.companies:
                company.selected = previous_selection.get(company.id, False)
            self.populate_table()
            self.append_log("Empresas sincronizadas com o Supabase.")
        except Exception as exc:
            QMessageBox.critical(self, "Erro", str(exc))

    def populate_table(self) -> None:
        self.table.setRowCount(len(self.companies))
        self.checkboxes.clear()
        for row, company in enumerate(self.companies):
            checkbox = QCheckBox()
            checkbox.setChecked(company.selected)
            checkbox.setEnabled(company.active)
            checkbox.stateChanged.connect(lambda state, company_id=company.id: self.toggle_company(company_id, state))
            self.checkboxes[company.id] = checkbox
            self.table.setCellWidget(row, 0, checkbox)
            self.table.setItem(row, 1, QTableWidgetItem(company.name))
            self.table.setItem(row, 2, QTableWidgetItem(company.document or "-"))
            self.table.setItem(row, 3, QTableWidgetItem("SIM" if company.active else "NAO"))
            self.table.setItem(row, 4, QTableWidgetItem("SIM" if company.enabled_for_robot else "NAO"))
            self.table.setItem(row, 5, self._status_item(company.status))
            self.table.setItem(row, 6, QTableWidgetItem(company.message or "-"))
        self.table.resizeColumnsToContents()
        self.total_card[1].setText(str(len(self.companies)))
        self.active_card[1].setText(str(len([company for company in self.companies if company.active])))
        self.selected_card[1].setText(str(len([company for company in self.companies if company.selected])))

    def _status_item(self, text: str) -> QTableWidgetItem:
        item = QTableWidgetItem(text)
        if "ERRO" in text:
            item.setForeground(QColor("#fb7185"))
        elif "CONCLUIDO" in text:
            item.setForeground(QColor("#34d399"))
        elif "EXECUTANDO" in text or "AGUARDANDO" in text:
            item.setForeground(QColor("#60a5fa"))
        else:
            item.setForeground(QColor("#cbd5e1"))
        return item

    def toggle_company(self, company_id: str, state: int) -> None:
        for company in self.companies:
            if company.id == company_id:
                company.selected = state == Qt.CheckState.Checked.value
                break
        self.selected_card[1].setText(str(len([company for company in self.companies if company.selected])))

    def update_company_state(self, company_id: str, status: str, message: str) -> None:
        for row, company in enumerate(self.companies):
            if company.id == company_id:
                company.status = status
                company.message = message
                self.table.setItem(row, 5, self._status_item(status))
                self.table.setItem(row, 6, QTableWidgetItem(message or "-"))
                break

    def set_global_status(self, status: str) -> None:
        self.status_card[1].setText(status)

    def append_log(self, message: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_box.append(f"[{timestamp}] {message}")

    def start_execution(self) -> None:
        selected = [company for company in self.companies if company.selected and company.active]
        if not selected:
            QMessageBox.information(self, "Seleção", "Selecione ao menos uma empresa ativa.")
            return
        self.run_button.setEnabled(False)
        self.sync_button.setEnabled(False)
        self.worker_thread = QThread()
        self.worker = RobotWorker(self.backend, selected)
        self.worker.moveToThread(self.worker_thread)
        self.worker_thread.started.connect(self.worker.run)
        self.worker.status_changed.connect(self.set_global_status)
        self.worker.log_message.connect(self.append_log)
        self.worker.company_changed.connect(self.update_company_state)
        self.worker.finished.connect(self.execution_finished)
        self.worker.finished.connect(self.worker_thread.quit)
        self.worker_thread.finished.connect(self.worker_thread.deleteLater)
        self.worker_thread.start()

    def execution_finished(self) -> None:
        self.run_button.setEnabled(True)
        self.sync_button.setEnabled(True)
        self.selected_card[1].setText(str(len([company for company in self.companies if company.selected])))
        self.append_log("Execução finalizada.")


def main() -> int:
    qt_app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    return qt_app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
