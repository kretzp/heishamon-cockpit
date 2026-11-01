param([string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'HeishaMonCockpit'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($env:OS -ne 'Windows_NT' -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
    throw 'Run this installer in 64-bit PowerShell on Windows x64.'
}
$target = [System.IO.Path]::GetFullPath($InstallDirectory)
if (Test-Path -LiteralPath $target) { throw 'Installation path already exists; choose a new path.' }
if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) { throw 'Windows tar.exe is required.' }
. (Join-Path $PSScriptRoot 'ensure-python.ps1')
$mcpPython = Ensure-CockpitPython
$output = Join-Path $projectRoot ('artifacts\build-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $output | Out-Null
$previousOutput = $env:HPC_PACKAGE_OUTPUT
try {
    $env:HPC_PACKAGE_OUTPUT = $output
    & (Join-Path $projectRoot 'packaging\build.ps1') -Runtime win-x64
    if (-not (Test-Path -LiteralPath (Join-Path $output 'heishamon-cockpit-win-x64.tar.gz'))) { throw 'Package was not created.' }
    $extracted = Join-Path $output 'extracted'
    New-Item -ItemType Directory -Path $extracted | Out-Null
    & tar.exe -xzf (Join-Path $output 'heishamon-cockpit-win-x64.tar.gz') -C $extracted
    if ($LASTEXITCODE -ne 0) { throw 'Package extraction failed.' }
    & (Join-Path $extracted 'install.ps1') -InstallDirectory $target
    Write-Host "MCP command: `"$mcpPython`" `"$(Join-Path $target 'cockpit_mcp.py')`""
    Write-Host "Package retained in: $output"
    Write-Host 'Setup does not start the application or connect to MQTT.'
}
finally { $env:HPC_PACKAGE_OUTPUT = $previousOutput }
