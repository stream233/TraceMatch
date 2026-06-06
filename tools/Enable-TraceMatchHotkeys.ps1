param(
    [switch]$InstallProfile
)

$ErrorActionPreference = "Stop"

$scriptPath = $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
$projectFile = Join-Path $projectRoot "TraceMatch.csproj"
$publishScript = Join-Path $projectRoot "publish.ps1"

function Invoke-TraceMatchBuild {
    Write-Host ""
    Write-Host "[TraceMatch] Build Release..." -ForegroundColor Cyan
    Push-Location $projectRoot
    try {
        dotnet build $projectFile -c Release
        if ($LASTEXITCODE -ne 0) {
            throw "dotnet build failed with exit code $LASTEXITCODE."
        }
        Write-Host "[TraceMatch] Build completed." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Invoke-TraceMatchInstaller {
    Write-Host ""
    Write-Host "[TraceMatch] Publish and build installer..." -ForegroundColor Cyan
    Push-Location $projectRoot
    try {
        & $publishScript -BuildInstaller
        if ($LASTEXITCODE -ne 0) {
            throw "publish.ps1 failed with exit code $LASTEXITCODE."
        }
        Write-Host "[TraceMatch] Installer completed." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Register-TraceMatchHotkeys {
    if (-not (Get-Module -ListAvailable -Name PSReadLine)) {
        throw "PSReadLine was not found. Install or enable PSReadLine before binding hotkeys."
    }

    Import-Module PSReadLine -ErrorAction Stop

    Set-PSReadLineKeyHandler -Chord Ctrl+b -Description "Build TraceMatch Release" -ScriptBlock {
        [Microsoft.PowerShell.PSConsoleReadLine]::RevertLine()
        [Microsoft.PowerShell.PSConsoleReadLine]::Insert("Invoke-TraceMatchBuild")
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }

    Set-PSReadLineKeyHandler -Chord Ctrl+i -Description "Build TraceMatch installer" -ScriptBlock {
        [Microsoft.PowerShell.PSConsoleReadLine]::RevertLine()
        [Microsoft.PowerShell.PSConsoleReadLine]::Insert("Invoke-TraceMatchInstaller")
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}

if ($InstallProfile) {
    $profileDir = Split-Path -Parent $PROFILE
    if (-not (Test-Path -LiteralPath $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir | Out-Null
    }

    $profileLine = ". `"$scriptPath`""
    if (Test-Path -LiteralPath $PROFILE) {
        $profileContent = Get-Content -LiteralPath $PROFILE -Raw
    }
    else {
        $profileContent = ""
    }

    if ($profileContent -notlike "*$profileLine*") {
        Add-Content -LiteralPath $PROFILE -Value ""
        Add-Content -LiteralPath $PROFILE -Value "# TraceMatch hotkeys: Ctrl+B build, Ctrl+I installer"
        Add-Content -LiteralPath $PROFILE -Value $profileLine
        Write-Host "[TraceMatch] Added hotkeys to PowerShell profile:" -ForegroundColor Green
        Write-Host $PROFILE
    }
    else {
        Write-Host "[TraceMatch] Profile already contains TraceMatch hotkeys." -ForegroundColor Yellow
    }
}

Register-TraceMatchHotkeys

Write-Host "[TraceMatch] Hotkeys enabled in this PowerShell session." -ForegroundColor Green
Write-Host "  Ctrl+B  Build Release"
Write-Host "  Ctrl+I  Publish and build installer"
Write-Host "Note: Ctrl+I is the same key code as Tab in many terminals."
