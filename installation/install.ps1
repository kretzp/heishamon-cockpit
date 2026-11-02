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
Copy-Item -LiteralPath (Join-Path $packageDirectory 'install-service.ps1') -Destination $target
Copy-Item -LiteralPath (Join-Path $packageDirectory 'WinSW-LICENSE.txt') -Destination $target
Write-Host "To start later: Set-Location '$target'; .\Cockpit.Web.exe"
Write-Host 'Choosing yes starts the service immediately and connects to the configured MQTT broker. Control settings remain unchanged.'
do {
    $serviceAnswer = [string](Read-Host 'Install as a service that starts automatically at boot? (yes/y/no/n) [no]')
    $serviceAnswer = $serviceAnswer.Trim().ToLowerInvariant()
    $validAnswer = $serviceAnswer -in @('', 'n', 'no', 'nein', 'y', 'yes', 'j', 'ja')
    if (-not $validAnswer) { Write-Host 'Invalid value. Enter yes/y or no/n, or press Enter for no.' }
} until ($validAnswer)
if ($serviceAnswer -and $serviceAnswer.Trim().ToLowerInvariant() -in @('y', 'yes', 'j', 'ja')) {
    try {
        & (Join-Path $target 'install-service.ps1') -InstallDirectory $target
        Write-Host 'Elevated PowerShell: Get-Service HeishaMonCockpit; Start-Service HeishaMonCockpit; Stop-Service HeishaMonCockpit'
        Write-Host "Logs: $target\logs (HeishaMonCockpitService.out.log / .err.log)"
        Write-Host "Remove in elevated PowerShell: & '$target\HeishaMonCockpitService.exe' stop; & '$target\HeishaMonCockpitService.exe' uninstall"
    } catch { Write-Warning $_.Exception.Message; Write-Warning 'Service setup was not completed. The installation remains available for manual startup.' }
} else { Write-Host 'No service installed. Start the application manually when ready.' }
