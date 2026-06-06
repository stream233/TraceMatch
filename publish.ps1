param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$PublishDir = ".\publish\win-x64",
    [switch]$BuildInstaller
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectFile = Join-Path $projectRoot "TraceMatch.csproj"
$publishPath = Join-Path $projectRoot $PublishDir

Write-Host "Publishing TraceMatch..." -ForegroundColor Cyan
Write-Host "Project: $projectFile"
Write-Host "Runtime: $Runtime"
Write-Host "Output:  $publishPath"

if (Test-Path -LiteralPath $publishPath) {
    Remove-Item -LiteralPath $publishPath -Recurse -Force
}

dotnet publish $projectFile `
    --configuration $Configuration `
    --runtime $Runtime `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=none `
    -p:DebugSymbols=false `
    -p:PublishDir="$publishPath\"

Write-Host "Publish completed." -ForegroundColor Green

if ($BuildInstaller) {
    $iscc = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
    if (-not $iscc) {
        $candidatePaths = @(
            "${env:ProgramFiles}\Inno Setup 7\ISCC.exe",
            "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe",
            "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
            "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
        )
        foreach ($candidatePath in $candidatePaths) {
            if (Test-Path -LiteralPath $candidatePath) {
                $iscc = Get-Item -LiteralPath $candidatePath
                break
            }
        }
    }

    if (-not $iscc) {
        throw "Inno Setup compiler ISCC.exe was not found. Install Inno Setup 7/6 or add ISCC.exe to PATH."
    }

    $issFile = Join-Path $projectRoot "TraceMatch.iss"
    $isccPath = if ($iscc.Source) { $iscc.Source } else { $iscc.FullName }
    Write-Host "Building installer..." -ForegroundColor Cyan
    & $isccPath $issFile
    if ($LASTEXITCODE -ne 0) {
        throw "Inno Setup compiler failed with exit code $LASTEXITCODE."
    }
    Write-Host "Installer completed." -ForegroundColor Green
}
