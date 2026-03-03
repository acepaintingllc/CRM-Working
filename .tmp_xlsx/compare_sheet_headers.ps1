param(
  [Parameter(Mandatory = $true)]
  [string]$ExtractedHeadersJsonPath,

  [Parameter(Mandatory = $true)]
  [string]$EstimateSpreadsheetTsPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-Header([string]$h) {
  if ($null -eq $h) { return "" }
  return $h.Trim()
}

function Extract-QuotedStrings([string]$block) {
  # Extracts '...' and "..." string literals (no escape handling; good enough for these arrays).
  $out = @()
  $pattern = '(\x27([^\x27\r\n]*)\x27|"([^"\r\n]*)")'
  foreach ($m in [regex]::Matches($block, $pattern)) {
    $value = if ($m.Groups[2].Success) { $m.Groups[2].Value } else { $m.Groups[3].Value }
    $out += $value
  }
  return $out
}

function Extract-SheetConfigs([string]$ts) {
  $configs = @{}

  # Extract only the arrays; avoid trying to match the entire object block.
  $pattern = 'sheetName:\s*\x27(?<name>INPUT_[A-Za-z0-9_]+)\x27\s*,[\s\S]*?requiredHeaders:\s*\[(?<req>[\s\S]*?)\]\s*,[\s\S]*?writableHeaders:\s*\[(?<w>[\s\S]*?)\]'
  $rx = New-Object System.Text.RegularExpressions.Regex($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  foreach ($m in $rx.Matches($ts)) {
    $name = $m.Groups["name"].Value
    $required = Extract-QuotedStrings $m.Groups["req"].Value
    $writable = Extract-QuotedStrings $m.Groups["w"].Value
    $configs[$name] = [pscustomobject]@{
      sheet = $name
      requiredHeaders = $required
      writableHeaders = $writable
    }
  }

  return $configs
}

$extracted = Get-Content $ExtractedHeadersJsonPath -Raw | ConvertFrom-Json
$ts = Get-Content $EstimateSpreadsheetTsPath -Raw
$configs = Extract-SheetConfigs $ts

$report = @()

foreach ($entry in $extracted) {
  $sheetName = [string]$entry.sheet
  if ($sheetName -notlike "INPUT_*") { continue }

  $headers = @($entry.headers | ForEach-Object { Normalize-Header $_ } | Where-Object { $_ })
  $headerSet = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($h in $headers) { [void]$headerSet.Add($h) }

  $cfg = $configs[$sheetName]
  $required = @()
  $writable = @()
  if ($cfg) {
    $required = @($cfg.requiredHeaders | ForEach-Object { Normalize-Header $_ } | Where-Object { $_ })
    $writable = @($cfg.writableHeaders | ForEach-Object { Normalize-Header $_ } | Where-Object { $_ })
  }

  $missingRequired = @()
  foreach ($h in $required) { if (-not $headerSet.Contains($h)) { $missingRequired += $h } }

  $missingWritable = @()
  foreach ($h in $writable) { if (-not $headerSet.Contains($h)) { $missingWritable += $h } }

  $extraInSheet = @()
  if ($cfg) {
    $known = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($h in $required) { [void]$known.Add($h) }
    foreach ($h in $writable) { [void]$known.Add($h) }
    foreach ($h in $headers) { if (-not $known.Contains($h)) { $extraInSheet += $h } }
  } else {
    $extraInSheet = $headers
  }

  $report += [pscustomobject]@{
    sheet = $sheetName
    headerRow = $entry.headerRow
    headerCount = $headers.Count
    requiredCount = $required.Count
    writableCount = $writable.Count
    missingRequired = $missingRequired
    missingWritable = $missingWritable
    extraInSheet = $extraInSheet
  }
}

$report | ConvertTo-Json -Depth 8
