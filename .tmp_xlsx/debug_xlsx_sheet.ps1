param(
  [Parameter(Mandatory = $true)]
  [string]$Path,

  [Parameter(Mandatory = $true)]
  [string]$WorksheetEntryPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

function Get-ZipEntryText {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.Compression.ZipArchive]$Zip,
    [Parameter(Mandatory = $true)]
    [string]$EntryPath
  )

  $entry = $Zip.GetEntry($EntryPath)
  if (-not $entry) { throw "Missing entry: $EntryPath" }
  $stream = $entry.Open()
  try {
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $true)
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
  } finally {
    $stream.Dispose()
  }
}

$fileStream = [System.IO.File]::OpenRead($Path)
try {
  $zip = New-Object System.IO.Compression.ZipArchive($fileStream, [System.IO.Compression.ZipArchiveMode]::Read, $true)
  try {
    $text = Get-ZipEntryText -Zip $zip -EntryPath $WorksheetEntryPath
    [xml]$sheetXml = $text
    $rows = @($sheetXml.SelectNodes("//worksheet/sheetData/row") | Select-Object -First 20)
    $out = @()
    foreach ($row in $rows) {
      $r = $row.GetAttribute("r")
      $cells = @($row.SelectNodes("c"))
      $cellSummary = $cells | ForEach-Object {
        $addr = $_.GetAttribute("r")
        $t = $_.GetAttribute("t")
        $v = $_.SelectSingleNode("v")
        $f = $_.SelectSingleNode("f")
        $vText = if ($v) { [string]$v.InnerText } else { "" }
        $fText = if ($f) { [string]$f.InnerText } else { "" }
        "$addr`t=$t`tv=$vText`tf=$fText"
      }
      $out += [pscustomobject]@{
        row = $r
        cells = $cellSummary
      }
    }

    $out | ConvertTo-Json -Depth 6
  } finally {
    $zip.Dispose()
  }
} finally {
  $fileStream.Dispose()
}
