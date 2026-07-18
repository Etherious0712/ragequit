# Zips the extension package into dist/ragequit-extension.zip for Chrome Web
# Store upload. Paths derive from this script's own location ($PSScriptRoot) —
# nothing interpolated from outside, so no injection surface.
#
# Uses .NET ZipArchive with forward-slash entry names on purpose: PowerShell
# 5.1's Compress-Archive writes backslash separators, which violate the ZIP
# spec and make Chrome fail to find files in the icons/ subfolder.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zip = Join-Path $dist 'ragequit-extension.zip'
if (Test-Path $zip) { Remove-Item $zip }

$srcDir = Join-Path $root 'packages\extension'
$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  # ship code + icons only; docs like STORE.md must not go in the store package
  $files = Get-ChildItem -Recurse -File $srcDir | Where-Object { $_.Extension -ne '.md' }
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($srcDir.Length + 1).Replace('\', '/')
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $f.FullName, $rel)
  }
} finally {
  $archive.Dispose()
}
Write-Host "wrote $zip ($($files.Count) files)"
