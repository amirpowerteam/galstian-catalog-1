<#
Apply an update package to this project while preserving important files/folders.
Usage:
  .\update_preserve.ps1 -Source "C:\path\to\update_package" -DryRun:$true

By default this script will copy everything from Source to the current folder,
but will EXCLUDE (preserve) these directories/files:
  - assets\*            (keeps your logos, images)
  - index.html          (keeps your local HTML tweaks)
  - assets\*.b64       (keeps your base64 overrides) -- adjust as needed

Modify $PreserveDirs/$PreserveFiles as needed before running.
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Source,
    [switch]$DryRun
)

if(-not (Test-Path $Source)){
    Write-Error "Source path not found: $Source"; exit 2
}

$cwd = Get-Location
$PreserveDirs = @('assets','backup','.git')
$PreserveFiles = @('index.html')

Write-Host "Applying update from: $Source"
Write-Host "Preserving dirs: $($PreserveDirs -join ', ')"
Write-Host "Preserving files: $($PreserveFiles -join ', ')"

# Build robocopy exclude switches
$xd = $PreserveDirs | ForEach-Object { '"' + $_ + '"' } -join ' '
$xf = $PreserveFiles | ForEach-Object { '"' + $_ + '"' } -join ' '

if($DryRun){ Write-Host "DRY RUN: no files will be overwritten" }

# robocopy: copy from Source -> CWD
# use /MIR to mirror but excluded dirs/files will be preserved
$robocmd = "robocopy `"$Source`" `"$cwd`" /MIR /COPY:DAT /R:2 /W:2 /XD $($PreserveDirs -join ' ') /XF $($PreserveFiles -join ' ')"
Write-Host "Command:" $robocmd

if(-not $DryRun){
    iex $robocmd
    Write-Host "Update applied. Review changes before running the app."
} else {
    Write-Host "Dry run completed. Remove -DryRun to actually apply." 
}
