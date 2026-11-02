# Isolated command-stub tests; invoked by test-service-install.mjs on Windows.
param([string]$Root, [string]$Helper, [string]$Scenario)
$ErrorActionPreference = 'Stop'
$target = Join-Path $Root 'installed app'
New-Item -ItemType Directory -Path $target,(Join-Path $target 'data') | Out-Null
Set-Content -LiteralPath (Join-Path $target 'Cockpit.Web.exe') -Value 'not executed'
. $Helper -InstallDirectory $target
$script:registered = $Scenario -eq 'existing'
$script:started = $false
$script:downloaded = $false
$script:manual = $false
$script:acl = @()
function Test-CockpitAdministrator { return $Scenario -ne 'elevation' }
function Invoke-WebRequest {
    param($UseBasicParsing, $OutFile)
    $script:downloaded = $true
    Set-Content -LiteralPath $OutFile -Value 'not executed'
}
function Get-FileHash {
    param($LiteralPath, $Algorithm)
    $hash = if ($Scenario -eq 'checksum') { 'wrong' } else { '05B82D46AD331CC16BDC00DE5C6332C1EF818DF8CEEFCD49C726553209B3A0DA' }
    return [pscustomobject]@{ Hash = $hash }
}
function icacls.exe { $script:acl += $args -join ' '; $global:LASTEXITCODE = 0 }
function Invoke-CockpitServiceWrapper { param($Wrapper, $Action); $script:registered = $true }
function Start-Service {
    param($Name)
    if ($Scenario -eq 'startup') { throw 'test start failure' }
    $script:started = $true
}
function Stop-Service { param($Name); $script:started = $false }
function Set-Service { param($Name, $StartupType); $script:manual = $StartupType -eq 'Manual' }
function Start-Sleep { param($Seconds) }
function Start-Transcript { param($LiteralPath, [switch]$Append) }
function Stop-Transcript {}
function Get-Service {
    param($Name)
    if (-not $script:registered) { return $null }
    $service = [pscustomobject]@{ Name = $Name; Status = $(if ($script:started) { 'Running' } else { 'Stopped' }); StartType = 'Automatic' }
    $service | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value { param($status, $timeout) }
    return $service
}
function Start-Process {
    param($FilePath, $Verb, $WindowStyle, [switch]$Wait, [switch]$PassThru, $ArgumentList)
    if ($FilePath -ne (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')) { throw 'Wrong elevation host.' }
    if ($Verb -ne 'RunAs' -or $WindowStyle -ne 'Hidden') { throw 'Wrong elevation options.' }
    $script:registered = $true
    $script:started = $true
    return [pscustomobject]@{ ExitCode = 0 }
}
$failed = $false
try { Install-CockpitWindowsService -InstallDirectory $target }
catch {
    $failed = $true
    if ($Scenario -eq 'existing' -and $_.Exception.Message -notlike '*already exists*') { throw }
    if ($Scenario -eq 'checksum' -and $_.Exception.Message -notlike '*checksum mismatch*') { throw }
    if ($Scenario -eq 'startup' -and $_.Exception.Message -ne 'test start failure') { throw }
    if ($Scenario -in @('success','elevation')) { throw }
}
if ($Scenario -in @('existing','checksum','startup') -and -not $failed) { throw 'Expected service setup failure.' }
if ($Scenario -eq 'existing' -and $script:downloaded) { throw 'Existing service triggered a download.' }
if ($Scenario -eq 'checksum' -and $script:registered) { throw 'Checksum failure registered service.' }
if ($Scenario -eq 'startup' -and (-not $script:manual -or $script:started)) { throw 'Failed startup did not disable autostart.' }
if ($Scenario -eq 'success') {
    if (-not $script:started) { throw 'Service was not started.' }
    [xml]$config = Get-Content -LiteralPath (Join-Path $target 'HeishaMonCockpitService.xml') -Raw
    if ($config.service.serviceaccount.user -ne 'LocalService' -or $config.service.startmode -ne 'Automatic') { throw 'Unsafe service identity or startup mode.' }
    if ($config.service.executable -ne '%BASE%\Cockpit.Web.exe' -or $config.service.workingdirectory -ne '%BASE%') { throw 'Wrong application path.' }
    if (($script:acl -join "`n") -notmatch 'S-1-5-19:\(OI\)\(CI\)M') { throw 'Missing data modify permission.' }
}
Write-Host "PASS: Windows $Scenario"
exit 0
