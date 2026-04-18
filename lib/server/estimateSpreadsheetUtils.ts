export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function asNumberish(value: unknown) {
  return value == null || value === '' ? '' : value
}

export function toSheetCell(value: unknown): string | number | boolean | null {
  if (value == null || value === '') return ''
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return String(value)
}

export function toYN(value: unknown, fallback: 'Y' | 'N' = 'N') {
  const raw = String(value ?? '').trim().toUpperCase()
  if (raw === 'Y' || raw === 'N') return raw
  return fallback
}

export function parseSpreadsheetIdFromPath(path: string | null | undefined) {
  const match = /sheet_([a-zA-Z0-9\-_]+)\.xlsx/.exec(String(path ?? ''))
  return match?.[1] ?? null
}

export function buildSheetPath(orgId: string, estimateId: string, spreadsheetId: string) {
  return `org/${orgId}/estimates/${estimateId}/sheet_${spreadsheetId}.xlsx`
}

export function sanitizeDriveName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function columnLetterFromIndex(index: number) {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

export function parseMaybeNumber(value: string | null | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/[$,%\s,]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : raw
}

export function normalizeSummaryLabel(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function findSummaryMetricValue(values: string[][], labelNeedles: string[]) {
  const normalizedNeedles = labelNeedles.map((label) => normalizeSummaryLabel(label))
  const tryParse = (raw: unknown) => parseMaybeNumber(asText(raw))
  const tryNumber = (raw: unknown) => {
    const parsed = tryParse(raw)
    return typeof parsed === 'number' ? parsed : null
  }

  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] ?? []
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const normalizedCell = normalizeSummaryLabel(row[colIndex])
      if (!normalizedCell) continue
      const matches = normalizedNeedles.some((needle) => normalizedCell.includes(needle))
      if (!matches) continue

      const nearbyCandidates: unknown[] = [
        row[colIndex + 1],
        row[colIndex + 2],
        values[rowIndex + 1]?.[colIndex],
        values[rowIndex + 1]?.[colIndex + 1],
        values[rowIndex + 1]?.[colIndex + 2],
        row[colIndex - 1],
      ]

      for (const candidate of nearbyCandidates) {
        const n = tryNumber(candidate)
        if (n != null) return n
      }

      for (const candidate of nearbyCandidates) {
        const parsed = tryParse(candidate)
        if (parsed != null) return parsed
      }
    }
  }

  return null
}

export function findSummaryColAValue(values: string[][], labelNeedles: string[]) {
  const normalizedNeedles = labelNeedles.map((label) => normalizeSummaryLabel(label))
  for (let rowIndex = values.length - 1; rowIndex >= 0; rowIndex -= 1) {
    const row = values[rowIndex] ?? []
    const normalizedA = normalizeSummaryLabel(row[0])
    if (!normalizedA) continue
    const matches = normalizedNeedles.some(
      (needle) => normalizedA === needle || normalizedA.includes(needle)
    )
    if (!matches) continue
    const parsed = parseMaybeNumber(asText(row[1]))
    if (parsed != null) return parsed
  }
  return null
}

export function findSummarySectionRow(values: string[][], sectionTitle: string) {
  const needle = normalizeSummaryLabel(sectionTitle)
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] ?? []
    const normalizedA = normalizeSummaryLabel(row[0])
    if (!normalizedA) continue
    if (normalizedA.includes(needle)) return rowIndex
  }
  return -1
}

export function normalizeHeader(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function normalizeSchemaKey(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function valueAt(row: string[], index: number) {
  if (index < 0 || index >= row.length) return ''
  return row[index] ?? ''
}

