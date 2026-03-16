import argparse
import json
import re
import shutil
import socket
import subprocess
import sys
import textwrap
import threading
import time
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from playwright.sync_api import sync_playwright


BASE_DIR = Path(__file__).resolve().parent
CHROME_DIR = BASE_DIR / "Chrome"
CHROME_EXE = CHROME_DIR / "chrome.exe"
PROFILE_DIR = BASE_DIR / "chrome_profile"
CERTIFICATES_PATH = BASE_DIR / "certificates.json"
DEFAULT_CDP_PORT = 9333
DEFAULT_TIMEOUT_MS = 90000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Login no e-CAC via Chrome externo + CDP.")
    parser.add_argument("--pfx-path", help="Caminho do arquivo .pfx")
    parser.add_argument("--pfx-password", help="Senha do .pfx")
    parser.add_argument("--cert-subject", help="Trecho do subject para localizar o certificado correto")
    parser.add_argument("--cert-issuer", default="", help="Trecho opcional do issuer esperado")
    parser.add_argument("--cdp-port", type=int, default=DEFAULT_CDP_PORT, help="Porta do CDP")
    parser.add_argument("--timeout-ms", type=int, default=DEFAULT_TIMEOUT_MS, help="Timeout padrao")
    parser.add_argument("--gui", action="store_true", help="Forca abertura da interface grafica")
    return parser.parse_args()


def run_powershell(script: str, timeout_ms: int = 60000) -> str:
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        check=True,
        timeout=max(1, timeout_ms // 1000),
    )
    return result.stdout.strip()


def ensure_dependencies() -> None:
    if not CHROME_EXE.exists():
        raise FileNotFoundError(f"Chrome nao encontrado em: {CHROME_EXE}")
    if shutil.which("powershell") is None:
        raise RuntimeError("PowerShell nao encontrado no PATH.")


def ensure_pfx_imported(pfx_path: Path, pfx_password: str, cert_subject: str, cert_issuer: str) -> None:
    if not pfx_path.exists():
        raise FileNotFoundError(f"PFX nao encontrado: {pfx_path}")

    script = textwrap.dedent(
        f"""
        $path = '{pfx_path}'
        $password = ConvertTo-SecureString '{pfx_password}' -AsPlainText -Force
        $existing = Get-ChildItem Cert:\\CurrentUser\\My |
            Where-Object {{ $_.Subject -like '*{cert_subject}*' }}
        if (-not $existing) {{
            Import-PfxCertificate -FilePath $path -CertStoreLocation Cert:\\CurrentUser\\My -Password $password | Out-Null
        }}
        $cert = Get-ChildItem Cert:\\CurrentUser\\My |
            Where-Object {{ $_.Subject -like '*{cert_subject}*' }} |
            Select-Object -First 1 Subject, Thumbprint, Issuer
        if (-not $cert) {{
            throw 'Certificado alvo nao encontrado no store CurrentUser\\My.'
        }}
        $cert | ConvertTo-Json -Compress
        """
    )
    cert = json.loads(run_powershell(script))
    if cert_issuer and cert_issuer not in cert["Issuer"]:
        raise RuntimeError(f"Issuer inesperado: {cert['Issuer']}")


def import_pfx_and_get_metadata(pfx_path: Path, pfx_password: str) -> dict:
    if not pfx_path.exists():
        raise FileNotFoundError(f"PFX nao encontrado: {pfx_path}")

    script = textwrap.dedent(
        f"""
        $path = '{pfx_path}'
        $password = ConvertTo-SecureString '{pfx_password}' -AsPlainText -Force
        $cert = Import-PfxCertificate -FilePath $path -CertStoreLocation Cert:\\CurrentUser\\My -Password $password
        if (-not $cert) {{
            throw 'Falha ao importar o certificado.'
        }}
        $selected = $cert | Select-Object -First 1 Subject, Thumbprint, Issuer
        $selected | ConvertTo-Json -Compress
        """
    )
    return json.loads(run_powershell(script))


def ensure_certificate_in_store(cert_subject: str, cert_issuer: str = "") -> None:
    script = textwrap.dedent(
        f"""
        $cert = Get-ChildItem Cert:\\CurrentUser\\My |
            Where-Object {{ $_.Subject -like '*{cert_subject}*' }} |
            Select-Object -First 1 Subject, Thumbprint, Issuer
        if (-not $cert) {{
            throw 'Certificado selecionado nao esta no store CurrentUser\\My.'
        }}
        $cert | ConvertTo-Json -Compress
        """
    )
    cert = json.loads(run_powershell(script))
    if cert_issuer and cert_issuer not in cert["Issuer"]:
        raise RuntimeError(f"Issuer inesperado: {cert['Issuer']}")


def build_selector_candidates(cert_subject: str) -> list[str]:
    candidates: list[str] = []
    raw = (cert_subject or "").strip()
    if raw:
        candidates.append(raw)

    match = re.search(r"CN=([^,]+)", raw, flags=re.IGNORECASE)
    if match:
        cn_value = match.group(1).strip()
        if cn_value and cn_value not in candidates:
            candidates.append(cn_value)

    for item in list(candidates):
        normalized = item.replace("CN=", "").strip()
        if normalized and normalized not in candidates:
            candidates.append(normalized)

    return candidates


def kill_automation_chrome(profile_dir: Path, chrome_exe: Path) -> None:
    script = textwrap.dedent(
        f"""
        $chromeExe = '{chrome_exe}'.ToLower()
        $profileDir = '{profile_dir}'.ToLower()
        $procs = Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'"
        foreach ($proc in $procs) {{
            $cmd = [string]$proc.CommandLine
            if ($cmd.ToLower().Contains($chromeExe) -or $cmd.ToLower().Contains($profileDir)) {{
                try {{ Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop }} catch {{}}
            }}
        }}
        """
    )
    run_powershell(script, timeout_ms=20000)


def wait_for_cdp_port(port: int, timeout_seconds: int = 40) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return
        except OSError:
            time.sleep(0.25)
    raise RuntimeError(f"Chrome com CDP nao respondeu na porta {port}.")


def start_playwright_browser(cdp_port: int):
    kill_automation_chrome(PROFILE_DIR, CHROME_EXE)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    chrome_cmd = [
        str(CHROME_EXE),
        f"--remote-debugging-port={cdp_port}",
        f"--user-data-dir={PROFILE_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-popup-blocking",
        "--start-maximized",
        "--ignore-certificate-errors",
    ]
    chrome_proc = subprocess.Popen(
        chrome_cmd,
        cwd=str(CHROME_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    wait_for_cdp_port(cdp_port)

    playwright = sync_playwright().start()
    browser = playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{cdp_port}")
    context = browser.contexts[0] if browser.contexts else browser.new_context(
        ignore_https_errors=True,
    )
    page = context.pages[0] if context.pages else context.new_page()
    return playwright, browser, context, page, chrome_proc


def select_certificate_dialog(cert_subject: str) -> None:
    selector_candidates = build_selector_candidates(cert_subject)
    powershell_targets = "@(" + ", ".join("'" + c.replace("'", "''") + "'" for c in selector_candidates) + ")"
    script = textwrap.dedent(
        f"""
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Focus {{
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}}
'@

        $targets = {powershell_targets}
        $dialogTitle = 'Selecione um certificado'
        $chromeTitle = 'gov.br - Acesse sua conta - Google Chrome'
        $deadline = (Get-Date).AddSeconds(35)
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $dialog = $null

        while ((Get-Date) -lt $deadline -and -not $dialog) {{
            $condition = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::NameProperty,
                $dialogTitle
            )
            $dialog = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
            if (-not $dialog) {{ Start-Sleep -Milliseconds 250 }}
        }}

        if (-not $dialog) {{
            throw 'Janela de selecao de certificado nao apareceu.'
        }}

        $handle = [IntPtr]$dialog.Current.NativeWindowHandle
        [Win32Focus]::ShowWindow($handle, 5) | Out-Null
        [Win32Focus]::SetForegroundWindow($handle) | Out-Null
        Start-Sleep -Milliseconds 250

        $ws = New-Object -ComObject WScript.Shell
        $mouseDown = 0x0002
        $mouseUp = 0x0004

        function Click-Point([int]$x, [int]$y) {{
            [Win32Focus]::SetCursorPos($x, $y) | Out-Null
            Start-Sleep -Milliseconds 80
            [Win32Focus]::mouse_event($mouseDown, 0, 0, 0, [UIntPtr]::Zero)
            Start-Sleep -Milliseconds 50
            [Win32Focus]::mouse_event($mouseUp, 0, 0, 0, [UIntPtr]::Zero)
            Start-Sleep -Milliseconds 120
        }}

        $chromeCond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::NameProperty,
            $chromeTitle
        )
        $chromeWin = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $chromeCond)
        if (-not $chromeWin) {{
            throw 'Janela principal do Chrome nao encontrada.'
        }}
        $chromeHandle = [IntPtr]$chromeWin.Current.NativeWindowHandle
        [Win32Focus]::ShowWindow($chromeHandle, 5) | Out-Null
        [Win32Focus]::SetForegroundWindow($chromeHandle) | Out-Null
        Start-Sleep -Milliseconds 200
        $chromeRect = $chromeWin.Current.BoundingRectangle
        $clickX = [int]($chromeRect.Left + ($chromeRect.Width * 0.48))
        $clickY = [int]($chromeRect.Top + ($chromeRect.Height * 0.31))

        for ($try = 0; $try -lt 4; $try++) {{
            Click-Point $clickX $clickY
            $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
            if ($focused -and $focused.Current.ControlType.ProgrammaticName -eq 'ControlType.DataItem') {{
                break
            }}
            Start-Sleep -Milliseconds 180
        }}

        for ($i = 0; $i -lt 120; $i++) {{
            $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
            $focusName = ''
            if ($focused) {{
                $focusName = [string]$focused.Current.Name
            }}
            $matched = $false
            foreach ($target in $targets) {{
                if (-not $target) {{ continue }}
                if ($focusName -eq $target -or $target.Contains($focusName) -or $focusName.Contains($target)) {{
                    $matched = $true
                    break
                }}
            }}
            if ($matched) {{
                $ws.SendKeys('~')
                exit 0
            }}

            $ws.SendKeys('{{DOWN}}')
            Start-Sleep -Milliseconds 160
        }}

        throw 'Nao foi possivel selecionar o certificado alvo na janela nativa.'
        """
    )
    run_powershell(script, timeout_ms=45000)


def wait_for_certificate_dialog(timeout_seconds: int = 10) -> bool:
    script = textwrap.dedent(
        f"""
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        $deadline = (Get-Date).AddSeconds({timeout_seconds})
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $dialogTitle = 'Selecione um certificado'
        while ((Get-Date) -lt $deadline) {{
            $condition = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::NameProperty,
                $dialogTitle
            )
            $dialog = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
            if ($dialog) {{
                Write-Output 'FOUND'
                exit 0
            }}
            Start-Sleep -Milliseconds 250
        }}
        Write-Output 'NOT_FOUND'
        """
    )
    return run_powershell(script, timeout_ms=(timeout_seconds + 5) * 1000).strip() == "FOUND"


def login_ecac(page, cert_subject: str, timeout_ms: int) -> None:
    page.set_default_timeout(timeout_ms)
    page.context.set_default_navigation_timeout(timeout_ms)
    page.goto("https://cav.receita.fazenda.gov.br/autenticacao/login", wait_until="domcontentloaded")
    page.get_by_role("button", name="Acesso Gov BR").click()
    cert_button = page.get_by_role("button", name="Seu certificado digital", exact=True)
    cert_button.wait_for(timeout=timeout_ms)

    while True:
        cert_button.click(timeout=10000, no_wait_after=True)
        if wait_for_certificate_dialog(timeout_seconds=10):
            break
        page.reload(wait_until="domcontentloaded")
        cert_button = page.get_by_role("button", name="Seu certificado digital", exact=True)
        cert_button.wait_for(timeout=timeout_ms)

    select_certificate_dialog(cert_subject)
    time.sleep(2.0)

    deadline = time.time() + (timeout_ms / 1000)
    while time.time() < deadline:
        for candidate in page.context.pages:
            try:
                current_url = candidate.url
                body_text = candidate.locator("body").inner_text(timeout=10000)
                looks_like_ecac = (
                    "/ecac/" in current_url
                    or "Titular (Acesso GOV.BR por Certificado):" in body_text
                    or "Sair com Segurança" in body_text
                )
                if looks_like_ecac and cert_subject.split(":")[0] in body_text:
                    return
            except Exception:
                continue
        time.sleep(1.0)

    raise RuntimeError("O e-CAC nao confirmou o titular esperado dentro do tempo limite.")


def execute_login(cert_subject: str, cert_issuer: str, timeout_ms: int) -> None:
    ensure_dependencies()
    ensure_certificate_in_store(cert_subject, cert_issuer)

    playwright = browser = context = page = chrome_proc = None
    try:
        playwright, browser, context, page, chrome_proc = start_playwright_browser(DEFAULT_CDP_PORT)
        login_ecac(page, cert_subject, timeout_ms)
    finally:
        if context is not None:
            try:
                context.close()
            except Exception:
                pass
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass
        if playwright is not None:
            try:
                playwright.stop()
            except Exception:
                pass
        if chrome_proc is not None:
            try:
                chrome_proc.terminate()
            except Exception:
                pass


def load_certificates() -> list[dict]:
    if not CERTIFICATES_PATH.exists():
        return []
    try:
        return json.loads(CERTIFICATES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_certificates(certificates: list[dict]) -> None:
    CERTIFICATES_PATH.write_text(
        json.dumps(certificates, ensure_ascii=True, indent=2),
        encoding="utf-8",
    )


def open_gui() -> None:
    root = tk.Tk()
    root.title("eCAC Login")
    root.geometry("760x520")

    name_var = tk.StringVar()
    pfx_var = tk.StringVar()
    password_var = tk.StringVar()
    status_var = tk.StringVar(value="Pronto.")
    certificates = load_certificates()
    selected_index = {"value": None}

    def refresh_tree() -> None:
        tree.delete(*tree.get_children())
        for idx, item in enumerate(certificates):
            tree.insert(
                "",
                "end",
                iid=str(idx),
                values=(
                    item.get("name", item.get("alias", "")),
                    item.get("subject", ""),
                    item.get("thumbprint", ""),
                ),
            )

    def browse_pfx() -> None:
        path = filedialog.askopenfilename(
            title="Selecionar certificado PFX",
            filetypes=[("Certificado PFX", "*.pfx"), ("Todos os arquivos", "*.*")],
        )
        if path:
            pfx_var.set(path)

    def on_select(_: object) -> None:
        focus = tree.focus()
        selected_index["value"] = int(focus) if focus else None

    def register_certificate() -> None:
        name = name_var.get().strip()
        pfx_path = Path(pfx_var.get().strip())
        password = password_var.get()
        if not name or not pfx_path or not password:
            messagebox.showerror("Cadastro", "Preencha nome, arquivo PFX e senha.")
            return
        try:
            status_var.set("Importando certificado...")
            root.update_idletasks()
            meta = import_pfx_and_get_metadata(pfx_path, password)
            entry = {
                "name": name,
                "subject": meta["Subject"],
                "issuer": meta["Issuer"],
                "thumbprint": meta["Thumbprint"],
            }
            certificates[:] = [c for c in certificates if c.get("thumbprint") != entry["thumbprint"]]
            certificates.append(entry)
            save_certificates(certificates)
            refresh_tree()
            name_var.set("")
            pfx_var.set("")
            password_var.set("")
            status_var.set("Certificado cadastrado com sucesso.")
        except Exception as exc:
            messagebox.showerror("Cadastro", str(exc))
            status_var.set("Falha ao cadastrar certificado.")

    def run_selected() -> None:
        idx = selected_index["value"]
        if idx is None or idx >= len(certificates):
            messagebox.showerror("Execucao", "Selecione um certificado na lista.")
            return
        cert = certificates[idx]

        def worker() -> None:
            try:
                display_name = cert.get("name", cert.get("alias", cert["subject"]))
                status_var.set(f"Executando com {display_name}...")
                execute_login(cert["subject"], cert.get("issuer", ""), DEFAULT_TIMEOUT_MS)
                root.after(0, lambda: messagebox.showinfo("Execucao", "Acesso confirmado no e-CAC."))
                root.after(0, lambda: status_var.set("Execucao concluida com sucesso."))
            except Exception as exc:
                root.after(0, lambda: messagebox.showerror("Execucao", str(exc)))
                root.after(0, lambda: status_var.set("Falha na execucao."))

        threading.Thread(target=worker, daemon=True).start()

    form = ttk.LabelFrame(root, text="Cadastrar certificado")
    form.pack(fill="x", padx=12, pady=12)

    ttk.Label(form, text="Nome").grid(row=0, column=0, padx=8, pady=8, sticky="w")
    ttk.Entry(form, textvariable=name_var, width=28).grid(row=0, column=1, padx=8, pady=8, sticky="ew")
    ttk.Label(form, text="Arquivo PFX").grid(row=1, column=0, padx=8, pady=8, sticky="w")
    ttk.Entry(form, textvariable=pfx_var, width=52).grid(row=1, column=1, padx=8, pady=8, sticky="ew")
    ttk.Button(form, text="Explorar", command=browse_pfx).grid(row=1, column=2, padx=8, pady=8)
    ttk.Label(form, text="Senha").grid(row=2, column=0, padx=8, pady=8, sticky="w")
    ttk.Entry(form, textvariable=password_var, show="*", width=28).grid(row=2, column=1, padx=8, pady=8, sticky="w")
    ttk.Button(form, text="Cadastrar", command=register_certificate).grid(row=2, column=2, padx=8, pady=8)
    form.columnconfigure(1, weight=1)

    list_frame = ttk.LabelFrame(root, text="Certificados cadastrados")
    list_frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

    tree = ttk.Treeview(list_frame, columns=("name", "subject", "thumbprint"), show="headings", height=12)
    tree.heading("name", text="Nome")
    tree.heading("subject", text="Subject")
    tree.heading("thumbprint", text="Thumbprint")
    tree.column("name", width=160, anchor="w")
    tree.column("subject", width=360, anchor="w")
    tree.column("thumbprint", width=180, anchor="w")
    tree.pack(fill="both", expand=True, padx=8, pady=8)
    tree.bind("<<TreeviewSelect>>", on_select)

    bottom = ttk.Frame(root)
    bottom.pack(fill="x", padx=12, pady=(0, 12))
    ttk.Button(bottom, text="Executar certificado selecionado", command=run_selected).pack(side="left")
    ttk.Label(bottom, textvariable=status_var).pack(side="left", padx=12)

    refresh_tree()
    root.mainloop()


def main() -> None:
    args = parse_args()
    if args.gui or (not args.pfx_path and not args.pfx_password and not args.cert_subject):
        open_gui()
        return

    if not args.pfx_path or not args.pfx_password or not args.cert_subject:
        raise RuntimeError("No modo CLI, informe --pfx-path, --pfx-password e --cert-subject.")

    ensure_dependencies()
    pfx_path = Path(args.pfx_path).expanduser().resolve()
    ensure_pfx_imported(pfx_path, args.pfx_password, args.cert_subject, args.cert_issuer)
    execute_login(args.cert_subject, args.cert_issuer, args.timeout_ms)
    print("Acesso confirmado no e-CAC com o certificado selecionado.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
