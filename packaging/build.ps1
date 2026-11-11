param([Parameter(Mandatory=$true)][ValidateSet('win-x64','linux-x64','linux-arm64')][string]$Runtime)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $env:NUGET_HTTP_CACHE_PATH) { $env:NUGET_HTTP_CACHE_PATH = Join-Path $root '.cache\nuget\http' }
if (-not $env:NUGET_PACKAGES) { $env:NUGET_PACKAGES = Join-Path $root '.cache\nuget\packages' }
New-Item -ItemType Directory -Path $env:NUGET_HTTP_CACHE_PATH,$env:NUGET_PACKAGES -Force | Out-Null
$tools = Join-Path $root '.cache\build-tools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
$nodeVersion = '24.20.0'
$sdkVersion = '10.0.404'
$nodeName = "node-v$nodeVersion-win-x64"
$nodePath = Join-Path $tools $nodeName
if (-not (Test-Path -LiteralPath (Join-Path $nodePath 'node.exe'))) {
    $archive = "$nodeName.zip"
    $archivePath = Join-Path $tools $archive
    Invoke-WebRequest "https://nodejs.org/dist/v$nodeVersion/$archive" -OutFile $archivePath
    $hashes = (Invoke-WebRequest "https://nodejs.org/dist/v$nodeVersion/SHASUMS256.txt").Content -split "`n"
    $line = $hashes | Where-Object { $_ -match "^[0-9a-f]{64}\s+$([regex]::Escape($archive))\s*$" } | Select-Object -First 1
    if (-not $line) { throw 'Node.js checksum not found.' }
    $expected = ($line -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expected) { throw 'Node.js checksum mismatch.' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $tools
}
$dotnetDir = Join-Path $tools 'dotnet'
$dotnetExe = Join-Path $dotnetDir 'dotnet.exe'
if (-not (Test-Path -LiteralPath $dotnetExe) -or (& $dotnetExe --version) -ne $sdkVersion) {
    $script = Join-Path $tools 'dotnet-install.ps1'
    Invoke-WebRequest 'https://dot.net/v1/dotnet-install.ps1' -OutFile $script
    & $script -Version $sdkVersion -InstallDir $dotnetDir -NoPath
    if (-not (Test-Path -LiteralPath $dotnetExe)) { throw '.NET SDK setup failed.' }
    $installedVersion = & $dotnetExe --version
    if ($LASTEXITCODE -ne 0 -or $installedVersion -ne $sdkVersion) { throw '.NET SDK version verification failed.' }
}
$env:PATH = "$nodePath;$dotnetDir;$env:PATH"
Push-Location $root
try { & (Join-Path $nodePath 'node.exe') tools/build-package.mjs $Runtime; if ($LASTEXITCODE -ne 0) { throw 'Package build failed.' } }
finally { Pop-Location }
