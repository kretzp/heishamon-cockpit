param(
    [string]$SourceDirectory = (Join-Path $env:USERPROFILE ('heishamon-cockpit-source-' + [guid]::NewGuid().ToString('N'))),
    [string]$InstallDirectory
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
    throw 'Run this script in 64-bit PowerShell on Windows x64.'
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git for Windows is required. Install it, open a new PowerShell terminal and retry.'
}
if (-not [System.IO.Path]::IsPathRooted($SourceDirectory)) { throw 'SourceDirectory must be an absolute path.' }
$checkout = [System.IO.Path]::GetFullPath($SourceDirectory)
if (Test-Path -LiteralPath $checkout) { throw 'Source directory already exists; choose a new path.' }
if ($InstallDirectory) {
    if (-not [System.IO.Path]::IsPathRooted($InstallDirectory)) { throw 'InstallDirectory must be an absolute path.' }
    if (Test-Path -LiteralPath $InstallDirectory) { throw 'Installation directory already exists; choose a new path.' }
}
New-Item -ItemType Directory -Path $checkout | Out-Null
Write-Host "Cloning the current master branch into: $checkout"
& git clone --depth 1 --single-branch --branch master -- https://github.com/kretzp/heishamon-cockpit.git $checkout
if ($LASTEXITCODE -ne 0) { throw "Clone failed; source directory preserved at: $checkout" }
$installer = Join-Path $checkout 'installation\install-windows.ps1'
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw 'Source installer is missing from the checkout.' }
Write-Host 'Building the application package and starting interactive installation.'
$installerArguments = @{}
if ($InstallDirectory) { $installerArguments.InstallDirectory = $InstallDirectory }
& $installer @installerArguments
Write-Host "Source checkout retained at: $checkout"
