param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$PublishDir = ".\publish\win-x64",
    [switch]$BuildInstaller
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectFile = Join-Path $projectRoot "TraceMatch.csproj"
$issFile = Join-Path $projectRoot "TraceMatch.iss"
$publishPath = Join-Path $projectRoot $PublishDir

function Set-Utf8NoBomContent {
    param(
        [string]$Path,
        [string]$Content
    )

    $encoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-ProjectVersion {
    $content = Get-Content -LiteralPath $projectFile -Raw
    $match = [regex]::Match($content, '<Version>(?<version>[^<]+)</Version>')
    if (-not $match.Success -or [string]::IsNullOrWhiteSpace($match.Groups["version"].Value)) {
        return [version]"1.0.0"
    }

    return [version]$match.Groups["version"].Value
}

function Set-ProjectVersion {
    param([version]$Version)

    $versionText = "$($Version.Major).$($Version.Minor).$($Version.Build)"
    $assemblyVersionText = "$versionText.0"
    $content = Get-Content -LiteralPath $projectFile -Raw

    if ($content -match '<Version>[^<]+</Version>') {
        $content = $content -replace '<Version>[^<]+</Version>', "<Version>$versionText</Version>"
        $content = $content -replace '<AssemblyVersion>[^<]+</AssemblyVersion>', "<AssemblyVersion>$assemblyVersionText</AssemblyVersion>"
        $content = $content -replace '<FileVersion>[^<]+</FileVersion>', "<FileVersion>$assemblyVersionText</FileVersion>"
    }
    else {
        $versionBlock = @"
    <Version>$versionText</Version>
    <AssemblyVersion>$assemblyVersionText</AssemblyVersion>
    <FileVersion>$assemblyVersionText</FileVersion>
"@
        $content = $content -replace '(\s*<RootNamespace>TraceMatch</RootNamespace>)', "`$1`r`n$versionBlock"
    }

    Set-Utf8NoBomContent -Path $projectFile -Content $content
}

function Set-InstallerVersion {
    param([version]$Version)

    $versionText = "$($Version.Major).$($Version.Minor).$($Version.Build)"
    $content = Get-Content -LiteralPath $issFile -Raw
    $content = $content -replace '(?m)^#define MyAppVersion ".+"$', "#define MyAppVersion `"$versionText`""
    Set-Utf8NoBomContent -Path $issFile -Content $content
}

function Step-Version {
    $currentVersion = Get-ProjectVersion
    $build = if ($currentVersion.Build -lt 0) { 0 } else { $currentVersion.Build }
    $nextVersion = [version]::new($currentVersion.Major, $currentVersion.Minor, $build + 1)
    Set-ProjectVersion $nextVersion
    Set-InstallerVersion $nextVersion
    return $nextVersion
}

if ($BuildInstaller) {
    $nextVersion = Step-Version
    Write-Host "Version:  $nextVersion" -ForegroundColor Cyan
}

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
    -p:Version="$((Get-ProjectVersion).ToString())" `
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

    $isccPath = if ($iscc.Source) { $iscc.Source } else { $iscc.FullName }
    Write-Host "Building installer..." -ForegroundColor Cyan
    & $isccPath $issFile
    if ($LASTEXITCODE -ne 0) {
        throw "Inno Setup compiler failed with exit code $LASTEXITCODE."
    }
    Write-Host "Installer completed." -ForegroundColor Green
}
