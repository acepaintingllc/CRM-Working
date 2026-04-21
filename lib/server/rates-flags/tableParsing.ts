import type { CategoryConfig, ConstantsTableDetailed, ConstantsTableRow } from './categoryTypes.ts'
import { asMaybeNumber, asText, normalizeKey } from './shared.ts'

function constantsTableKey(title: string) {
  return normalizeKey(title)
}

function isLikelyColumnHeader(value: string) {
  const normalized = normalizeKey(value)
  if (!normalized) return false
  const headerHints = [
    'id',
    'name',
    'label',
    'type',
    'active',
    'scope',
    'qty',
    'quantity',
    'notes',
    'note',
    'amount',
    'unit',
    'uom',
    'price',
    'coverage',
    'factor',
    'mult',
    'task',
    'trip',
    'category',
    'value',
    'key',
    'default',
    'coats',
    'mode',
    'height',
    'length',
    'width',
    'room',
    'color',
    'size',
    'rate',
  ]
  return headerHints.some((hint) => normalized.includes(hint))
}

function nonEmptyIndexes(row: string[]) {
  const indexes: number[] = []
  for (let i = 0; i < row.length; i += 1) {
    if (asText(row[i])) indexes.push(i)
  }
  return indexes
}

function findHeaderRowIndex(values: string[][], titleRowIndex: number): number {
  for (let offset = 1; offset <= 3; offset += 1) {
    const candidate = values[titleRowIndex + offset] ?? []
    const idx = nonEmptyIndexes(candidate)
    if (idx.length >= 2 && idx[0] === 0) return titleRowIndex + offset
    if (idx.length === 0) break
  }
  return titleRowIndex + 1
}

function isLikelyTableTitle(values: string[][], rowIndex: number) {
  const row = values[rowIndex] ?? []
  const title = asText(row[0])
  if (!title) return false
  if (asMaybeNumber(title) != null) return false

  const rowNonEmptyCount = nonEmptyIndexes(row).length
  if (rowNonEmptyCount > 2) return false

  const headerRowIndex = findHeaderRowIndex(values, rowIndex)
  const headerRow = values[headerRowIndex] ?? []
  const headerIndexes = nonEmptyIndexes(headerRow)
  if (headerIndexes.length < 1) return false
  if (headerIndexes[0] !== 0) return false

  const headerLabels = headerIndexes
    .map((idx) => asText(headerRow[idx]))
    .filter(Boolean)
  const headerLikeCount = headerLabels.filter((label) =>
    isLikelyColumnHeader(label)
  ).length
  if (headerLikeCount < 1) return false
  if (headerLabels.length >= 2 && headerLikeCount < 2) return false

  const headerFirst = asText(headerRow[0])
  if (!headerFirst || normalizeKey(headerFirst).startsWith('cat')) return false
  return true
}

function parseDetailedTable(
  values: string[][],
  titleRowIndex: number
): ConstantsTableDetailed | null {
  const title = asText(values[titleRowIndex]?.[0])
  if (!title) return null

  const headerRowIndex = findHeaderRowIndex(values, titleRowIndex)
  const headerRow = values[headerRowIndex] ?? []
  const headerIndexes = nonEmptyIndexes(headerRow)
  if (headerIndexes.length < 1 || headerIndexes[0] !== 0) return null
  const headers = headerIndexes.map((idx) => asText(headerRow[idx]))
  if (headers.some((h) => !h)) return null

  const rows: ConstantsTableRow[] = []
  for (let rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex += 1) {
    if (rowIndex !== titleRowIndex && isLikelyTableTitle(values, rowIndex)) break
    const row = values[rowIndex] ?? []
    const isBlank = headerIndexes.every((colIdx) => !asText(row[colIdx]))
    if (isBlank) break

    const obj: Record<string, string> = {}
    for (let i = 0; i < headerIndexes.length; i += 1) {
      obj[headers[i]] = asText(row[headerIndexes[i]])
    }
    rows.push({ rowNumber: rowIndex + 1, values: obj })
  }

  return {
    key: constantsTableKey(title),
    title,
    titleRow: titleRowIndex + 1,
    headerRow: headerRowIndex + 1,
    headers,
    headerIndexes,
    rows,
  }
}

export function parseConstantsTablesDetailed(values: string[][]) {
  const tables: ConstantsTableDetailed[] = []
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    if (!isLikelyTableTitle(values, rowIndex)) continue
    const parsed = parseDetailedTable(values, rowIndex)
    if (!parsed) continue
    tables.push(parsed)
  }
  return tables
}

export function findTableDetailed(
  tables: ConstantsTableDetailed[],
  candidates: string[]
): ConstantsTableDetailed | null {
  const candidateKeys = candidates.map(constantsTableKey)
  for (const key of candidateKeys) {
    const exact = tables.find((table) => table.key === key)
    if (exact) return exact
  }
  for (const key of candidateKeys) {
    const fuzzy = tables.find(
      (table) => table.key.includes(key) || key.includes(table.key)
    )
    if (fuzzy) return fuzzy
  }
  return null
}

export function findCategoryTablesDetailed(
  tables: ConstantsTableDetailed[],
  config: CategoryConfig
) {
  const titleSets = [config.tableTitles, ...(config.additionalTableTitles ?? [])]
  const found: ConstantsTableDetailed[] = []
  const seen = new Set<string>()
  for (const titleSet of titleSets) {
    const table = findTableDetailed(tables, titleSet)
    if (!table) continue
    const key = `${table.titleRow}:${table.key}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push(table)
    if (!config.mergeAdditionalTableTitles) break
  }
  return found
}

export function getHeaderIndex(table: ConstantsTableDetailed, headers: string[]) {
  const wanted = headers.map(normalizeKey)
  for (let i = 0; i < table.headers.length; i += 1) {
    if (wanted.includes(normalizeKey(table.headers[i]))) {
      return table.headerIndexes[i]
    }
  }
  return null
}

export function parseSchemaVersion(values: string[][]) {
  for (const row of values) {
    for (let i = 0; i < row.length; i += 1) {
      if (normalizeKey(row[i]) !== 'schemaversion') continue
      const candidate = asText(row[i + 1]) || asText(row[i + 2])
      if (candidate) return candidate
    }
  }
  return ''
}

export function columnLetterFromIndex(index: number) {
  let n = index + 1
  let result = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}
