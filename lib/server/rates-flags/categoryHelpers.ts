import type {
  CategoryConfig,
  CategoryMutationParams,
  ConstantsTableDetailed,
  MutationPlanResult,
  RatesFlagsCategory,
  TemplateConstantRowRecord,
} from './categoryTypes.ts'
import { asBooleanYN, asText, normalizeId, rowByHeader } from './shared.ts'
import { columnLetterFromIndex, getHeaderIndex } from './tableParsing.ts'

function buildRowValues(
  config: CategoryConfig,
  row: Record<string, string>
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of config.fields) {
    values[field.key] = rowByHeader(row, field.headers)
  }
  if (!values.id) values.id = rowByHeader(row, ['ID'])
  if (!values.display_name) {
    values.display_name =
      rowByHeader(row, ['DisplayName', 'Name', 'Label']) || values.id
  }
  return values
}

function getActiveValueFromRow(row: Record<string, string>) {
  return asBooleanYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']))
}

export function buildCategory(
  config: CategoryConfig,
  tables: ConstantsTableDetailed[]
): RatesFlagsCategory {
  const rows = tables
    .flatMap((table) => table.rows)
    .filter((row) => (config.rowFilter ? config.rowFilter(row.values) : true))
    .map((row) => {
      const values = buildRowValues(config, row.values)
      const active = getActiveValueFromRow(row.values)
      return config.toRow(values, active)
    })

  const tableTitle =
    tables.length > 0
      ? tables.map((table) => table.title).join(' + ')
      : config.tableTitles[0]
  return {
    key: config.key,
    tab: config.tab,
    group: config.group,
    label: config.label,
    table_title: tableTitle,
    description: config.description,
    columns: config.columns,
    fields: config.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      readOnly: field.readOnly,
      helperText: field.helperText,
      options: field.options,
    })),
    rows,
  }
}

function validateId(value: string) {
  return /^[A-Z0-9_]+$/.test(value)
}

export function sanitizeMutationValues(config: CategoryConfig, input: Record<string, unknown>) {
  const values: Record<string, string> = {}
  for (const field of config.fields) {
    const raw = asText(input[field.key])
    let next = raw
    if (!next && typeof field.writeDefault === 'string') {
      next = field.writeDefault
    }
    values[field.key] = next
  }

  const id = normalizeId(values.id)
  values.id = id
  if (!id) return { ok: false as const, error: 'ID is required.' }
  if (!validateId(id)) {
    return {
      ok: false as const,
      error: 'ID must be uppercase snake-case (A-Z, 0-9, underscore).',
    }
  }

  for (const field of config.fields) {
    const value = values[field.key]
    if (field.required && !value) {
      return { ok: false as const, error: `${field.label} is required.` }
    }
    if (field.type === 'number' && value) {
      const num = Number(value.replace(/[$,%\s,]/g, ''))
      if (!Number.isFinite(num)) {
        return { ok: false as const, error: `${field.label} must be a valid number.` }
      }
    }
  }

  for (const field of config.fields) {
    if (typeof field.writeDefault === 'function' && !values[field.key]) {
      values[field.key] = field.writeDefault(values)
    }
  }

  if (config.key === 'supply_rates_area_based') {
    values.unit = '$/sqft'
  }

  return { ok: true as const, values }
}

function getTargetRow(
  table: ConstantsTableDetailed,
  config: CategoryConfig,
  id: string
) {
  const idField = config.fields.find((field) => field.key === 'id')
  if (!idField) return null
  const target = normalizeId(id)
  return (
    table.rows.find((row) => {
      const candidate = normalizeId(rowByHeader(row.values, idField.headers))
      return candidate === target
    }) ?? null
  )
}

export function buildMutationPlan(params: CategoryMutationParams): MutationPlanResult {
  const { table, config, request } = params
  const action = request.action
  const activeHeaderIndex = getHeaderIndex(table, ['Active?', 'Active', 'IsActive'])
  const idField = config.fields.find((field) => field.key === 'id')
  if (!idField) return { ok: false, error: 'Invalid category config: missing id field.', status: 500 }

  const originalId = normalizeId(request.original_id || asText(request.values.id))
  if (!originalId) {
    return { ok: false, error: 'Missing row id.', status: 400 }
  }

  const existing = getTargetRow(table, config, originalId)

  if (action === 'archive' || action === 'reactivate') {
    if (!existing) return { ok: false, error: 'Row not found.', status: 404 }
    if (activeHeaderIndex == null) {
      return { ok: false, error: `Missing Active column in ${table.title}.`, status: 400 }
    }
    const col = columnLetterFromIndex(activeHeaderIndex)
    return {
      ok: true,
      updates: [
        {
          range: `Constants!${col}${existing.rowNumber}`,
          values: [[action === 'archive' ? 'N' : 'Y']],
        },
      ],
    }
  }

  const sanitized = sanitizeMutationValues(config, request.values)
  if (!sanitized.ok) {
    return { ok: false, error: sanitized.error, status: 400 }
  }

  const nextId = normalizeId(sanitized.values.id)
  if (action === 'create' && existing) {
    return { ok: false, error: `Row '${nextId}' already exists.`, status: 409 }
  }
  if (action === 'update') {
    if (!existing) return { ok: false, error: 'Row not found.', status: 404 }
    if (nextId !== originalId) {
      const collision = getTargetRow(table, config, nextId)
      if (collision) {
        return { ok: false, error: `Row '${nextId}' already exists.`, status: 409 }
      }
    }
  }

  const rowNumber =
    action === 'create'
      ? table.rows.length > 0
        ? table.rows[table.rows.length - 1].rowNumber + 1
        : table.headerRow + 1
      : existing!.rowNumber

  const updates: {
    range: string
    values: (string | number | boolean | null)[][]
  }[] = []
  for (const field of config.fields) {
    const headerIndex = getHeaderIndex(table, field.headers)
    if (headerIndex == null) {
      if (field.required) {
        return {
          ok: false,
          error: `Missing required header '${field.headers[0]}' in ${table.title}.`,
          status: 400,
        }
      }
      continue
    }
    const col = columnLetterFromIndex(headerIndex)
    updates.push({
      range: `Constants!${col}${rowNumber}`,
      values: [[sanitized.values[field.key] ?? '']],
    })
  }

  if (activeHeaderIndex != null) {
    const col = columnLetterFromIndex(activeHeaderIndex)
    const nextActive = request.values.active === 'Y' || request.values.active === 'N'
      ? request.values.active
      : action === 'create'
        ? 'Y'
        : 'N'
    updates.push({
      range: `Constants!${col}${rowNumber}`,
      values: [[nextActive]],
    })
  }

  return { ok: true, updates }
}

export function toStringRecord(value: Record<string, unknown> | null | undefined) {
  const out: Record<string, string> = {}
  if (!value || typeof value !== 'object') return out
  for (const [key, raw] of Object.entries(value)) {
    out[key] = asText(raw)
  }
  return out
}

export function buildCategoryFromStoredRows(
  config: CategoryConfig,
  rows: TemplateConstantRowRecord[]
): RatesFlagsCategory {
  const normalizedRows = rows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.row_id.localeCompare(b.row_id))
    .map((row) => {
      const values = toStringRecord(row.values_json)
      if (!values.id) values.id = row.row_id
      if (!values.display_name) values.display_name = row.display_name
      if (config.key === 'supply_rates_area_based' && !values.unit) {
        values.unit = '$/sqft'
      }
      return {
        values,
        active: row.active === 'Y',
      }
    })
    .map((entry) => config.toRow(entry.values, entry.active))

  return {
    key: config.key,
    tab: config.tab,
    group: config.group,
    label: config.label,
    table_title: config.tableTitles[0],
    description: config.description,
    columns: config.columns,
    fields: config.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      readOnly: field.readOnly,
      helperText: field.helperText,
      options: field.options,
    })),
    rows: normalizedRows,
  }
}
