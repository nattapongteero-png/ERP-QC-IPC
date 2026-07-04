# ============================================================================
# serve-lan.ps1 — Publish the local UAT app (localhost:6809) to the Wi-Fi LAN
# so other computers/devices on the SAME Wi-Fi can open http://<this-PC>:6809
#
# Run this AFTER connecting to Wi-Fi (the IP may change each time you connect).
# Usage:  right-click > Run with PowerShell   — or in a terminal:
#         powershell -ExecutionPolicy Bypass -File .\serve-lan.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "=== 1. Finding this PC's Wi-Fi IPv4 address ===" -ForegroundColor Cyan

# Prefer the interface literally named "Wi-Fi"; fall back to any wireless-looking
# adapter. Never pick VMware/WSL/loopback/link-local addresses — other devices
# can't reach those.
$wifi = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.InterfaceAlias -eq 'Wi-Fi' -and
        $_.IPAddress -notlike '169.254.*'
    } | Select-Object -First 1

if (-not $wifi) {
    Write-Host "Could not find an interface named 'Wi-Fi'. Candidates below —" -ForegroundColor Yellow
    Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        ForEach-Object { Write-Host ("  {0}  [{1}]" -f $_.IPAddress, $_.InterfaceAlias) }
    Write-Host "Edit this script's IP selection, or set `$env:UAT_PUBLIC_URL manually, then re-run." -ForegroundColor Yellow
    exit 1
}

$ip  = $wifi.IPAddress
$url = "http://${ip}:6809"
Write-Host ("    Wi-Fi IP : {0}" -f $ip) -ForegroundColor Green
Write-Host ("    App URL  : {0}" -f $url) -ForegroundColor Green

Write-Host "`n=== 2. Ensuring the firewall allows inbound TCP 6809 ===" -ForegroundColor Cyan
$rule = Get-NetFirewallRule -DisplayName 'Herbal UAT 6809' -ErrorAction SilentlyContinue
if ($rule) {
    Write-Host "    Firewall rule already present (OK)." -ForegroundColor Green
} else {
    Write-Host "    Rule missing. Creating it needs admin — a UAC prompt will appear; click Yes." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -Wait -ArgumentList '-Command', `
        "New-NetFirewallRule -DisplayName 'Herbal UAT 6809' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 6809 -Profile Any"
    Write-Host "    Firewall rule created." -ForegroundColor Green
}

Write-Host "`n=== 3. Rebuilding + restarting the app bound to this IP ===" -ForegroundColor Cyan
# NEXT_PUBLIC_APP_URL is inlined at BUILD time, so a rebuild (cached, ~1-2 min)
# is required when the IP changes — otherwise other devices' logins bounce to
# their own localhost. AUTH_COOKIE_INSECURE lets the auth cookie survive plain
# http:// (no HTTPS on the LAN).
$env:UAT_PUBLIC_URL      = $url
$env:AUTH_COOKIE_INSECURE = 'true'

docker compose -f docker-compose.uat.yml build --build-arg BUILDKIT_INLINE_CACHE=1 app-uat
docker compose -f docker-compose.uat.yml up -d --force-recreate app-uat

Write-Host "`n=== 4. Waiting for health ===" -ForegroundColor Cyan
$healthy = $false
for ($i = 0; $i -lt 24; $i++) {
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:6809/api/health" -TimeoutSec 5
        if ($r.status -eq 'healthy') { $healthy = $true; break }
    } catch {}
    Start-Sleep -Seconds 5
}

Write-Host ""
if ($healthy) {
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host " READY. Other devices on this Wi-Fi can now open:" -ForegroundColor Green
    Write-Host ("   {0}" -f $url) -ForegroundColor White
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host " Login: admin@herbal-erp.com / admin123"
    Write-Host " If a device still can't connect, the Wi-Fi may use"
    Write-Host " 'client isolation' (AP blocks device-to-device) — ask"
    Write-Host " IT to disable it, or use a network that allows it."
} else {
    Write-Host "App did not become healthy in ~2 min. Check: docker compose -f docker-compose.uat.yml logs app-uat" -ForegroundColor Red
}
