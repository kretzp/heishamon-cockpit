param([string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'HeishaMonCockpit'))
$ErrorActionPreference = 'Stop'
$packageDirectory = $PSScriptRoot
$target = [System.IO.Path]::GetFullPath($InstallDirectory)
if (Test-Path -LiteralPath $target) { throw 'Installation path already exists; choose a new path.' }
[System.IO.Directory]::CreateDirectory($target) | Out-Null
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $target /inheritance:r /grant:r "*${sid}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict access to the installation directory.' }
Get-ChildItem -LiteralPath (Join-Path $packageDirectory 'app') -Force | Copy-Item -Destination $target -Recurse
Push-Location $target
try { & (Join-Path $target 'Cockpit.Web.exe') --setup-installation; if ($LASTEXITCODE -ne 0) { throw 'Setup failed; the installation folder was preserved for inspection.' } }
finally { Pop-Location }
Write-Host "To start later: Set-Location '$target'; .\Cockpit.Web.exe"
