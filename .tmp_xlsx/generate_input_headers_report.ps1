param(
  [Parameter(Mandatory = $true)]
  [string]$ExtractedHeadersJsonPath,

  [Parameter(Mandatory = $true)]
  [string]$OutMarkdownPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$data = Get-Content $ExtractedHeadersJsonPath -Raw | ConvertFrom-Json

$lines = @()
$lines += "# Workbook input tab headers"
$lines += ""
$lines += "Source: $ExtractedHeadersJsonPath"
$lines += ""

foreach ($sheet in ($data | Where-Object { $_.sheet -like 'INPUT_*' } | Sort-Object sheet)) {
  $name = [string]$sheet.sheet
  $row = $sheet.headerRow
  $headers = @($sheet.headers | ForEach-Object { if ($null -eq $_) { '' } else { ([string]$_).Trim() } } | Where-Object { $_ })

  $lines += "## $name"
  $lines += ""
  $lines += "- Header row: $row"
  $lines += "- Columns: $($headers.Count)"
  $lines += ""
  $lines += "| # | Header | Notes |"
  $lines += "|---:|---|---|"
  for ($i = 0; $i -lt $headers.Count; $i += 1) {
    $h = $headers[$i]
    $note = if ($h -match "\\(calc\\)" ) { "calc" } else { "" }
    $escaped = $h -replace '\|', '\|'
    $lines += "| $($i+1) | $escaped | $note |"
  }
  $lines += ""
}

$dir = Split-Path -Parent $OutMarkdownPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$lines -join "`r`n" | Out-File -Encoding utf8 $OutMarkdownPath
