import type {
  CategoryConfig,
  CategoryMutationParams,
  ConstantsTableDetailed,
  MutationPlanResult,
  PersistedValuesRecord,
  RatesFlagsCategory,
  RatesFlagsEditableCategoryKey,
  TemplateConstantRowRecord,
} from './categoryTypes.ts'
import { asBooleanYN, asText, normalizeId, rowByHeader } from './shared.ts'
import { columnLetterFromIndex, getHeaderIndex } from './tableParsing.ts'

function buildRowValues<TKey extends RatesFlagsEditableCategoryKey>(
  config: CategoryConfig<TKey>,
  row: Record<string, string>
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of config.fields) {
    values[field.key] = rowByHeader(row, field.headers)
  }
  if (!values.id) values.id = rowByHeader(row, ['ID'])
  if (!values.display_name) {
    values.display_name = rowByHeader(row, ['DisplayName', 'Name', 'Label']) || values.id
  }
  return values
}

function getActiveValueFromRow(row: Record<string, string>) {
  return asBooleanYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']))
}

function validateId(value: string) {
  return /^[A-Z0-9_]+$/.test(value)
}

export function buildCategory<TKey extends RatesFlagsEditableCategoryKey>(
  config: CategoryConfig<TKey>,
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
    tables.length > 0 ? tables.map((table) => table.title).join(' + ') : config.tableTitles[0]
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
      writeDefault: typeof field.writeDefault === 'string' ? field.writeDefault : undefined,
    })),
    rows,
  }
}

function getTargetRow<TKey extends RatesFlagsEditableCategoryKey>(
  table: ConstantsTableDetailed,
  config: CategoryConfig<TKey>,
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

export function buildMutationPlan<TKey extends RatesFlagsEditableCategoryKey>(
  params: CategoryMutationParams<TKey>
): MutationPlanResult {
  const { table, config, request } = params
  const action = request.action
  const activeHeaderIndex = getHeaderIndex(table, ['Active?', 'Active', 'IsActive'])
  const idField = config.fields.find((field) => field.key === 'id')
  if (!idField) return { ok: false, error: 'Invalid category config: missing id field.', status: 500 }

  if (action === 'archive' || action === 'reactivate') {
    const existing = getTargetRow(table, config, request.rowId)
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

  const mutation = request as Extract<
    typeof request,
    { action: 'create' | 'update' }
  >
  const originalId = normalizeId(
    mutation.action === 'update' ? mutation.original_id : mutation.values.id
  ) || normalizeId(mutation.values.id)
  if (!originalId) {
    return { ok: false, error: 'Missing row id.', status: 400 }
  }

  const existing = getTargetRow(table, config, originalId)
  const nextId = normalizeId(mutation.values.id)
  if (!validateId(nextId)) {
    return {
      ok: false,
      error: 'ID must be uppercase snake-case (A-Z, 0-9, underscore).',
      status: 400,
    }
  }
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
      values: [[(mutation.values as Record<string, string>)[field.key] ?? '']],
    })
  }

  if (activeHeaderIndex != null) {
    const col = columnLetterFromIndex(activeHeaderIndex)
    updates.push({
      range: `Constants!${col}${rowNumber}`,
      values: [[mutation.values.active]],
    })
  }

  return { ok: true, updates }
}

export function toStringRecord(value: PersistedValuesRecord | null | undefined) {
  const out: PersistedValuesRecord = {}
  if (!value || typeof value !== 'object') return out
  for (const [key, raw] of Object.entries(value)) {
    out[key] = asText(raw)
  }
  return out
}

export function buildCategoryFromStoredRows<TKey extends RatesFlagsEditableCategoryKey>(
  config: CategoryConfig<TKey>,
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
      writeDefault: typeof field.writeDefault === 'string' ? field.writeDefault : undefined,
    })),
    rows: normalizedRows,
  }
}
