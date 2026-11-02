param([string]$InstallDirectory, [ValidateSet('Abort','Delete','Start','Fail')][string]$ExistingAction)

function Test-CockpitAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-CockpitServiceWrapper([string]$Wrapper, [string]$Action) {
    & $Wrapper $Action
    if ($LASTEXITCODE -ne 0) { throw 'Windows service registration failed.' }
}

function Install-CockpitWindowsService {
    param([Parameter(Mandatory=$true)][string]$InstallDirectory, [ValidateSet('Abort','Delete','Start','Fail')][string]$ExistingAction)
    $ErrorActionPreference = 'Stop'
    $target = [System.IO.Path]::GetFullPath($InstallDirectory)
    if (-not (Test-Path -LiteralPath (Join-Path $target 'Cockpit.Web.exe') -PathType Leaf)) { throw 'Installed application not found.' }
    $serviceName = 'HeishaMonCockpit'
    $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $existing -and $ExistingAction -eq 'Start') { throw 'Existing service disappeared; no replacement was installed.' }
    if ($existing) {
        while (-not $ExistingAction) {
            $answer = [string](Read-Host 'Service exists. Choose [A]bort, [D]elete and reinstall, or [S]tart existing service [A]')
            switch -CaseSensitive ($answer) {
                { $_ -in @('', 'a', 'A') } { $ExistingAction = 'Abort' }
                { $_ -in @('d', 'D') } { $ExistingAction = 'Delete' }
                { $_ -in @('s', 'S') } { $ExistingAction = 'Start' }
                default { Write-Host 'Invalid value. Enter A, D or S.' }
            }
        }
        if ($ExistingAction -eq 'Abort') { Write-Host 'Aborted. Existing service was not changed.'; return }
        if ($ExistingAction -eq 'Fail') { throw 'A service appeared during elevation. Rerun setup to choose an action.' }
    }
    if (-not (Test-CockpitAdministrator)) {
        $helper = Join-Path $target 'install-service.ps1'
        $action = if ($ExistingAction) { $ExistingAction } else { 'Fail' }
        $process = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $helper + '"'), '-InstallDirectory', ('"' + $target + '"'), '-ExistingAction', $action)
        if ($process.ExitCode -ne 0) { throw "Service setup failed. Inspect $target\logs\service-install.log. Application files were preserved." }
        Get-Service -Name $serviceName | Format-Table Name, Status, StartType
        return
    }
    if ($existing -and $ExistingAction -eq 'Start') {
        Start-Service -Name $serviceName
        (Get-Service -Name $serviceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
        Start-Sleep -Seconds 2
        if ((Get-Service -Name $serviceName).Status -ne 'Running') { throw 'Existing service did not stay running.' }
        Get-Service -Name $serviceName | Format-Table Name, Status, StartType
        return
    }
    $replaceFiles = $ExistingAction -eq 'Delete'
    if ($existing -and $replaceFiles) {
        Stop-Service -Name $serviceName
        if ($existing -is [IDisposable]) { $existing.Dispose() }
        & sc.exe delete $serviceName
        if ($LASTEXITCODE -ne 0) { throw 'Existing service could not be deleted.' }
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            $remaining = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if (-not $remaining) { break }
            if ($remaining -is [IDisposable]) { $remaining.Dispose() }
            Start-Sleep -Seconds 1
        }
        if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) { throw 'Service deletion is still pending; retry after closing service management tools.' }
        Write-Host 'Existing service removed. Installing the new service; application files and data were preserved.'
    }
    $logs = Join-Path $target 'logs'
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    Start-Transcript -LiteralPath (Join-Path $logs 'service-install.log') -Append | Out-Null
    $created = $false
    try {
        $wrapper = Join-Path $target 'HeishaMonCockpitService.exe'
        $config = Join-Path $target 'HeishaMonCockpitService.xml'
        if (-not $replaceFiles -and ((Test-Path -LiteralPath $wrapper) -or (Test-Path -LiteralPath $config))) { throw 'Service wrapper files already exist; choose Delete for a registered service to replace them.' }
        # Observed SHA256 of the official v2.12.0 x64 release asset; not a publisher checksum file.
        $expectedHash = '05B82D46AD331CC16BDC00DE5C6332C1EF818DF8CEEFCD49C726553209B3A0DA'
        $download = Join-Path $logs ('winsw-' + [guid]::NewGuid().ToString('N') + '.download')
        try {
            Invoke-WebRequest -UseBasicParsing 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe' -OutFile $download
            if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $expectedHash) { throw 'WinSW checksum mismatch; service setup aborted.' }
            Move-Item -LiteralPath $download -Destination $wrapper -Force:$replaceFiles
        } finally { if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download } }
        @'
    <service>
      <id>HeishaMonCockpit</id>
      <name>HeishaMon Cockpit</name>
      <description>HeishaMon Cockpit web application</description>
      <executable>%BASE%\Cockpit.Web.exe</executable>
      <workingdirectory>%BASE%</workingdirectory>
      <startmode>Automatic</startmode>
      <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>
      <logpath>%BASE%\logs</logpath>
      <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>8</keepFiles></log>
      <stoptimeout>30 sec</stoptimeout>
    </service>
'@ | Set-Content -LiteralPath $config -Encoding UTF8
        # Locale-independent SIDs: LocalService, SYSTEM, Administrators. Preserve owner access.
        & icacls.exe $target /grant '*S-1-5-19:(OI)(CI)RX' '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /Q
        if ($LASTEXITCODE -ne 0) { throw 'Could not grant service read access.' }
        foreach ($directory in @((Join-Path $target 'data'), $logs)) {
            & icacls.exe $directory /grant '*S-1-5-19:(OI)(CI)M' /T /Q
            if ($LASTEXITCODE -ne 0) { throw 'Could not grant service data/log access.' }
        }
        if ((Get-FileHash -LiteralPath $wrapper -Algorithm SHA256).Hash -ne $expectedHash) { throw 'WinSW checksum changed; aborting.' }
        Invoke-CockpitServiceWrapper $wrapper 'install'
        $created = $true
        Start-Service -Name $serviceName
        (Get-Service -Name $serviceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
        Start-Sleep -Seconds 2
        if ((Get-Service -Name $serviceName).Status -ne 'Running') { throw 'Service exited during startup.' }
        Write-Host 'Service installed, enabled at boot and started as LocalService.'
        Get-Service -Name $serviceName | Format-Table Name, Status, StartType
    } catch {
        if ($created) {
            Stop-Service -Name $serviceName -ErrorAction SilentlyContinue
            Set-Service -Name $serviceName -StartupType Manual
        }
        Write-Host 'Service setup failed. Application and diagnostics were preserved; start manually if needed.'
        throw
    } finally { Stop-Transcript | Out-Null }
}

if ($MyInvocation.InvocationName -ne '.') {
    $arguments = @{ InstallDirectory = $InstallDirectory }
    if ($ExistingAction) { $arguments.ExistingAction = $ExistingAction }
    Install-CockpitWindowsService @arguments
}
