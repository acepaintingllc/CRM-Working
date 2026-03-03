param(
  [Parameter(Mandatory = $true)]
  [string]$Path,

  [int]$MaxRowsToScan = 25
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

function Get-CellText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlElement]$Cell,
    [string[]]$SharedStrings
  )

  $vNode = @($Cell.ChildNodes | Where-Object { $_ -is [System.Xml.XmlElement] -and $_.LocalName -eq "v" } | Select-Object -First 1)
  $vText = if ($vNode) { $vNode.InnerText } else { $null }

  $t = $Cell.GetAttribute("t")
  if ($t -eq "s") {
    if (-not $vText) { return $null }
    $idx = [int]$vText
    if ($idx -ge 0 -and $idx -lt $SharedStrings.Count) { return $SharedStrings[$idx] }
    return $null
  }

  if ($t -eq "inlineStr") {
    $isNode = @($Cell.ChildNodes | Where-Object { $_ -is [System.Xml.XmlElement] -and $_.LocalName -eq "is" } | Select-Object -First 1)
    if (-not $isNode) { return $null }
    $tNode = @($isNode.ChildNodes | Where-Object { $_ -is [System.Xml.XmlElement] -and $_.LocalName -eq "t" } | Select-Object -First 1)
    if ($tNode) { return $tNode.InnerText }
    return $null
  }

  if ($vText) { return [string]$vText }
  return $null
}

function Get-RowCellsInOrder {
  param(
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlElement]$Row
  )

  $cells = @()
  foreach ($c in ($Row.ChildNodes | Where-Object { $_ -is [System.Xml.XmlElement] -and $_.LocalName -eq "c" })) { $cells += $c }

  $cells | Sort-Object {
    $r = $_.r
    if (-not $r) { return 0 }
    # Column letters at the start (e.g. "AA12" => "AA")
    $col = ($r -replace "[0-9]", "")
    $n = 0
    foreach ($ch in $col.ToCharArray()) {
      $n = ($n * 26) + ([int][char]$ch - [int][char]'A' + 1)
    }
    $n
  }
}

if (-not (Test-Path $Path)) { throw "File not found: $Path" }

$fileStream = [System.IO.File]::OpenRead($Path)
try {
  $zip = New-Object System.IO.Compression.ZipArchive($fileStream, [System.IO.Compression.ZipArchiveMode]::Read, $true)
  try {
    $sharedStrings = @()
    $sharedXmlText = Get-ZipEntryText -Zip $zip -EntryPath "xl/sharedStrings.xml"
    if ($sharedXmlText) {
      [xml]$sharedXml = $sharedXmlText
      $sharedNs = New-Object System.Xml.XmlNamespaceManager($sharedXml.NameTable)
      $sharedNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
      $siNodes = @($sharedXml.SelectNodes("//x:sst/x:si", $sharedNs))
      foreach ($si in $siNodes) {
        # Shared string can be <t> or multiple <r><t>
        $tNode = $si.SelectSingleNode("x:t", $sharedNs)
        if ($tNode) { $sharedStrings += $tNode.InnerText; continue }

        $rTNodes = @($si.SelectNodes("x:r/x:t", $sharedNs))
        if ($rTNodes.Count -gt 0) { $sharedStrings += (($rTNodes | ForEach-Object { $_.InnerText }) -join ""); continue }

        $sharedStrings += ""
      }
    }

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

    $results = @()
    foreach ($sheet in $workbookXml.workbook.sheets.sheet) {
      $sheetName = [string]$sheet.GetAttribute("name")
      $rid = [string]$sheet.GetAttribute("r:id")
      $target = $relMap[$rid]
      if (-not $target) { continue }

      # Targets are typically like "worksheets/sheet1.xml"
      $sheetEntryPath = "xl/$target"
      $sheetText = Get-ZipEntryText -Zip $zip -EntryPath $sheetEntryPath
      if (-not $sheetText) { continue }

      [xml]$sheetXml = $sheetText
      $sheetNs = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
      $sheetNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
      $rows = @($sheetXml.SelectNodes("//x:worksheet/x:sheetData/x:row", $sheetNs))

      $headerRow = $null
      $headerCells = @()

      foreach ($row in ($rows | Select-Object -First $MaxRowsToScan)) {
        $cells = Get-RowCellsInOrder -Row $row
        $texts = @()
        foreach ($c in $cells) {
          $txt = Get-CellText -Cell $c -SharedStrings $sharedStrings
          if ($null -ne $txt) { $texts += $txt } else { $texts += "" }
        }

        $nonEmpty = @($texts | Where-Object { $_ -and $_.Trim().Length -gt 0 })
        if ($nonEmpty.Count -ge 2) {
          $headerRow = [int]$row.r
          $headerCells = $texts
          break
        }
      }

      $results += [pscustomobject]@{
        sheet = $sheetName
        headerRow = $headerRow
        headers = $headerCells
      }
    }

    $results | ConvertTo-Json -Depth 6
  } finally {
    $zip.Dispose()
  }
} finally {
  $fileStream.Dispose()
}
