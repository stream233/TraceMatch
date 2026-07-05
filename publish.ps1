param(
    [switch]$BuildInstaller
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm was not found. Install Node.js 20.19+ and pnpm, then retry."
}

Write-Host "Checking TraceMatch Electron sources..." -ForegroundColor Cyan
pnpm typecheck
if ($LASTEXITCODE -ne 0) {
    throw "TypeScript validation failed with exit code $LASTEXITCODE."
}

if ($BuildInstaller) {
    Write-Host "Building Windows NSIS installer..." -ForegroundColor Cyan
    pnpm package:win
    if ($LASTEXITCODE -ne 0) {
        throw "Windows installer build failed with exit code $LASTEXITCODE."
    }
    Write-Host "Installer: dist\TraceMatchSetup.exe" -ForegroundColor Green
}
else {
    Write-Host "Building Electron application..." -ForegroundColor Cyan
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        throw "Electron build failed with exit code $LASTEXITCODE."
    }
    Write-Host "Build completed: out\" -ForegroundColor Green
}
