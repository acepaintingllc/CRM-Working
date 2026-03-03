param(
  [Parameter(Mandatory = $true)]
  [string]$XlsxPath,

  [Parameter(Mandatory = $true)]
  [string]$EstimateSpreadsheetTsPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

trap {
  $inv = $_.InvocationInfo
  if ($inv) {
    $lineText = ""
    if ($null -ne $inv.Line) { $lineText = [string]$inv.Line }
    Write-Host ("verify_sheet_start_rows.ps1 failed at line {0}: {1}" -f $inv.ScriptLineNumber, $lineText.Trim())
  }
  throw $_
}

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

function Normalize-Header([string]$value) {
  if ($null -eq $value) { return "" }
  return ($value.ToLower() -replace '[^a-z0-9]', '')
}

function Get-AnyCount($value) {
  if ($null -eq $value) { return 0 }
  if ($value -is [System.Array]) { return $value.Length }
  if ($value -is [System.Collections.ICollection]) { return $value.Count }
  return 1
}

function Extract-QuotedStrings([string]$block) {
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

  # Capture requiredHeaders, writableHeaders, and optional minStartRow.
  $rx = New-Object System.Text.RegularExpressions.Regex(
    'sheetName:\s*\x27(?<name>INPUT_[A-Za-z0-9_]+)\x27\s*,[\s\S]*?requiredHeaders:\s*\[(?<req>[\s\S]*?)\]\s*,[\s\S]*?writableHeaders:\s*\[(?<w>[\s\S]*?)\](?<tail>[\s\S]*?)(?=\n\s*\}\s*,|\n\s*\}\s*\])',
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )

  foreach ($m in $rx.Matches($ts)) {
    $name = $m.Groups["name"].Value
    $required = Extract-QuotedStrings $m.Groups["req"].Value
    $writable = Extract-QuotedStrings $m.Groups["w"].Value
    $tail = $m.Groups["tail"].Value
    $minStartRow = $null
    $minMatch = [regex]::Match($tail, 'minStartRow:\s*(?<n>\d+)', [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if ($minMatch.Success) { $minStartRow = [int]$minMatch.Groups["n"].Value }

    $configs[$name] = [pscustomobject]@{
      sheet = $name
      requiredHeaders = $required
      writableHeaders = $writable
      minStartRow = $minStartRow
    }
  }

  return $configs
}

function Get-SharedStrings([System.IO.Compression.ZipArchive]$zip) {
  $sharedStrings = @()
  $sharedXmlText = Get-ZipEntryText -Zip $zip -EntryPath "xl/sharedStrings.xml"
  if (-not $sharedXmlText) { return $sharedStrings }
  [xml]$sharedXml = $sharedXmlText
  $ns = New-Object System.Xml.XmlNamespaceManager($sharedXml.NameTable)
  $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  $siNodes = @($sharedXml.SelectNodes("//x:sst/x:si", $ns))
  foreach ($si in $siNodes) {
    $tNode = $si.SelectSingleNode("x:t", $ns)
    if ($tNode) { $sharedStrings += $tNode.InnerText; continue }
    $rTNodes = @($si.SelectNodes("x:r/x:t", $ns))
    if ($rTNodes.Count -gt 0) { $sharedStrings += (($rTNodes | ForEach-Object { $_.InnerText }) -join ""); continue }
    $sharedStrings += ""
  }
  return $sharedStrings
}

function Get-CellText([System.Xml.XmlElement]$cell, [string[]]$sharedStrings) {
  $t = $cell.GetAttribute("t")
  $vNode = @($cell.ChildNodes | Where-Object { $_ -is [System.Xml.XmlElement] -and $_.LocalName -eq "v" } | Select-Object -First 1)
  $vText = if ($vNode) { $vNode.InnerText } else { $null }

  if ($t -eq "s") {
    if (-not $vText) { return "" }
    $idx = [int]$vText
    if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) { return [string]$sharedStrings[$idx] }
    return ""
  }

  if ($t -eq "inlineStr") {
    $isNode = @($cell.ChildNodes | Where-Object { $_ -is [System.Xml.XmlElement] -and $_.LocalName -eq "is" } | Select-Object -First 1)
    if (-not $isNode) { return "" }
    $tNode = @($isNode.ChildNodes | Where-Object { $_ -is [System.Xml.XmlElement] -and $_.LocalName -eq "t" } | Select-Object -First 1)
    if ($tNode) { return [string]$tNode.InnerText }
    return ""
  }

  if ($vText) { return [string]$vText }
  return ""
}

function ColIndexFromCellRef([string]$r) {
  if (-not $r) { return 0 }
  $col = ($r -replace "[0-9]", "")
  $n = 0
  foreach ($ch in $col.ToCharArray()) {
    $n = ($n * 26) + ([int][char]$ch - [int][char]'A' + 1)
  }
  return $n - 1
}

function Get-RowArray([System.Xml.XmlElement]$row, [string[]]$sharedStrings) {
  $cells = @($row.ChildNodes | Where-Object { $_ -is [System.Xml.XmlElement] -and $_.LocalName -eq "c" })
  if (-not $cells.Count) { return @() }
  $maxCol = ($cells | ForEach-Object { ColIndexFromCellRef $_.GetAttribute("r") } | Measure-Object -Maximum).Maximum
  $arr = New-Object 'System.Collections.Generic.List[string]'
  for ($i = 0; $i -le $maxCol; $i += 1) { [void]$arr.Add("") }
  foreach ($c in $cells) {
    $idx = ColIndexFromCellRef $c.GetAttribute("r")
    $txt = (Get-CellText $c $sharedStrings).Trim()
    if ($idx -ge 0 -and $idx -lt $arr.Count) { $arr[$idx] = $txt }
  }
  return ,$arr.ToArray()
}

function Find-HeadersLikeApp([System.Xml.XmlDocument]$sheetXml, [string[]]$requiredHeaders, [string[]]$writableHeaders, [string[]]$sharedStrings) {
  $requiredHeaders = @($requiredHeaders)
  $writableHeaders = @($writableHeaders)
  $requiredCount = Get-AnyCount $requiredHeaders
  $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
  $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  $rows = @($sheetXml.SelectNodes("//x:worksheet/x:sheetData/x:row", $ns))

  $best = $null
  $bestScore = -1

  for ($i = 0; $i -lt $rows.Length; $i += 1) {
    $rowArr = Get-RowArray $rows[$i] $sharedStrings
    if (-not $rowArr.Length) { continue }

    $indexByHeader = @{}
    $indexByNormalized = @{}
    for ($col = 0; $col -lt $rowArr.Length; $col += 1) {
      $cell = $rowArr[$col]
      if (-not $cell) { continue }
      if (-not $indexByHeader.ContainsKey($cell)) { $indexByHeader[$cell] = $col }
      $norm = Normalize-Header $cell
      if ($norm -and -not $indexByNormalized.ContainsKey($norm)) { $indexByNormalized[$norm] = $col }
    }

    $getIndex = {
      param([string]$h)
      if ($indexByHeader.ContainsKey($h)) { return $indexByHeader[$h] }
      $n = Normalize-Header $h
      if ($indexByNormalized.ContainsKey($n)) { return $indexByNormalized[$n] }
      return $null
    }

    $requiredMatched = 0
    foreach ($h in $requiredHeaders) { if ($null -ne (& $getIndex $h)) { $requiredMatched += 1 } }
    $search = if ($requiredCount -gt 0) { $requiredHeaders } else { $writableHeaders }
    $matchedWritable = 0
    foreach ($h in $search) { if ($null -ne (& $getIndex $h)) { $matchedWritable += 1 } }

    if ($requiredCount -gt 0 -and $requiredMatched -ne $requiredCount) { continue }
    if ($requiredCount -eq 0 -and $matchedWritable -lt 2) { continue }

    if ($matchedWritable -gt $bestScore) {
      $bestScore = $matchedWritable
      $best = [pscustomobject]@{
        headerRow = $i + 1
        startRow = $i + 2
        matchedHeaders = $matchedWritable
      }
    }
  }

  return $best
}

if (-not (Test-Path $XlsxPath)) { throw "File not found: $XlsxPath" }
if (-not (Test-Path $EstimateSpreadsheetTsPath)) { throw "File not found: $EstimateSpreadsheetTsPath" }

$ts = Get-Content $EstimateSpreadsheetTsPath -Raw
$configs = Extract-SheetConfigs $ts

$fileStream = [System.IO.File]::OpenRead($XlsxPath)
try {
  $zip = New-Object System.IO.Compression.ZipArchive($fileStream, [System.IO.Compression.ZipArchiveMode]::Read, $true)
  try {
    $sharedStrings = Get-SharedStrings $zip

    [xml]$workbookXml = Get-ZipEntryText -Zip $zip -EntryPath "xl/workbook.xml"
    [xml]$relsXml = Get-ZipEntryText -Zip $zip -EntryPath "xl/_rels/workbook.xml.rels"
    $relMap = @{}
    foreach ($rel in $relsXml.Relationships.Relationship) { $relMap[[string]$rel.Id] = [string]$rel.Target }

    $out = @()
    foreach ($sheet in $workbookXml.workbook.sheets.sheet) {
      $sheetName = [string]$sheet.GetAttribute("name")
      if ($sheetName -notlike "INPUT_*") { continue }

      $cfg = $configs[$sheetName]
      if (-not $cfg) { continue }

      $rid = [string]$sheet.GetAttribute("r:id")
      $target = $relMap[$rid]
      if (-not $target) { continue }

      $sheetText = Get-ZipEntryText -Zip $zip -EntryPath ("xl/$target")
      if (-not $sheetText) { continue }
      [xml]$sheetXml = $sheetText

      $found = Find-HeadersLikeApp $sheetXml $cfg.requiredHeaders $cfg.writableHeaders $sharedStrings
      if (-not $found) {
        $out += [pscustomobject]@{
          sheet = $sheetName
          headerRow = $null
          startRow = $null
          matchedHeaders = 0
          minStartRow = $cfg.minStartRow
          effectiveStartRow = $null
        }
        continue
      }

      $effective = $found.startRow
      if ($null -ne $cfg.minStartRow) { $effective = [Math]::Max($effective, [int]$cfg.minStartRow) }
      $out += [pscustomobject]@{
        sheet = $sheetName
        headerRow = $found.headerRow
        startRow = $found.startRow
        matchedHeaders = $found.matchedHeaders
        minStartRow = $cfg.minStartRow
        effectiveStartRow = $effective
      }
    }

    $out | Sort-Object sheet | ConvertTo-Json -Depth 6
  } finally {
    $zip.Dispose()
  }
} finally {
  $fileStream.Dispose()
}
