#!/usr/bin/env pwsh
# Lance le jeu et ouvre le navigateur.
#   .\play.ps1          -> http://localhost:8123
#   .\play.ps1 -Direct  -> ouvre directement le fichier (aucun serveur)
param([switch]$Direct, [int]$Port = 8123)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Direct) {
    Write-Host "Ouverture directe (aucun serveur necessaire)…" -ForegroundColor Cyan
    Start-Process (Join-Path $here "index.html")
    return
}

Write-Host "Serveur local sur http://localhost:$Port" -ForegroundColor Cyan
Write-Host "Ctrl+C pour arreter." -ForegroundColor DarkGray
Start-Process "http://localhost:$Port"

Push-Location $here
try {
    python -m http.server $Port --bind 127.0.0.1
} finally {
    Pop-Location
}
