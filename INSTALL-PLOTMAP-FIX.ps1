# ============================================================
# PlotMap OpenLayers Clean Reset
# Target: C:\Projects\PLOTMAP
# ============================================================

$ErrorActionPreference = "Stop"

$Target = "C:\Projects\PLOTMAP"
$Source = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "PlotMap OpenLayers Clean Reset" -ForegroundColor Cyan
Write-Host "Target: $Target"
Write-Host ""

if (!(Test-Path $Target)) {
    throw "Target folder not found: $Target"
}

# ------------------------------------------------------------
# 001 - Copy complete replacement files
# ------------------------------------------------------------

Write-Host "Copying replacement files..." -ForegroundColor Yellow

Copy-Item "$Source\index.html" "$Target\index.html" -Force
Copy-Item "$Source\vite.config.ts" "$Target\vite.config.ts" -Force
Copy-Item "$Source\vercel.json" "$Target\vercel.json" -Force

Copy-Item "$Source\src\App.tsx" "$Target\src\App.tsx" -Force
Copy-Item "$Source\src\main.tsx" "$Target\src\main.tsx" -Force
Copy-Item "$Source\src\index.css" "$Target\src\index.css" -Force

if (!(Test-Path "$Target\src\config")) {
    New-Item -ItemType Directory -Path "$Target\src\config" | Out-Null
}

Copy-Item "$Source\src\config\plotmap.ts" "$Target\src\config\plotmap.ts" -Force

# ------------------------------------------------------------
# 002 - Verify ArcGIS MapView is gone
# ------------------------------------------------------------

Write-Host "Checking App.tsx for stale ArcGIS imports..." -ForegroundColor Yellow

$MapViewMatches = Select-String `
    -Path "$Target\src\App.tsx" `
    -Pattern 'from "@arcgis|new runtime\.MapView|new MapView' `
    -ErrorAction SilentlyContinue

if ($MapViewMatches) {
    Write-Host ""
    Write-Host "ERROR: ArcGIS MapView references still exist:" -ForegroundColor Red
    $MapViewMatches | ForEach-Object { Write-Host $_.Line }
    throw "App.tsx was not replaced correctly."
}

Write-Host "Good: no ArcGIS MapView imports remain." -ForegroundColor Green

# ------------------------------------------------------------
# 003 - Dependency cleanup
# ------------------------------------------------------------

Set-Location $Target

Write-Host "Installing OpenLayers..." -ForegroundColor Yellow
npm install ol

Write-Host "Removing old ArcGIS npm dependency if present..." -ForegroundColor Yellow
npm uninstall '@arcgis/core' 2>$null

# ------------------------------------------------------------
# 004 - Clear Vite cache
# ------------------------------------------------------------

Write-Host "Clearing Vite cache..." -ForegroundColor Yellow

if (Test-Path "$Target\node_modules\.vite") {
    Remove-Item "$Target\node_modules\.vite" -Recurse -Force
}

# ------------------------------------------------------------
# 005 - Final verification
# ------------------------------------------------------------

Write-Host ""
Write-Host "Checking active source file..." -ForegroundColor Yellow

Select-String `
    -Path "$Target\src\App.tsx" `
    -Pattern 'from "ol/Map.js"' |
    ForEach-Object {
        Write-Host "Found OpenLayers Map import: $($_.Line.Trim())" -ForegroundColor Green
    }

Write-Host ""
Write-Host "Reset complete." -ForegroundColor Green
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "  cd C:\Projects\PLOTMAP"
Write-Host "  npm run dev -- --force"
Write-Host ""
