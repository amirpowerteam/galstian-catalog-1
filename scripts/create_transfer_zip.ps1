# Creates a zip archive of the project one level up (galstian-project.zip)
# Usage: run from project root PowerShell prompt

$root = Get-Location
$destZip = Join-Path $root.Parent.FullName 'galstian-project.zip'
$temp = Join-Path $root '._tmp_zip'

# Clean temp
if(Test-Path $temp){ Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

# Copy files to temp; include everything so transfer retains state
Write-Host "Copying project files to temp folder..."
robocopy $root $temp /MIR /COPY:DAT /R:2 /W:2 /XD .git node_modules backup .vs

Write-Host "Creating zip: $destZip"
if(Test-Path $destZip){ Remove-Item $destZip -Force }
Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $destZip -Force

# Clean temp
Remove-Item $temp -Recurse -Force
Write-Host "Created $destZip"

# Recommend checksum
$hash = Get-FileHash -Path $destZip -Algorithm SHA256
Write-Host "SHA256:" $hash.Hash
