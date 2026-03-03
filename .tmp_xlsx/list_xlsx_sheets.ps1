param(
  [Parameter(Mandatory = $true)]
  [string]$Path
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
  if (-not $entry) { return $null }
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
    $workbookText = Get-ZipEntryText -Zip $zip -EntryPath "xl/workbook.xml"
    if (-not $workbookText) { throw "Missing xl/workbook.xml" }
    [xml]$workbookXml = $workbookText

    $relsText = Get-ZipEntryText -Zip $zip -EntryPath "xl/_rels/workbook.xml.rels"
    if (-not $relsText) { throw "Missing xl/_rels/workbook.xml.rels" }
    [xml]$relsXml = $relsText

    $relMap = @{}
    foreach ($rel in $relsXml.Relationships.Relationship) {
      $relMap[[string]$rel.Id] = [string]$rel.Target
    }

    $out = @()
    foreach ($sheet in $workbookXml.workbook.sheets.sheet) {
      $name = [string]$sheet.GetAttribute("name")
      $rid = [string]$sheet.GetAttribute("r:id")
      $target = $relMap[$rid]
      $out += [pscustomobject]@{
        sheet = $name
        rid = $rid
        entry = if ($target) { "xl/$target" } else { $null }
      }
    }

    $out | ConvertTo-Json -Depth 4
  } finally {
    $zip.Dispose()
  }
} finally {
  $fileStream.Dispose()
}

