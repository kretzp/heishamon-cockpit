param(
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'HeishaMonCockpit'),
    [string]$PackageDirectory
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'Requires 64-bit PowerShell on Windows x64.' }
if (-not [IO.Path]::IsPathRooted($InstallDirectory)) { throw 'InstallDirectory must be absolute.' }
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'ensure-python.ps1')
$python = Find-CockpitPython
if (-not $python) { throw 'A working Python 3.10+ installation is required. Use the Python installed during initial setup.' }
if (-not $PackageDirectory) {
    $output = Join-Path $root ('artifacts\update-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $output | Out-Null
    $previousOutput = $env:HPC_PACKAGE_OUTPUT
    try {
        $env:HPC_PACKAGE_OUTPUT = $output
        & (Join-Path $root 'packaging\build.ps1') -Runtime win-x64
    } finally { $env:HPC_PACKAGE_OUTPUT = $previousOutput }
    $PackageDirectory = Join-Path $output 'extracted'
    New-Item -ItemType Directory -Path $PackageDirectory | Out-Null
    & tar.exe -xzf (Join-Path $output 'heishamon-cockpit-win-x64.tar.gz') -C $PackageDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Package extraction failed; installation was not changed.' }
}
if (-not [IO.Path]::IsPathRooted($PackageDirectory)) { throw 'PackageDirectory must be absolute.' }
$target = [IO.Path]::GetFullPath($InstallDirectory)
$package = [IO.Path]::GetFullPath($PackageDirectory)
$resultFile = Join-Path $package 'update-result.json'
if (Test-Path -LiteralPath $resultFile) { Remove-Item -LiteralPath $resultFile }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if ((Get-Service -Name HeishaMonCockpit -ErrorAction SilentlyContinue) -and -not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Requesting elevation only for the prepared update; the package build is already complete.'
    $process = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'),
        '-InstallDirectory', ('"' + $target + '"'), '-PackageDirectory', ('"' + $package + '"'))
    if (Test-Path -LiteralPath $resultFile) { Get-Content -LiteralPath $resultFile | Write-Host }
    if ($process.ExitCode -ne 0) { throw 'Update failed. Inspect the reported backup/workspace before retrying.' }
    return
}
Write-Host 'A running service will be stopped and restarted. Restarting opens its configured MQTT connection.'
& $python (Join-Path $PSScriptRoot 'update_installation.py') --install-dir $target --package-directory $package --runtime win-x64 --result-file $resultFile
if ($LASTEXITCODE -ne 0) { throw 'Update failed. Inspect the reported backup/workspace before retrying.' }
