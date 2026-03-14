from __future__ import annotations

import asyncio
import os
import re
import shutil
import socket
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from playwright.async_api import BrowserContext, Frame, Page, async_playwright
from postgrest.exceptions import APIError
from PySide6.QtCore import QThread, Qt, Signal
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)
from supabase import Client, create_client


BASE_DIR = Path(__file__).resolve().parent
ROBOTS_BASE_ENV_DIR = Path(r"C:\Users\ROBO\Documents\ROBOS")
ENV_CANDIDATES = [
    ROBOTS_BASE_ENV_DIR / ".env",
    ROBOTS_BASE_ENV_DIR / ".env.example",
    BASE_DIR / ".env",
    BASE_DIR / ".env.example",
]
for env_path in ENV_CANDIDATES:
    if env_path.exists():
        load_dotenv(env_path, override=False)

DATA_DIR = BASE_DIR / "data"
PNG_DIR = DATA_DIR / "image"
ICO_DIR = DATA_DIR / "ico"
PLAYWRIGHT_DIR = DATA_DIR / "ms-playwright"
PLAYWRIGHT_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(PLAYWRIGHT_DIR))
CDP_PORT = int(os.getenv("GOIANIA_CDP_PORT", "9223"))
CHROME_EXE = DATA_DIR / "Chrome" / "chrome.exe"
CHROME_PROFILE_DIR = DATA_DIR / "chrome_cdp_profile"
CHROME_LOG_PATH = DATA_DIR / "chrome_start.log"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
GOIANIA_PORTAL_CPF = os.getenv("GOIANIA_PORTAL_CPF", "")
GOIANIA_PORTAL_PASSWORD = os.getenv("GOIANIA_PORTAL_PASSWORD", "")
PLAYWRIGHT_USER_DATA_DIR = os.getenv("PLAYWRIGHT_USER_DATA_DIR", str(BASE_DIR / ".playwright-profile"))

ROBOT_TECHNICAL_ID = "goiania_taxas_impostos"
ROBOT_DISPLAY_NAME_DEFAULT = "Taxas e Impostos Goiania"
ROBOT_SEGMENT_PATH_DEFAULT = "PARALEGAL/TAXAS-IMPOSTOS"
LOGIN_URL = "https://www10.goiania.go.gov.br/Internet/Login.aspx?OriginalURL="
INTERNET_HOME_URL = "https://www10.goiania.go.gov.br/Internet/"
HOME_URL = "https://servicos.goiania.go.gov.br/SicaePortal/"
PORTAL_TRIBUTOS_URL_PART = "PortalTributos/ConsultaTributos"
DEBITOS_URL_PART = "MostraDebitos"


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def normalize_name(value: str | None) -> str:
    base = re.sub(r"[^A-Z0-9 ]", " ", (value or "").upper())
    for token in [" LTDA", " EIRELI", " ME", " EPP", " S A", " SA", " SERVICOS", " SERVIÇOS"]:
        base = base.replace(token, " ")
    return " ".join(base.split())


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


def find_icon_path(*names: str) -> Path | None:
    candidates: list[Path] = []
    for name in names:
        raw = name.strip()
        if not raw:
            continue
        normalized = raw.lower().replace(" ", "_")
        for folder in (ICO_DIR, PNG_DIR):
            candidates.append(folder / raw)
            candidates.append(folder / normalized)
            candidates.append(folder / f"{raw}.png")
            candidates.append(folder / f"{normalized}.png")
            candidates.append(folder / f"{raw}.ico")
            candidates.append(folder / f"{normalized}.ico")
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def qicon(*names: str) -> QIcon | None:
    path = find_icon_path(*names)
    if not path:
        return None
    return QIcon(str(path))


def button_style(base: str, hover: str, pressed: str) -> str:
    return f"""
    QPushButton {{
        font: 9pt 'Verdana';
        font-weight: bold;
        color: #E8F4FF;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.12);
        background: qlineargradient(x1:0,y1:0, x2:1,y2:1,
            stop:0 {base}, stop:1 #0F1E35);
    }}
    QPushButton:hover {{
        background: qlineargradient(x1:0,y1:0, x2:1,y2:1,
            stop:0 {hover}, stop:1 #12304E);
    }}
    QPushButton:pressed {{
        background: {pressed};
    }}
    QPushButton:disabled {{
        color: #9CA3AF;
        background: #243041;
    }}
    """


@dataclass
class CompanyItem:
    id: str
    name: str
    document: str | None
    active: bool
    enabled_for_robot: bool
    selected: bool = False
    status: str = "AGUARDANDO"
    message: str = "-"


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


class StopRequested(RuntimeError):
    pass


class RobotBackend:
    def __init__(self) -> None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError("SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidos no .env do robô.")
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        self.playwright = None
        self.browser = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self.chrome_proc: subprocess.Popen | None = None
        self.robot_id = self.register_robot()

    def fetch_companies(self) -> list[CompanyItem]:
        response = (
            self.supabase.table("companies")
            .select("id,name,document,active,company_robot_config(enabled,robot_technical_id)")
            .order("name")
            .execute()
        )
        companies: list[CompanyItem] = []
        for row in response.data or []:
            configs = row.get("company_robot_config") or []
            explicit_config = any(config.get("robot_technical_id") == ROBOT_TECHNICAL_ID for config in configs)
            enabled = any(
                config.get("robot_technical_id") == ROBOT_TECHNICAL_ID and config.get("enabled") is True
                for config in configs
            )
            if not explicit_config:
                enabled = bool(row.get("active", True))
            companies.append(
                CompanyItem(
                    id=row["id"],
                    name=row["name"],
                    document=row.get("document"),
                    active=bool(row.get("active", True)),
                    enabled_for_robot=enabled,
                    status="ATIVO" if row.get("active", True) else "INATIVO",
                )
            )
        return companies

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

    def register_robot(self) -> str | None:
        try:
            response = self.supabase.table("robots").select("id").eq("technical_id", ROBOT_TECHNICAL_ID).limit(1).execute()
            rows = response.data or []
            payload = {
                "technical_id": ROBOT_TECHNICAL_ID,
                "display_name": ROBOT_DISPLAY_NAME_DEFAULT,
                "segment_path": ROBOT_SEGMENT_PATH_DEFAULT,
                "status": "active",
                "last_heartbeat_at": utc_now_iso(),
            }
            if rows:
                robot_id = rows[0]["id"]
                self.supabase.table("robots").update(
                    {
                        "display_name": ROBOT_DISPLAY_NAME_DEFAULT,
                        "segment_path": ROBOT_SEGMENT_PATH_DEFAULT,
                        "status": "active",
                        "last_heartbeat_at": utc_now_iso(),
                    }
                ).eq("id", robot_id).execute()
                return robot_id

            insert_response = self.supabase.table("robots").insert(payload).select("id").execute()
            insert_rows = insert_response.data or []
            return insert_rows[0]["id"] if insert_rows else None
        except Exception:
            return None

    def update_robot_status(self, status: str) -> None:
        if not self.robot_id:
            return
        try:
            self.supabase.table("robots").update(
                {
                    "status": status,
                    "last_heartbeat_at": utc_now_iso(),
                }
            ).eq("id", self.robot_id).execute()
        except Exception:
            pass

    def update_robot_heartbeat(self) -> None:
        if not self.robot_id:
            return
        try:
            self.supabase.table("robots").update({"last_heartbeat_at": utc_now_iso()}).eq("id", self.robot_id).execute()
        except Exception:
            pass

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

    def sync_company_debts(self, company: CompanyItem, debts: list[DebtRow]) -> int:
        try:
            self.supabase.table("municipal_tax_debts").delete().eq("company_id", company.id).execute()
        except Exception:
            pass

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
        if not payload:
            return 0

        inserted = self.supabase.table("municipal_tax_debts").insert(payload).select("id").execute()
        rows = inserted.data or []
        if len(rows) != len(payload):
            verify = self.supabase.table("municipal_tax_debts").select("id").eq("company_id", company.id).execute()
            stored_rows = verify.data or []
            if len(stored_rows) != len(payload):
                raise RuntimeError(
                    f"Supabase nao confirmou a gravacao dos debitos de {company.name}. "
                    f"Esperado: {len(payload)}, confirmado: {len(stored_rows)}"
                )
            return len(stored_rows)
        return len(rows)

    async def ensure_browser(self) -> None:
        if self.page:
            return
        chrome_exe = self._resolve_chrome_exe()
        if not chrome_exe.exists():
            raise FileNotFoundError(f"Chrome nao encontrado em: {chrome_exe}")

        self._kill_automation_chrome()
        CHROME_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        try:
            devtools_port = CHROME_PROFILE_DIR / "DevToolsActivePort"
            if devtools_port.exists():
                devtools_port.unlink()
        except Exception:
            pass

        chrome_cmd = [
            str(chrome_exe),
            f"--remote-debugging-port={CDP_PORT}",
            f"--user-data-dir={CHROME_PROFILE_DIR}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-gpu",
            "--start-maximized",
        ]
        CHROME_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CHROME_LOG_PATH, "w", encoding="utf-8", errors="replace") as chrome_log:
            chrome_log.write(
                "=== Chrome bootstrap ===\n"
                f"EXE: {chrome_exe}\n"
                f"PROFILE_DIR: {CHROME_PROFILE_DIR}\n"
                f"CDP_PORT: {CDP_PORT}\n"
                f"CMD: {' '.join(chrome_cmd)}\n\n"
            )
            self.chrome_proc = subprocess.Popen(
                chrome_cmd,
                stdout=chrome_log,
                stderr=subprocess.STDOUT,
                cwd=str(chrome_exe.parent),
                shell=False,
            )

        await self._wait_for_cdp()
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{CDP_PORT}")
        self.context = self.browser.contexts[0] if self.browser.contexts else await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1440, "height": 960},
        )
        self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()
        self.page.set_default_timeout(90000)
        self.context.set_default_navigation_timeout(90000)

    async def close(self) -> None:
        if self.browser:
            try:
                await self.browser.close()
            except Exception:
                pass
        elif self.context:
            try:
                await self.context.close()
            except Exception:
                pass
        if self.playwright:
            await self.playwright.stop()
        self._kill_automation_chrome()
        self.chrome_proc = None
        self.browser = None
        self.context = None
        self.page = None
        self.playwright = None

    def _resolve_chrome_exe(self) -> Path:
        candidates = [
            CHROME_EXE,
            PLAYWRIGHT_DIR / "chromium-1208" / "chrome-win64" / "chrome.exe",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        try:
            for candidate in PLAYWRIGHT_DIR.glob("chromium-*/chrome-win64/chrome.exe"):
                if candidate.exists():
                    return candidate
        except Exception:
            pass
        return CHROME_EXE

    async def _wait_for_cdp(self, timeout_seconds: int = 30) -> None:
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while asyncio.get_running_loop().time() < deadline:
            if self.chrome_proc and self.chrome_proc.poll() not in (None, 0):
                raise RuntimeError(
                    f"Chrome finalizou com codigo {self.chrome_proc.returncode}. Consulte o log em {CHROME_LOG_PATH}"
                )
            try:
                with socket.create_connection(("127.0.0.1", CDP_PORT), timeout=1):
                    return
            except OSError:
                await asyncio.sleep(0.5)
        raise RuntimeError(f"Nao foi possivel conectar ao Chrome via CDP na porta {CDP_PORT}.")

    def _kill_automation_chrome(self) -> None:
        proc = self.chrome_proc
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        if os.name != "nt":
            return
        try:
            chrome_exe = os.path.normcase(str(self._resolve_chrome_exe().resolve()))
            profile_dir = os.path.normcase(str(CHROME_PROFILE_DIR.resolve()))
            result = subprocess.run(
                ["wmic", "process", "where", "name='chrome.exe'", "get", "ProcessId,ExecutablePath,CommandLine", "/format:csv"],
                capture_output=True,
                text=True,
                check=False,
            )
            pids: list[str] = []
            for line in (result.stdout or "").splitlines():
                parts = [part.strip() for part in line.split(",")]
                if len(parts) < 4:
                    continue
                pid = parts[-1]
                command_line = ",".join(parts[:-1]).lower()
                if chrome_exe.lower() in command_line or profile_dir.lower() in command_line:
                    if pid.isdigit():
                        pids.append(pid)
            if pids:
                subprocess.run(["taskkill", "/F", "/PID", *pids], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    async def ensure_login(self, log: callable | None = None) -> None:
        await self.ensure_browser()
        assert self.page is not None

        if self.page.url.startswith(HOME_URL):
            return

        await self.page.goto(LOGIN_URL, wait_until="domcontentloaded")
        if log:
            log("Abrindo login do portal da Prefeitura de Goiânia.")

        if self.page.url.startswith(INTERNET_HOME_URL):
            await self._open_portal_do_contribuinte()

        if await self._is_login_form_visible():
            if not GOIANIA_PORTAL_CPF or not GOIANIA_PORTAL_PASSWORD:
                raise RuntimeError("GOIANIA_PORTAL_CPF e GOIANIA_PORTAL_PASSWORD precisam estar definidos.")
            await self._submit_login_form()
            await self.page.wait_for_load_state("networkidle")
            if self.page.url.startswith(INTERNET_HOME_URL):
                await self._open_portal_do_contribuinte()

        if "Intranet/Login.aspx" in self.page.url or await self._is_login_form_visible():
            await self._submit_login_form()
            await self.page.wait_for_load_state("networkidle")

        if self.page.url.startswith(INTERNET_HOME_URL):
            await self._open_portal_do_contribuinte()

        if not self.page.url.startswith(HOME_URL):
            raise RuntimeError(f"Login não concluído no portal. URL atual: {self.page.url}")

    async def _open_portal_do_contribuinte(self) -> None:
        assert self.page is not None
        link = self.page.get_by_role("link", name=re.compile("Portal do Contribuinte", re.I))
        if await link.count():
            await link.first.click()
            await self.page.wait_for_load_state("networkidle")

    async def _is_login_form_visible(self) -> bool:
        assert self.page is not None
        for locator in [
            self.page.get_by_placeholder("Informe o CPF"),
            self.page.locator("input[placeholder='Informe o CPF']"),
            self.page.locator("input[id*='wtLoginInput']").first,
            self.page.locator("input[type='password']").first,
        ]:
            try:
                target = locator.first
                if await target.count() and await target.is_visible():
                    return True
            except Exception:
                continue
        return False

    async def _submit_login_form(self) -> None:
        assert self.page is not None
        cpf_input = self.page.locator("input[placeholder='Informe o CPF'], input[id*='wtLoginInput']").first
        password_input = self.page.locator("input[type='password'], input[id*='wtPasswordInput']").first
        await cpf_input.fill(GOIANIA_PORTAL_CPF)
        await password_input.fill(GOIANIA_PORTAL_PASSWORD)
        keep_connected = self.page.get_by_label("Mantenha-me Conectado")
        try:
            if await keep_connected.count():
                await keep_connected.check()
        except Exception:
            pass
        for locator in [
            self.page.get_by_role("button", name=re.compile("Entrar", re.I)),
            self.page.locator("button:has-text('ENTRAR')").first,
            self.page.locator("input[type='submit']").first,
        ]:
            try:
                target = locator.first
                if await target.count() and await target.is_visible():
                    await target.click()
                    return
            except Exception:
                continue
        raise RuntimeError("Botão Entrar não encontrado na tela de login.")

    async def collect_company_debts(
        self,
        company: CompanyItem,
        stop_cb: callable,
        log: callable,
        status_cb: callable,
    ) -> list[DebtRow]:
        await self.ensure_login(log)
        stop_cb()
        status_cb("EXECUTANDO", "Selecionando empresa no PERFIL")
        await self.select_company(company)
        stop_cb()
        status_cb("EXECUTANDO", "Abrindo Pessoa Jurídica - Atividade Econômica > Taxas e Impostos")
        frame = await self.open_duam(company)
        stop_cb()
        status_cb("AGUARDANDO RECAPTCHA", "Tentando clicar no reCAPTCHA; conclua manualmente se o site exigir")
        await self.try_click_recaptcha()
        await self.wait_recaptcha_manual(stop_cb)
        stop_cb()
        status_cb("EXECUTANDO", "Consultando débitos municipais")
        debts = await self.extract_debts(frame, company, stop_cb)
        log(f"{company.name}: {len(debts)} débito(s) capturado(s) no portal.")
        return debts

    async def select_company(self, company: CompanyItem) -> None:
        assert self.page is not None
        select = self.page.locator("select").first
        await select.wait_for(timeout=20000)
        options = await select.locator("option").evaluate_all(
            "(nodes) => nodes.map((node) => ({ value: node.value, text: (node.textContent || '').trim() }))"
        )
        target_value = None
        company_name = normalize_name(company.name)
        company_document = digits(company.document)
        for option in options:
            option_text = normalize_name(option["text"])
            if (
                (company_name and company_name in option_text)
                or (option_text and option_text in company_name)
                or (company_document and company_document in digits(option["text"]))
            ):
                target_value = option["value"]
                break
        if not target_value:
            raise RuntimeError(f"Empresa não localizada no seletor PERFIL: {company.name}")
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

    async def open_duam(self, company: CompanyItem) -> Frame:
        assert self.page is not None
        await self._ensure_activity_context()

        popup = await self._click_tax_tile()
        if popup:
            self.page = popup
            await self.page.wait_for_load_state("networkidle")

        for _ in range(30):
            frame = self._find_tributos_frame(self.page)
            if frame:
                body = await frame.locator("body").inner_text()
                if "DUAM" in body or "Consulta e Emissão de Guia" in body or "Consulta e Emissao de Guia" in body:
                    return frame
            if DEBITOS_URL_PART.lower() in self.page.url.lower():
                return self.page.main_frame
            await asyncio.sleep(1)

        details = await self._debug_taxas_state(company)
        raise RuntimeError(
            "Não foi possível abrir a tela de Taxas e Impostos. "
            f"URL atual: {self.page.url}. Diagnóstico: {details}"
        )

    async def _ensure_activity_context(self) -> None:
        assert self.page is not None
        context_candidates = [
            self.page.get_by_text(re.compile(r"Pessoa Jur.*Atividade Econ", re.I)).first,
            self.page.locator("a[href*='MostraDebitos.aspx']").filter(
                has_text=re.compile("Taxas e Impostos", re.I)
            ).first,
            self.page.locator(".Tabs__content.active a[href*='MostraDebitos.aspx']").filter(
                has_text=re.compile("Taxas e Impostos", re.I)
            ).first,
            self.page.locator(".PH.Tabs__content.active a[href*='MostraDebitos.aspx']").filter(
                has_text=re.compile("Taxas e Impostos", re.I)
            ).first,
        ]
        for _ in range(10):
            for locator in context_candidates:
                try:
                    if await locator.count() and await locator.is_visible():
                        return
                except Exception:
                    continue
            await asyncio.sleep(1)

        visible_groups = await self.page.evaluate(
            """() =>
                Array.from(document.querySelectorAll('div, span, a'))
                    .map((el) => ({
                        text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
                        id: el.id || '',
                        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
                    }))
                    .filter((item) => item.visible && (
                        /Pessoa Jur/i.test(item.text) ||
                        /Atividade Econ/i.test(item.text) ||
                        /Financeiro/i.test(item.text) ||
                        /Taxas e Impostos/i.test(item.text)
                    ))
                    .slice(0, 20)
            """
        )
        raise RuntimeError(
            "O contexto de Pessoa Juridica - Atividade Economica nao ficou disponivel apos selecionar a empresa. "
            f"Elementos visiveis: {visible_groups}"
        )

    async def _click_tax_tile(self) -> Page | None:
        assert self.page is not None
        popup_task = asyncio.create_task(self.page.wait_for_event("popup", timeout=5000))
        candidates = [
            self.page.locator("a[href*='MostraDebitos.aspx']").filter(
                has_text=re.compile("Taxas e Impostos", re.I)
            ),
            self.page.locator(".Tabs__content.active a[href*='MostraDebitos.aspx']").filter(
                has_text=re.compile("Taxas e Impostos", re.I)
            ),
            self.page.locator(".PH.Tabs__content.active a[href*='MostraDebitos.aspx']").filter(
                has_text=re.compile("Taxas e Impostos", re.I)
            ),
        ]
        clicked = False
        for locator in candidates:
            try:
                target = locator.first
                if await locator.count() == 0:
                    continue
                await target.wait_for(state="visible", timeout=3000)
                await target.click(force=True, timeout=3000)
                clicked = True
                break
            except Exception:
                continue

        if not clicked:
            popup_task.cancel()
            active_links = await self.page.evaluate(
                """() =>
                    Array.from(
                        document.querySelectorAll(
                            '.Tabs__content.active a, .PH.Tabs__content.active a'
                        )
                    )
                        .map((el) => ({
                            id: el.id || '',
                            text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
                            href: el.getAttribute('href') || '',
                            visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
                        }))
                        .filter((item) => item.visible)
                        .slice(0, 20)
                """
            )
            raise RuntimeError(
                "Tile de Taxas e Impostos do bloco Financeiro nÃ£o encontrado na aba ativa. "
                f"Links visÃ­veis: {active_links}"
            )
            raise RuntimeError("Tile de Taxas e Impostos não encontrado.")

        await asyncio.sleep(2)
        if popup_task.done():
            try:
                popup = popup_task.result()
            except Exception:
                popup = None
            if popup:
                return popup
        popup_task.cancel()
        return None

    def _find_tributos_frame(self, current_page: Page) -> Frame | None:
        for frame in current_page.frames:
            if PORTAL_TRIBUTOS_URL_PART.lower() in frame.url.lower():
                return frame
        return None

    async def _debug_taxas_state(self, company: CompanyItem) -> dict[str, Any]:
        assert self.page is not None
        return await self.page.evaluate(
            """(companyName) => ({
                companyName,
                url: window.location.href,
                frames: window.frames.length,
                visibleTaxItems: Array.from(document.querySelectorAll('span,div,a'))
                    .map((el) => ({
                        id: el.id,
                        text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
                        width: el.getBoundingClientRect().width,
                        height: el.getBoundingClientRect().height
                    }))
                    .filter((item) => /Taxas e Impostos/i.test(item.text) && (item.width || item.height))
                    .slice(-5)
            })""",
            company.name,
        )

    async def try_click_recaptcha(self) -> None:
        assert self.page is not None
        for _ in range(20):
            for frame in self.page.frames:
                if "recaptcha/api2/anchor" not in frame.url:
                    continue
                try:
                    anchor = frame.locator("#recaptcha-anchor")
                    if await anchor.count() == 0:
                        continue
                    checked = await anchor.get_attribute("aria-checked")
                    if checked == "true":
                        return
                    await anchor.click(force=True, timeout=3000)
                    await asyncio.sleep(2)
                    checked = await anchor.get_attribute("aria-checked")
                    if checked == "true":
                        return
                except Exception:
                    continue
            await asyncio.sleep(1)

    async def wait_recaptcha_manual(self, stop_cb: callable) -> None:
        assert self.page is not None
        for _ in range(240):
            stop_cb()
            for frame in self.page.frames:
                if "recaptcha/api2/anchor" in frame.url:
                    checked = await frame.locator("#recaptcha-anchor").get_attribute("aria-checked")
                    if checked == "true":
                        return
            await asyncio.sleep(1)
        raise RuntimeError("reCAPTCHA não foi concluído a tempo.")

    async def extract_debts(self, frame: Frame, company: CompanyItem, stop_cb: callable) -> list[DebtRow]:
        if frame != self.page.main_frame:
            await frame.get_by_role("button", name=re.compile("Consultar", re.I)).click()

        for _ in range(90):
            stop_cb()
            body = await frame.locator("body").inner_text()
            if "Nenhum débito" in body or "Nenhum debito" in body:
                return []
            if await frame.locator("table").count():
                break
            await asyncio.sleep(1)

        table = frame.locator("table").filter(
            has_text=re.compile("Vencimento|Documento|Tributo|Situação|Situacao|Rubrica|Processo", re.I)
        ).first
        await table.wait_for(timeout=20000)

        headers = [text.strip().lower() for text in await table.locator("thead th, tr th").all_text_contents()]
        rows = await table.locator("tbody tr, tr").all()
        debts: list[DebtRow] = []
        for row in rows:
            cells = [text.strip() for text in await row.locator("td").all_text_contents()]
            if not cells:
                continue
            mapped: dict[str, Any] = {
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
                    mapped["ano"] = cell
                elif "rubrica" in header or "tribut" in header:
                    mapped["tributo"] = cell
                elif "document" in header or "processo" in header or "número" in header or "numero" in header:
                    mapped["numero_documento"] = cell
                elif "venc" in header:
                    mapped["data_vencimento"] = cell
                elif "valor" in header:
                    mapped["valor"] = cell
                elif "situ" in header:
                    mapped["situacao"] = cell
                elif "inscri" in header:
                    mapped["inscricao"] = cell
                elif "cai" in header:
                    mapped["cai"] = cell
            if not mapped["tributo"] and len(cells) >= 2:
                mapped["tributo"] = cells[1]
            if not mapped["numero_documento"] and len(cells) >= 3:
                mapped["numero_documento"] = cells[2]
            if not mapped["tributo"] and not mapped["numero_documento"]:
                continue
            debts.append(
                DebtRow(
                    ano=int(mapped["ano"]) if str(mapped["ano"]).isdigit() else None,
                    tributo=mapped["tributo"] or "Tributo não identificado",
                    numero_documento=mapped["numero_documento"] or f"{company.id}-{len(debts) + 1}",
                    data_vencimento=parse_date(mapped["data_vencimento"]),
                    valor=parse_money(mapped["valor"]),
                    situacao=mapped["situacao"],
                    portal_inscricao=mapped["inscricao"],
                    portal_cai=mapped["cai"] or digits(company.document),
                    detalhes={"linha_portal": mapped},
                )
            )
        return debts


class RobotWorker(QThread):
    status_changed = Signal(str)
    log_message = Signal(str)
    company_changed = Signal(str, str, str)

    def __init__(self, backend: RobotBackend, companies: list[CompanyItem]) -> None:
        super().__init__()
        self.backend = backend
        self.companies = companies
        self._stop_requested = False

    def request_stop(self) -> None:
        self._stop_requested = True

    def assert_not_stopped(self) -> None:
        if self._stop_requested:
            raise StopRequested("Execução interrompida manualmente.")

    def run(self) -> None:
        asyncio.run(self._run())

    async def _run(self) -> None:
        self.status_changed.emit("EXECUTANDO")
        self.backend.update_robot_status("processing")
        try:
            await self.backend.ensure_login(self.log_message.emit)
            self.backend.update_robot_heartbeat()
            self.log_message.emit("Login validado no portal da Prefeitura de Goiânia.")
            for company in self.companies:
                self.assert_not_stopped()
                self.backend.update_robot_heartbeat()
                run_id = self.backend.create_run(company)
                try:
                    debts = await self.backend.collect_company_debts(
                        company,
                        self.assert_not_stopped,
                        self.log_message.emit,
                        lambda status, message, company_id=company.id: self.company_changed.emit(company_id, status, message),
                    )
                    synced_count = self.backend.sync_company_debts(company, debts)
                    self.backend.finish_run(run_id, "completed", debts_found=synced_count)
                    self.company_changed.emit(company.id, "CONCLUIDO", f"{synced_count} débito(s) sincronizado(s)")
                except StopRequested as exc:
                    self.backend.finish_run(run_id, "failed", error_message=str(exc))
                    self.company_changed.emit(company.id, "PARADO", str(exc))
                    self.log_message.emit(str(exc))
                    break
                except Exception as exc:
                    self.backend.finish_run(run_id, "failed", error_message=str(exc))
                    self.company_changed.emit(company.id, "ERRO", str(exc))
                    self.log_message.emit(f"{company.name}: erro - {exc}")
        finally:
            self.status_changed.emit("AGUARDANDO")
            self.backend.update_robot_status("active")
            await self.backend.close()


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.backend = RobotBackend()
        self.all_companies: list[CompanyItem] = []
        self.filtered_companies: list[CompanyItem] = []
        self.checkboxes: dict[str, QCheckBox] = {}
        self.worker: RobotWorker | None = None
        self.setWindowTitle("Robô Goiânia - Taxas e Impostos")
        self.resize(980, 760)
        icon = qicon("app.ico", "logo.png")
        if icon:
            self.setWindowIcon(icon)
        self._build_ui()
        self.sync_companies()

    def _build_ui(self) -> None:
        self.setStyleSheet(
            """
            QMainWindow { background:qlineargradient(x1:0,y1:0, x2:1,y2:1, stop:0 #0f1722, stop:1 #111827); }
            QWidget { color:#ECF0F1; }
            QLabel { font-weight:bold; font:9pt 'Verdana'; }
            QTableWidget {
                background: rgba(17,23,39,0.88);
                border: 1px solid #22344a;
                border-radius: 10px;
                gridline-color: #1f2937;
                alternate-background-color: #0f1627;
            }
            QHeaderView::section {
                background: #172033;
                color: #94a3b8;
                border: none;
                padding: 8px;
                font: 9pt 'Verdana';
                font-weight: bold;
            }
            QLineEdit, QTextEdit {
                background:#34495E;
                color:#ECF0F1;
                border-radius:6px;
                padding:6px;
                font:9pt 'Verdana';
                border: 1px solid #22344a;
            }
            QTextEdit {
                font: 10pt 'Consolas';
                padding: 10px;
            }
            QCheckBox::indicator {
                width: 18px;
                height: 18px;
                border-radius: 6px;
                border: 1px solid #334155;
                background: #0b1220;
            }
            QCheckBox::indicator:checked {
                background: #2563eb;
                border: 1px solid #2563eb;
            }
            """
        )

        central = QWidget()
        layout = QVBoxLayout(central)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(8)

        top = QFrame()
        top.setStyleSheet(
            "background:qlineargradient(x1:0,y1:0, x2:1,y2:0, stop:0 #1f2f46, stop:1 #2f3f5b);"
            "border-radius:10px; border:1px solid #22344a;"
        )
        top_layout = QHBoxLayout(top)
        self.title_label = QLabel("Robô Goiânia - Taxas e Impostos")
        self.title_label.setStyleSheet("color:#ECF0F1; font:12pt 'Verdana'; font-weight:bold;")
        top_layout.addWidget(self.title_label, alignment=Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(top)

        controls = QVBoxLayout()
        first_row = QHBoxLayout()
        self.search = QLineEdit()
        self.search.setPlaceholderText("Pesquisar empresa...")
        self.search.textChanged.connect(self.apply_filter)
        first_row.addWidget(self.search, 1)

        self.btn_select_all = QPushButton("Marcar todas")
        self.btn_select_all.setStyleSheet(button_style("#2980B9", "#3498DB", "#2471A3"))
        select_icon = qicon("selecionar")
        if select_icon:
            self.btn_select_all.setIcon(select_icon)
        self.btn_select_all.clicked.connect(self.select_all_visible)
        first_row.addWidget(self.btn_select_all)

        self.btn_deselect_all = QPushButton("Desmarcar")
        self.btn_deselect_all.setStyleSheet(button_style("#7F8C8D", "#95A5A6", "#626E70"))
        deselect_icon = qicon("desmarcar-cancelar", "excluir")
        if deselect_icon:
            self.btn_deselect_all.setIcon(deselect_icon)
        self.btn_deselect_all.clicked.connect(self.deselect_all_visible)
        first_row.addWidget(self.btn_deselect_all)
        controls.addLayout(first_row)
        layout.addLayout(controls)

        wrap = QFrame()
        wrap.setStyleSheet("background:rgba(17,23,39,0.85);border:1px solid #22344a;border-radius:10px;")
        wrap_layout = QVBoxLayout(wrap)
        wrap_layout.setContentsMargins(5, 5, 5, 5)

        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Selecionar", "Empresa", "Documento", "Status", "Mensagem"])
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setShowGrid(False)
        self.table.setAlternatingRowColors(True)
        self.table.setSelectionMode(QTableWidget.SelectionMode.NoSelection)
        self.table.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        wrap_layout.addWidget(self.table)
        layout.addWidget(wrap, 3)

        log_label = QLabel("Log de execução")
        log_label.setFont(QFont("Verdana", 10, QFont.Weight.Bold))
        layout.addWidget(log_label)
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setMinimumHeight(180)
        layout.addWidget(self.log_box, 2)

        bottom = QHBoxLayout()
        self.btn_start = QPushButton("Iniciar downloads")
        self.btn_start.setStyleSheet(button_style("#27AE60", "#2ECC71", "#1E8449"))
        start_icon = qicon("iniciar")
        if start_icon:
            self.btn_start.setIcon(start_icon)
        self.btn_start.clicked.connect(self.start_execution)

        self.btn_stop = QPushButton("Parar")
        self.btn_stop.setStyleSheet(button_style("#C0392B", "#E74C3C", "#922B21"))
        stop_icon = qicon("parar")
        if stop_icon:
            self.btn_stop.setIcon(stop_icon)
        self.btn_stop.setEnabled(False)
        self.btn_stop.clicked.connect(self.stop_execution)

        self.btn_clear = QPushButton("Limpar log")
        self.btn_clear.setStyleSheet(button_style("#1ABC9C", "#16A085", "#117A65"))
        clear_icon = qicon("limpar")
        if clear_icon:
            self.btn_clear.setIcon(clear_icon)
        self.btn_clear.clicked.connect(self.log_box.clear)

        bottom.addWidget(self.btn_start)
        bottom.addWidget(self.btn_stop)
        bottom.addWidget(self.btn_clear)
        layout.addLayout(bottom)

        self.setCentralWidget(central)

    def _stat_card(self, title: str, value: str) -> tuple[QFrame, QLabel]:
        frame = QFrame()
        frame.setStyleSheet("QFrame { background: #111827; border: 1px solid #1f2937; border-radius: 16px; }")
        frame.setMinimumHeight(88)
        grid = QGridLayout(frame)
        title_label = QLabel(title)
        title_label.setStyleSheet("color: #94a3b8; font-size: 12px;")
        value_label = QLabel(value)
        value_label.setFont(QFont("Verdana", 14, QFont.Weight.Bold))
        grid.addWidget(title_label, 0, 0)
        grid.addWidget(value_label, 1, 0)
        return frame, value_label

    def sync_companies(self) -> None:
        try:
            selection = {company.id: company.selected for company in self.all_companies}
            self.all_companies = self.backend.fetch_companies()
            for company in self.all_companies:
                company.selected = selection.get(company.id, False)
            self.apply_filter()
            self.append_log("Empresas sincronizadas do Supabase.")
        except Exception as exc:
            QMessageBox.critical(self, "Erro", str(exc))

    def apply_filter(self) -> None:
        query = self.search.text().strip().lower()
        if not query:
            self.filtered_companies = list(self.all_companies)
        else:
            self.filtered_companies = [
                company
                for company in self.all_companies
                if query in company.name.lower() or query in (company.document or "").lower()
            ]
        self.populate_table()

    def populate_table(self) -> None:
        self.table.setRowCount(len(self.filtered_companies))
        self.checkboxes.clear()
        for row, company in enumerate(self.filtered_companies):
            checkbox = QCheckBox()
            checkbox.setChecked(company.selected)
            checkbox.setEnabled(company.active)
            checkbox.stateChanged.connect(lambda state, company_id=company.id: self.toggle_company(company_id, state))
            self.checkboxes[company.id] = checkbox
            self.table.setCellWidget(row, 0, checkbox)
            self.table.setItem(row, 1, QTableWidgetItem(company.name))
            self.table.setItem(row, 2, QTableWidgetItem(company.document or "-"))
            self.table.setItem(row, 3, self._status_item(company.status))
            self.table.setItem(row, 4, QTableWidgetItem(company.message))
        self.table.resizeColumnsToContents()

    def toggle_company(self, company_id: str, state: int) -> None:
        for company in self.all_companies:
            if company.id == company_id:
                company.selected = state == Qt.CheckState.Checked.value
                break

    def select_all_visible(self) -> None:
        for company in self.filtered_companies:
            if company.active:
                company.selected = True
        self.populate_table()

    def deselect_all_visible(self) -> None:
        for company in self.filtered_companies:
            company.selected = False
        self.populate_table()

    def _status_item(self, text: str) -> QTableWidgetItem:
        item = QTableWidgetItem(text)
        upper = text.upper()
        if "ERRO" in upper:
            item.setForeground(QColor("#fb7185"))
        elif "CONCLUIDO" in upper:
            item.setForeground(QColor("#34d399"))
        elif "EXECUTANDO" in upper or "AGUARDANDO" in upper:
            item.setForeground(QColor("#60a5fa"))
        elif "PARADO" in upper:
            item.setForeground(QColor("#fbbf24"))
        else:
            item.setForeground(QColor("#cbd5e1"))
        return item

    def update_company_state(self, company_id: str, status: str, message: str) -> None:
        for company in self.all_companies:
            if company.id == company_id:
                company.status = status
                company.message = message or "-"
                break
        self.populate_table()

    def set_global_status(self, status: str) -> None:
        self.title_label.setText(f"Robô Goiânia - Taxas e Impostos [{status}]")

    def append_log(self, message: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_box.append(f"[{timestamp}] {message}")

    def start_execution(self) -> None:
        selected = [company for company in self.all_companies if company.selected and company.active]
        if not selected:
            QMessageBox.information(self, "Seleção", "Selecione ao menos uma empresa ativa.")
            return
        self.worker = RobotWorker(self.backend, selected)
        self.worker.status_changed.connect(self.set_global_status)
        self.worker.log_message.connect(self.append_log)
        self.worker.company_changed.connect(self.update_company_state)
        self.worker.finished.connect(self.execution_finished)
        self.btn_start.setEnabled(False)
        self.btn_stop.setEnabled(True)
        self.worker.start()
        self.append_log(f"Iniciando coleta para {len(selected)} empresa(s).")

    def stop_execution(self) -> None:
        if self.worker and self.worker.isRunning():
            self.worker.request_stop()
            self.append_log("Parada solicitada. O robô vai interromper na próxima etapa segura.")
            self.btn_stop.setEnabled(False)

    def execution_finished(self) -> None:
        self.btn_start.setEnabled(True)
        self.btn_stop.setEnabled(False)
        self.append_log("Execução finalizada.")
        self.worker = None

    def closeEvent(self, event) -> None:  # type: ignore[override]
        self.backend.update_robot_status("inactive")
        super().closeEvent(event)


def sync_local_resources() -> None:
    source = BASE_DIR.parent.parent / "nfs" / "NFs Padrao" / "data"
    if not source.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
    elif not DATA_DIR.exists():
        shutil.copytree(source, DATA_DIR)
    if PLAYWRIGHT_DIR.exists():
        shutil.rmtree(PLAYWRIGHT_DIR, ignore_errors=True)
    chrome_target = DATA_DIR / "Chrome"
    chrome_sources = [
        BASE_DIR.parent.parent.parent / "fiscal" / "nfe-nfc" / "Sefaz Xml" / "data" / "Chrome",
        BASE_DIR.parent.parent.parent / "fiscal" / "Certidoes" / "Certidao Estadual, Federal e FGTS" / "data" / "Chrome",
    ]
    if not chrome_target.exists():
        for chrome_source in chrome_sources:
            if chrome_source.exists():
                shutil.copytree(chrome_source, chrome_target)
                break


def main() -> int:
    sync_local_resources()
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
