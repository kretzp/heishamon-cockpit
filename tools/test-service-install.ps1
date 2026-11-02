# Isolated command-stub tests; invoked by test-service-install.mjs on Windows.
param([string]$Root, [string]$Helper, [string]$Scenario)
$ErrorActionPreference = 'Stop'
if ($Scenario -in @('prompt-yes', 'prompt-no', 'prompt-empty')) {
    # Execute only the real prompt loop, so the native setup executable is never started.
    $tokens = $null; $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Split-Path $Helper) 'install.ps1'), [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw 'Installer syntax is invalid.' }
    $loop = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.DoUntilStatementAst] }, $true)
    if (-not $loop) { throw 'Installer prompt loop not found.' }
    $script:answerIndex = 0; $script:invalidCount = 0
    $script:answers = @('invalid', 'yesplease', $(if ($Scenario -eq 'prompt-yes') { ' Y ' } elseif ($Scenario -eq 'prompt-no') { ' N ' } else { '' }))
    function Read-Host { param($Prompt); $answer = $script:answers[$script:answerIndex]; $script:answerIndex++; return $answer }
    function Write-Host { param($Message); if ($Message -like 'Invalid value*') { $script:invalidCount++ } }
    . ([scriptblock]::Create($loop.Extent.Text))
    $expected = if ($Scenario -eq 'prompt-yes') { 'y' } elseif ($Scenario -eq 'prompt-no') { 'n' } else { '' }
    if ($serviceAnswer -ne $expected -or $script:invalidCount -ne 2 -or $script:answerIndex -ne 3) { throw 'Prompt did not retry and normalize answers correctly.' }
    Write-Output "PASS: Windows $Scenario"
    exit 0
}
$target = Join-Path $Root 'installed app'
New-Item -ItemType Directory -Path $target,(Join-Path $target 'data') | Out-Null
Set-Content -LiteralPath (Join-Path $target 'Cockpit.Web.exe') -Value 'not executed'
Set-Content -LiteralPath (Join-Path $target 'data/preserved.txt') -Value 'keep application data'
if ($Scenario -eq 'existing-delete') {
    Set-Content -LiteralPath (Join-Path $target 'HeishaMonCockpitService.exe') -Value 'old wrapper'
    Set-Content -LiteralPath (Join-Path $target 'HeishaMonCockpitService.xml') -Value 'old configuration'
}
. $Helper -InstallDirectory $target
$script:registered = $Scenario.StartsWith('existing')
$script:started = $false
$script:downloaded = $false
$script:manual = $false
$script:deleted = $false
$script:readCount = 0
$script:acl = @()
function Read-Host {
    param($Prompt)
    $script:readCount++
    if ($Scenario -eq 'existing-delete') { return 'D' }
    if ($Scenario -in @('existing-start','existing-elevation')) { return 's' }
    if ($Scenario -eq 'existing-stopfail') { return 'd' }
    if ($Scenario -eq 'existing-retry') { if ($script:readCount -eq 1) { return 'invalid' } else { return 'S' } }
    return 'a'
}
function sc.exe { $script:deleted = $true; $script:registered = $false; $global:LASTEXITCODE = 0 }
function Test-CockpitAdministrator { return $Scenario -notin @('elevation','existing-elevation') }
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
function Stop-Service { param($Name); if ($Scenario -eq 'existing-stopfail') { throw 'test stop failure' }; $script:started = $false }
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
    if ($Scenario -eq 'existing-elevation' -and $ArgumentList[-1] -ne 'Start') { throw 'Chosen action was not preserved across elevation.' }
    $script:registered = $true
    $script:started = $true
    return [pscustomobject]@{ ExitCode = 0 }
}
$failed = $false
try { Install-CockpitWindowsService -InstallDirectory $target }
catch {
    $failed = $true
    if ($Scenario -eq 'checksum' -and $_.Exception.Message -notlike '*checksum mismatch*') { throw }
    if ($Scenario -eq 'startup' -and $_.Exception.Message -ne 'test start failure') { throw }
    if ($Scenario -eq 'existing-stopfail' -and $_.Exception.Message -ne 'test stop failure') { throw }
    if ($Scenario -in @('success','elevation','existing','existing-delete','existing-start','existing-retry','existing-elevation')) { throw }
}
if ($Scenario -in @('checksum','startup','existing-stopfail') -and -not $failed) { throw 'Expected service setup failure.' }
if ($Scenario -eq 'existing' -and $script:downloaded) { throw 'Existing service triggered a download.' }
if ($Scenario -eq 'existing' -and ($script:deleted -or $script:started)) { throw 'Abort modified the service.' }
if ($Scenario -eq 'existing-delete' -and (-not $script:deleted -or -not $script:started -or -not $script:downloaded)) { throw 'Delete did not reinstall and start the service.' }
if ($Scenario -in @('existing-start','existing-retry') -and (-not $script:started -or $script:deleted -or $script:downloaded)) { throw 'Start modified or replaced the service.' }
if ($Scenario -eq 'existing-retry' -and $script:readCount -ne 2) { throw 'Invalid service action was not repeated.' }
if ($Scenario -eq 'existing-stopfail' -and ($script:deleted -or $script:downloaded)) { throw 'Service was deleted after stop failure.' }
if ((Get-Content -LiteralPath (Join-Path $target 'data/preserved.txt') -Raw).Trim() -ne 'keep application data') { throw 'Application data was changed.' }
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
