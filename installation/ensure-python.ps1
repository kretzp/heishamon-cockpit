$ErrorActionPreference = 'Stop'
function Find-CockpitPython {
    $candidates = @()
    foreach ($name in @('python.exe','python3.exe')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command -and $command.Source -notlike '*\Microsoft\WindowsApps\*') { $candidates += $command.Source }
    }
    foreach ($base in @('HKCU:\Software\Python\PythonCore','HKLM:\Software\Python\PythonCore')) {
        if (Test-Path $base) {
            foreach ($version in Get-ChildItem $base) {
                $key = Get-Item ($version.PSPath + '\InstallPath') -ErrorAction SilentlyContinue
                if ($key -and $key.GetValue('')) { $candidates += Join-Path $key.GetValue('') 'python.exe' }
            }
        }
    }
    $candidates += Join-Path $env:LOCALAPPDATA 'Programs\Python\Python314\python.exe'
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (Test-Path -LiteralPath $candidate) {
            try {
                $result = & $candidate -c 'import sys,ssl,urllib.request,http.cookiejar,json; assert sys.version_info >= (3,10); print(sys.executable)' 2>$null
                if ($LASTEXITCODE -eq 0 -and $result) { return [string]$result }
            } catch { }
        }
    }
}
function Ensure-CockpitPython {
    $python = Find-CockpitPython
    if (-not $python) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw 'Python 3.10+ is required for MCP. Install Windows App Installer (winget) and rerun setup.' }
        Write-Host 'Installing Python for the current user for the MCP bridge.'
        & winget.exe install --id Python.Python.3.14 --exact --source winget --scope user --silent --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'Python installation failed. Resolve the winget error and rerun setup.' }
        $python = Find-CockpitPython
        if (-not $python) { throw 'A working Python 3.10+ with SSL could not be found after installation.' }
    }
    Write-Host "MCP Python: $python"
    return $python
}
