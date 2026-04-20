import type {
  AccessFeeRow,
  ConditionModifierRow,
  MultiplierRow,
  ProductionRateRow,
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsColumnDef,
  RatesFlagsFieldDef,
  RatesFlagsMutationRequest,
  RatesFlagsPayload,
  RatesFlagsRow,
  RoomTemplateRow,
  RoomTypeDefaultRow,
  ScopeDefaultRow,
  SupplyRateRow,
  UnitRateRow,
} from '../../types/estimator/ratesFlags'

async function getSupabaseAdmin() {
  const mod = await import('./org.ts')
  return mod.supabaseAdmin
}

const FALLBACK_TEMPLATE_ID = '1zufQIEtGqP8wZoPjg203TG2HkYS9iSdvBImHC6Ok3Rs'
const CONSTANTS_RANGE = 'Constants!A1:ZZ400'

type FieldConfig = RatesFlagsFieldDef & {
  headers: string[]
  writeDefault?: string | ((values: Record<string, string>) => string)
}

type CategoryConfig = {
  key: RatesFlagsCategoryKey
  tab: RatesFlagsCategory['tab']
  group: RatesFlagsCategory['group']
  label: string
  tableTitles: string[]
  additionalTableTitles?: string[][]
  mergeAdditionalTableTitles?: boolean
  description: string
  columns: RatesFlagsColumnDef[]
  fields: FieldConfig[]
  rowFilter?: (row: Record<string, string>) => boolean
  toRow: (values: Record<string, string>, active: boolean) => RatesFlagsRow
}

type ConstantsTableRow = {
  rowNumber: number
  values: Record<string, string>
}

type ConstantsTableDetailed = {
  key: string
  title: string
  titleRow: number
  headerRow: number
  headers: string[]
  headerIndexes: number[]
  rows: ConstantsTableRow[]
}

type MutationPlanResult =
  | {
      ok: true
      updates: {
        range: string
        values: (string | number | boolean | null)[][]
      }[]
    }
  | { ok: false; error: string; status: number }

type TemplateConstantsRecord = {
  id: string
  org_id: string
  version: number
  seeded_at: string
}

type TemplateConstantRowRecord = {
  id: string
  org_id: string
  template_id: string
  category_key: RatesFlagsCategoryKey
  row_id: string
  display_name: string
  active: 'Y' | 'N'
  sort_order: number
  values_json: Record<string, unknown> | null
}

type AccessFeeCatalogRow = {
  id: string
  label: string
  fee_type: string | null
  amount: number | null
  unit: string | null
  notes: string | null
  active: 'Y' | 'N'
}

type RoomFlagCatalogRow = {
  id: string
  label: string
  wall_factor: number | null
  ceil_factor: number | null
  trim_factor: number | null
  notes: string | null
  active: 'Y' | 'N'
}

type WallComplexityCatalogRow = {
  id: string
  label: string
  labor_multiplier: number | null
  access_fee: number | null
  active: 'Y' | 'N'
}

type CeilingTypeCatalogRow = {
  id: string
  label: string
  labor_mult: number | null
  surcharge_per_sqft: number | null
  notes: string | null
  active: 'Y' | 'N'
}

type HeightFactorCatalogRow = {
  id: string
  label: string
  min_height_ft: number | null
  max_height_ft: number | null
  labor_multiplier: number | null
  notes: string | null
  active: 'Y' | 'N'
}

type ProductionRateCatalogRow = {
  id: string
  label: string
  scope_id: string | null
  surface_type: string | null
  condition: string | null
  prep_sqft_per_hr: number | null
  sqft_per_hr: number | null
  primer_sqft_per_hr: number | null
  notes: string | null
  active: 'Y' | 'N'
}

type AreaSupplyCatalogRow = {
  key: string
  scope: string | null
  unit: string | null
  value: number
  notes: string | null
  active: 'Y' | 'N'
}

export type RatesFlagsCatalogOverlay = {
  template_version: number
  production_rates: ProductionRateCatalogRow[]
  height_factors: HeightFactorCatalogRow[]
  wall_complexity_types: WallComplexityCatalogRow[]
  ceiling_types: CeilingTypeCatalogRow[]
  room_flags: RoomFlagCatalogRow[]
  access_fees: AccessFeeCatalogRow[]
  area_supplies_rates: AreaSupplyCatalogRow[]
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function normalizeKey(value: unknown) {
  return asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeId(value: unknown) {
  return asText(value).toUpperCase()
}

function toYN(value: unknown, fallback: 'Y' | 'N' = 'N') {
  const raw = asText(value).toUpperCase()
  if (raw === 'Y' || raw === 'N') return raw
  return fallback
}

function asBooleanYN(value: unknown) {
  return toYN(value, 'N') === 'Y'
}

function asMaybeNumber(value: unknown) {
  const raw = asText(value)
  if (!raw) return null
  const cleaned = raw.replace(/[$,%\s,]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function constantsTableKey(title: string) {
  return normalizeKey(title)
}

function rowByHeader(row: Record<string, string>, synonyms: string[]) {
  const entries = Object.entries(row)
  for (const synonym of synonyms) {
    const target = normalizeKey(synonym)
    if (!target) continue
    for (const [key, value] of entries) {
      if (normalizeKey(key) === target) return value
    }
  }
  return ''
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
  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < values.length;
    rowIndex += 1
  ) {
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

function findTableDetailed(
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

function findCategoryTablesDetailed(
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

function getHeaderIndex(table: ConstantsTableDetailed, headers: string[]) {
  const wanted = headers.map(normalizeKey)
  for (let i = 0; i < table.headers.length; i += 1) {
    if (wanted.includes(normalizeKey(table.headers[i]))) {
      return table.headerIndexes[i]
    }
  }
  return null
}

function parseSchemaVersion(values: string[][]) {
  for (const row of values) {
    for (let i = 0; i < row.length; i += 1) {
      if (normalizeKey(row[i]) !== 'schemaversion') continue
      const candidate = asText(row[i + 1]) || asText(row[i + 2])
      if (candidate) return candidate
    }
  }
  return ''
}

function columnLetterFromIndex(index: number) {
  let n = index + 1
  let result = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

function isAreaBasedUnit(value: unknown) {
  const raw = asText(value).toLowerCase().replace(/\s+/g, '')
  if (!raw) return false
  if (!raw.includes('$')) return false
  return raw.includes('/sqft') || raw.includes('/sf')
}

function asDisplayName(values: Record<string, string>) {
  return asText(values.display_name) || asText(values.id)
}

function includesAny(raw: string, terms: string[]) {
  const value = raw.toLowerCase()
  return terms.some((term) => value.includes(term))
}

function normalizeProductionScope(value: unknown): 'walls' | 'ceilings' | 'trim' | '' {
  const raw = asText(value).toLowerCase()
  if (!raw) return ''
  if (includesAny(raw, ['wall'])) return 'walls'
  if (includesAny(raw, ['ceil'])) return 'ceilings'
  if (includesAny(raw, ['trim', 'baseboard', 'casing', 'crown', 'wainscot', 'baluster', 'spindle'])) return 'trim'
  return ''
}

const ACCESS_GROUP_BY_ID: Record<string, 'ladders' | 'scaffolding' | 'specialty'> = {
  '26LADDER_EXT': 'ladders',
  SMALL_EXT: 'ladders',
  '10FT_STEP': 'ladders',
  ROLLING_SCAFFOLD_1LVL: 'scaffolding',
  ROLLING_SCAFFOLD_2LVL: 'scaffolding',
}

const SUPPLY_GROUP_BY_ID: Record<string, 'per_color' | 'area_based' | 'per_job'> = {
  BRUSH_WALL: 'per_color',
  TRAY_WALL: 'per_color',
  BRUSH_TRIM: 'per_color',
  MISC_WALL: 'area_based',
  MISC_CEIL: 'area_based',
  BRUSH_CEIL: 'per_job',
  TRAY_CEIL: 'per_job',
  TAPE_MASK: 'per_job',
  DROP_CLOTH: 'per_job',
}

function classifyAccessGroup(row: Record<string, string>): 'ladders' | 'scaffolding' | 'specialty' {
  const id = normalizeId(rowByHeader(row, ['AccessFeeID', 'FeeID', 'ID']))
  if (id && ACCESS_GROUP_BY_ID[id]) return ACCESS_GROUP_BY_ID[id]

  const text = `${rowByHeader(row, ['AccessGroup', 'Group', 'Category'])} ${rowByHeader(row, ['DisplayName', 'FeeName', 'Name', 'Label'])} ${rowByHeader(row, ['AccessFeeID', 'FeeID', 'ID'])}`.toLowerCase()
  if (includesAny(text, ['ladder', 'step ladder', 'extension'])) return 'ladders'
  if (includesAny(text, ['scaffold', 'scaffolding'])) return 'scaffolding'
  return 'specialty'
}

function classifySupplyGroup(row: Record<string, string>): 'per_color' | 'area_based' | 'per_job' {
  const id = normalizeId(rowByHeader(row, ['SupplyID', 'ID', 'Key']))
  if (id && SUPPLY_GROUP_BY_ID[id]) return SUPPLY_GROUP_BY_ID[id]

  const explicitGroup = asText(rowByHeader(row, ['SupplyGroup'])).toLowerCase()
  if (explicitGroup === 'per_color') return 'per_color'
  if (explicitGroup === 'area_based') return 'area_based'
  if (explicitGroup === 'per_job') return 'per_job'
  const unit = asText(rowByHeader(row, ['Unit', 'UOM'])).toLowerCase()
  const text = `${rowByHeader(row, ['DisplayName', 'Name', 'Label'])} ${rowByHeader(row, ['SupplyID', 'ID', 'Key'])} ${unit}`.toLowerCase()
  if (isAreaBasedUnit(unit)) return 'area_based'
  if (includesAny(text, ['per color', 'per-color', '/color', 'percolor'])) return 'per_color'
  return 'per_job'
}

function toYNString(value: string) {
  return toYN(value, 'Y') === 'Y' ? 'Y' : 'N'
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'production_rates_walls',
    tab: 'rates',
    group: 'production_rates',
    label: 'Production Rates - Walls',
    tableTitles: ['CAT_ProductionRates', 'Production Rates'],
    description: 'Sqft/hr production assumptions for wall work.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'scope_id', label: 'Scope' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'surface_type', label: 'Surface Type' },
      { key: 'condition', label: 'Condition' },
      { key: 'prep_sqft_per_hr', label: 'Prep sqft/hr', align: 'right' },
      { key: 'sqft_per_hr', label: 'Paint sqft/hr', align: 'right' },
      { key: 'primer_sqft_per_hr', label: 'Primer sqft/hr', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      {
        key: 'production_scope',
        label: 'Production Scope',
        type: 'select',
        readOnly: true,
        options: ['walls'],
        headers: ['ProductionScope'],
        writeDefault: 'walls',
      },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['RateID', 'ID'] },
      { key: 'scope_id', label: 'Scope', type: 'text', required: true, headers: ['ScopeID', 'Scope'], writeDefault: 'WALLS' },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'surface_type', label: 'Surface Type', type: 'text', headers: ['SurfaceType', 'Surface'] },
      { key: 'condition', label: 'Condition', type: 'text', headers: ['Condition'] },
      { key: 'prep_sqft_per_hr', label: 'Prep sqft/hr', type: 'number', headers: ['PrepSqFtPerHr', 'PrepSqFt/hr', 'Prep Rate'] },
      { key: 'sqft_per_hr', label: 'Paint sqft/hr', type: 'number', required: true, headers: ['SqFtPerHr', 'SqFt/hr', 'Rate'] },
      { key: 'primer_sqft_per_hr', label: 'Primer sqft/hr', type: 'number', headers: ['PrimerSqFtPerHr', 'PrimerSqFt/hr', 'Primer Rate'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      const scope = normalizeProductionScope(rowByHeader(row, ['ScopeID', 'Scope', 'DisplayName', 'Name', 'Label']))
      return scope === '' || scope === 'walls'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        production_scope: 'walls',
        display_name: asDisplayName(values),
        scope_id: asText(values.scope_id) || 'WALLS',
        surface_type: asText(values.surface_type),
        condition: asText(values.condition),
        prep_sqft_per_hr: asText(values.prep_sqft_per_hr),
        sqft_per_hr: asText(values.sqft_per_hr),
        primer_sqft_per_hr: asText(values.primer_sqft_per_hr),
        notes: asText(values.notes),
        active,
      } satisfies ProductionRateRow
    },
  },
  {
    key: 'production_rates_ceilings',
    tab: 'rates',
    group: 'production_rates',
    label: 'Production Rates - Ceilings',
    tableTitles: ['CAT_ProductionRates', 'Production Rates'],
    description: 'Sqft/hr production assumptions for ceiling work.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'scope_id', label: 'Scope' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'surface_type', label: 'Surface Type' },
      { key: 'condition', label: 'Condition' },
      { key: 'prep_sqft_per_hr', label: 'Prep sqft/hr', align: 'right' },
      { key: 'sqft_per_hr', label: 'Paint sqft/hr', align: 'right' },
      { key: 'primer_sqft_per_hr', label: 'Primer sqft/hr', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      {
        key: 'production_scope',
        label: 'Production Scope',
        type: 'select',
        readOnly: true,
        options: ['ceilings'],
        headers: ['ProductionScope'],
        writeDefault: 'ceilings',
      },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['RateID', 'ID'] },
      { key: 'scope_id', label: 'Scope', type: 'text', required: true, headers: ['ScopeID', 'Scope'], writeDefault: 'CEILINGS' },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'surface_type', label: 'Surface Type', type: 'text', headers: ['SurfaceType', 'Surface'] },
      { key: 'condition', label: 'Condition', type: 'text', headers: ['Condition'] },
      { key: 'prep_sqft_per_hr', label: 'Prep sqft/hr', type: 'number', headers: ['PrepSqFtPerHr', 'PrepSqFt/hr', 'Prep Rate'] },
      { key: 'sqft_per_hr', label: 'Paint sqft/hr', type: 'number', required: true, headers: ['SqFtPerHr', 'SqFt/hr', 'Rate'] },
      { key: 'primer_sqft_per_hr', label: 'Primer sqft/hr', type: 'number', headers: ['PrimerSqFtPerHr', 'PrimerSqFt/hr', 'Primer Rate'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      const scope = normalizeProductionScope(rowByHeader(row, ['ScopeID', 'Scope', 'DisplayName', 'Name', 'Label']))
      return scope === 'ceilings'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        production_scope: 'ceilings',
        display_name: asDisplayName(values),
        scope_id: asText(values.scope_id) || 'CEILINGS',
        surface_type: asText(values.surface_type),
        condition: asText(values.condition),
        prep_sqft_per_hr: asText(values.prep_sqft_per_hr),
        sqft_per_hr: asText(values.sqft_per_hr),
        primer_sqft_per_hr: asText(values.primer_sqft_per_hr),
        notes: asText(values.notes),
        active,
      } satisfies ProductionRateRow
    },
  },
  {
    key: 'production_rates_trim',
    tab: 'rates',
    group: 'production_rates',
    label: 'Production Rates - Trim',
    tableTitles: ['CAT_ProductionRates', 'Production Rates'],
    description: 'Units/hr production assumptions for trim work.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'scope_id', label: 'Scope' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'surface_type', label: 'Trim Family' },
      { key: 'condition', label: 'Condition' },
      { key: 'prep_sqft_per_hr', label: 'Prep units/hr', align: 'right' },
      { key: 'sqft_per_hr', label: 'Paint units/hr', align: 'right' },
      { key: 'primer_sqft_per_hr', label: 'Primer units/hr', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      {
        key: 'production_scope',
        label: 'Production Scope',
        type: 'select',
        readOnly: true,
        options: ['trim'],
        headers: ['ProductionScope'],
        writeDefault: 'trim',
      },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['RateID', 'ID'] },
      { key: 'scope_id', label: 'Scope', type: 'text', required: true, headers: ['ScopeID', 'Scope'], writeDefault: 'TRIM' },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'surface_type', label: 'Trim Family', type: 'text', headers: ['SurfaceType', 'Family', 'Surface'] },
      { key: 'condition', label: 'Condition', type: 'text', headers: ['Condition'] },
      { key: 'prep_sqft_per_hr', label: 'Prep units/hr', type: 'number', headers: ['PrepSqFtPerHr', 'PrepSqFt/hr', 'PrepUnitsPerHr', 'Prep Rate'] },
      { key: 'sqft_per_hr', label: 'Paint units/hr', type: 'number', required: true, headers: ['SqFtPerHr', 'SqFt/hr', 'UnitsPerHr', 'Rate'] },
      { key: 'primer_sqft_per_hr', label: 'Primer units/hr', type: 'number', headers: ['PrimerSqFtPerHr', 'PrimerSqFt/hr', 'PrimerUnitsPerHr', 'Primer Rate'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      const scope = normalizeProductionScope(rowByHeader(row, ['ScopeID', 'Scope', 'DisplayName', 'Name', 'Label']))
      return scope === 'trim'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        production_scope: 'trim',
        display_name: asDisplayName(values),
        scope_id: asText(values.scope_id) || 'TRIM',
        surface_type: asText(values.surface_type),
        condition: asText(values.condition),
        prep_sqft_per_hr: asText(values.prep_sqft_per_hr),
        sqft_per_hr: asText(values.sqft_per_hr),
        primer_sqft_per_hr: asText(values.primer_sqft_per_hr),
        notes: asText(values.notes),
        active,
      } satisfies ProductionRateRow
    },
  },
  {
    key: 'unit_rates_doors',
    tab: 'rates',
    group: 'unit_rates',
    label: 'Unit Rates - Doors',
    tableTitles: ['CAT_DoorsInterior', 'CAT_DoorTypes', 'Door Types'],
    additionalTableTitles: [['CAT_DoorsExterior']],
    mergeAdditionalTableTitles: true,
    description: 'Per-unit assumptions for interior/exterior door scope.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'unit_rate_type', label: 'Type' },
      { key: 'unit', label: 'Unit' },
      { key: 'labor_rate', label: 'Labor', align: 'right' },
      { key: 'material_rate', label: 'Material', align: 'right' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'unit_rate_group', label: 'Unit Group', type: 'select', readOnly: true, options: ['doors'], headers: ['UnitRateGroup'], writeDefault: 'doors' },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['DoorTypeID', 'DoorID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'unit_rate_type', label: 'Type', type: 'text', headers: ['Type', 'Category', 'Subtype'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'default_qty', label: 'Default Qty', type: 'number', headers: ['DefaultQty', 'QtyDefault', 'Qty'] },
      { key: 'labor_rate', label: 'Labor', type: 'number', headers: ['LaborRate', 'LaborHours', 'LaborHrs_Each', 'Man_Hours_each', 'Hours_Each'] },
      { key: 'material_rate', label: 'Material', type: 'number', headers: ['MaterialRate', 'Materials$_Each', 'MaterialsEach', 'ExtraSupplies'] },
      { key: 'amount', label: 'Amount', type: 'number', headers: ['Amount', 'Value', 'Rate', 'Cost', 'Price_each'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        unit_rate_group: 'doors',
        display_name: asDisplayName(values),
        unit_rate_type: asText(values.unit_rate_type),
        unit: asText(values.unit),
        default_qty: asText(values.default_qty),
        labor_rate: asText(values.labor_rate),
        material_rate: asText(values.material_rate),
        amount: asText(values.amount),
        notes: asText(values.notes),
        active,
      } satisfies UnitRateRow
    },
  },
  {
    key: 'unit_rates_trim',
    tab: 'rates',
    group: 'unit_rates',
    label: 'Unit Rates - Trim',
    tableTitles: ['CAT_TrimItems'],
    description: 'Per-unit assumptions for trim scope.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'unit_rate_type', label: 'Type' },
      { key: 'unit', label: 'Unit' },
      { key: 'default_qty', label: 'Default Qty', align: 'right' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'unit_rate_group', label: 'Unit Group', type: 'select', readOnly: true, options: ['trim'], headers: ['UnitRateGroup'], writeDefault: 'trim' },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['TrimItemID', 'TrimMenuID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'unit_rate_type', label: 'Type', type: 'text', headers: ['Type', 'Category', 'Variant'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'default_qty', label: 'Default Qty', type: 'number', headers: ['DefaultQty', 'QtyDefault', 'Qty'] },
      { key: 'labor_rate', label: 'Labor', type: 'number', headers: ['LaborRate', 'LaborHours', 'LaborHrs_Each'] },
      { key: 'material_rate', label: 'Material', type: 'number', headers: ['MaterialRate', 'Materials$_Each', 'MaterialsEach'] },
      { key: 'amount', label: 'Amount', type: 'number', headers: ['Amount', 'Value', 'Rate', 'Cost', 'Price_each'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        unit_rate_group: 'trim',
        display_name: asDisplayName(values),
        unit_rate_type: asText(values.unit_rate_type),
        unit: asText(values.unit),
        default_qty: asText(values.default_qty),
        labor_rate: asText(values.labor_rate),
        material_rate: asText(values.material_rate),
        amount: asText(values.amount),
        notes: asText(values.notes),
        active,
      } satisfies UnitRateRow
    },
  },
  {
    key: 'unit_rates_drywall',
    tab: 'rates',
    group: 'unit_rates',
    label: 'Unit Rates - Drywall',
    tableTitles: ['CAT_DrywallRepairs', 'Drywall Repairs'],
    description: 'Per-unit assumptions for drywall repair scope.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'unit_rate_type', label: 'Type' },
      { key: 'unit', label: 'Unit' },
      { key: 'labor_rate', label: 'Labor', align: 'right' },
      { key: 'material_rate', label: 'Material', align: 'right' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'unit_rate_group', label: 'Unit Group', type: 'select', readOnly: true, options: ['drywall'], headers: ['UnitRateGroup'], writeDefault: 'drywall' },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['DrywallRepairID', 'RepairID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'unit_rate_type', label: 'Type', type: 'text', headers: ['Type', 'Category', 'Severity'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'default_qty', label: 'Default Qty', type: 'number', headers: ['DefaultQty', 'QtyDefault', 'Qty'] },
      { key: 'labor_rate', label: 'Labor', type: 'number', headers: ['LaborRate', 'LaborHours', 'LaborHrs_Each', 'Hours_Each'] },
      { key: 'material_rate', label: 'Material', type: 'number', headers: ['MaterialRate', 'Materials$_Each', 'MaterialsEach'] },
      { key: 'amount', label: 'Amount', type: 'number', headers: ['Amount', 'Value', 'Rate', 'Cost'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        unit_rate_group: 'drywall',
        display_name: asDisplayName(values),
        unit_rate_type: asText(values.unit_rate_type),
        unit: asText(values.unit),
        default_qty: asText(values.default_qty),
        labor_rate: asText(values.labor_rate),
        material_rate: asText(values.material_rate),
        amount: asText(values.amount),
        notes: asText(values.notes),
        active,
      } satisfies UnitRateRow
    },
  },
  {
    key: 'access_fees_ladders',
    tab: 'rates',
    group: 'access_fees',
    label: 'Access Fees - Ladders',
    tableTitles: ['CAT_AccessFees', 'Access Fees'],
    description: 'Flat access/setup fees classified as ladders.',
    columns: [
      { key: 'id', label: 'Fee ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'fee_type', label: 'Fee Type' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'unit', label: 'Unit' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'access_group', label: 'Access Group', type: 'select', readOnly: true, options: ['ladders'], headers: ['AccessGroup', 'Group'], writeDefault: 'ladders' },
      { key: 'id', label: 'Fee ID', type: 'text', required: true, headers: ['AccessFeeID', 'FeeID', 'ID'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'FeeName', 'Name', 'Label'] },
      { key: 'fee_type', label: 'Fee Type', type: 'select', options: ['Labor', 'PassThrough', 'Specialty', 'Other'], headers: ['FeeType', 'Type'] },
      { key: 'amount', label: 'Amount', type: 'number', required: true, headers: ['Amount', 'Fee', 'Value', 'Cost'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifyAccessGroup(row) === 'ladders'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        access_group: 'ladders',
        display_name: asDisplayName(values),
        fee_type: asText(values.fee_type),
        amount: asText(values.amount),
        unit: asText(values.unit),
        notes: asText(values.notes),
        active,
      } satisfies AccessFeeRow
    },
  },
  {
    key: 'access_fees_scaffolding',
    tab: 'rates',
    group: 'access_fees',
    label: 'Access Fees - Scaffolding',
    tableTitles: ['CAT_AccessFees', 'Access Fees'],
    description: 'Flat access/setup fees classified as scaffolding.',
    columns: [
      { key: 'id', label: 'Fee ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'fee_type', label: 'Fee Type' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'unit', label: 'Unit' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'access_group', label: 'Access Group', type: 'select', readOnly: true, options: ['scaffolding'], headers: ['AccessGroup', 'Group'], writeDefault: 'scaffolding' },
      { key: 'id', label: 'Fee ID', type: 'text', required: true, headers: ['AccessFeeID', 'FeeID', 'ID'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'FeeName', 'Name', 'Label'] },
      { key: 'fee_type', label: 'Fee Type', type: 'select', options: ['Labor', 'PassThrough', 'Specialty', 'Other'], headers: ['FeeType', 'Type'] },
      { key: 'amount', label: 'Amount', type: 'number', required: true, headers: ['Amount', 'Fee', 'Value', 'Cost'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifyAccessGroup(row) === 'scaffolding'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        access_group: 'scaffolding',
        display_name: asDisplayName(values),
        fee_type: asText(values.fee_type),
        amount: asText(values.amount),
        unit: asText(values.unit),
        notes: asText(values.notes),
        active,
      } satisfies AccessFeeRow
    },
  },
  {
    key: 'access_fees_specialty',
    tab: 'rates',
    group: 'access_fees',
    label: 'Access Fees - Specialty',
    tableTitles: ['CAT_AccessFees', 'Access Fees'],
    description: 'Flat access/setup fees classified as specialty.',
    columns: [
      { key: 'id', label: 'Fee ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'fee_type', label: 'Fee Type' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'unit', label: 'Unit' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'access_group', label: 'Access Group', type: 'select', readOnly: true, options: ['specialty'], headers: ['AccessGroup', 'Group'], writeDefault: 'specialty' },
      { key: 'id', label: 'Fee ID', type: 'text', required: true, headers: ['AccessFeeID', 'FeeID', 'ID'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'FeeName', 'Name', 'Label'] },
      { key: 'fee_type', label: 'Fee Type', type: 'select', options: ['Labor', 'PassThrough', 'Specialty', 'Other'], headers: ['FeeType', 'Type'] },
      { key: 'amount', label: 'Amount', type: 'number', required: true, headers: ['Amount', 'Fee', 'Value', 'Cost'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifyAccessGroup(row) === 'specialty'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        access_group: 'specialty',
        display_name: asDisplayName(values),
        fee_type: asText(values.fee_type),
        amount: asText(values.amount),
        unit: asText(values.unit),
        notes: asText(values.notes),
        active,
      } satisfies AccessFeeRow
    },
  },
  {
    key: 'supply_rates_per_color',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Supply Rates - Per-Color',
    tableTitles: ['CAT_Supplies', 'SUPPLIES RATES', 'Supplies Rates'],
    description: 'Consumables charged by color grouping.',
    columns: [
      { key: 'id', label: 'Supply ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'unit', label: 'Unit' },
      { key: 'cost_per', label: 'Cost', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['per_color'], headers: ['SupplyGroup'], writeDefault: 'per_color' },
      { key: 'id', label: 'Supply ID', type: 'text', required: true, headers: ['SupplyID', 'ID', 'Key'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'scope', label: 'Scope', type: 'text', headers: ['Scope'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'], writeDefault: 'per color' },
      { key: 'cost_per', label: 'Cost', type: 'number', required: true, headers: ['CostPer', 'Value', 'Rate', 'Amount'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifySupplyGroup(row) === 'per_color'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        supply_group: 'per_color',
        display_name: asDisplayName(values),
        scope: asText(values.scope),
        unit: asText(values.unit),
        cost_per: asText(values.cost_per),
        size_in: '',
        price_each: '',
        notes: asText(values.notes),
        active,
      } satisfies SupplyRateRow
    },
  },
  {
    key: 'supply_rates_area_based',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Supply Rates - Area-Based',
    tableTitles: ['CAT_Supplies', 'SUPPLIES RATES', 'Supplies Rates'],
    description: 'Consumables charged by area ($/sqft).',
    columns: [
      { key: 'id', label: 'Supply ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'unit', label: 'Unit' },
      { key: 'cost_per', label: 'Cost', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['area_based'], headers: ['SupplyGroup'], writeDefault: 'area_based' },
      { key: 'id', label: 'Supply ID', type: 'text', required: true, headers: ['SupplyID', 'ID', 'Key'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'scope', label: 'Scope', type: 'text', headers: ['Scope'] },
      { key: 'unit', label: 'Unit', type: 'text', readOnly: true, headers: ['Unit', 'UOM'], writeDefault: '$/sqft' },
      { key: 'cost_per', label: 'Cost', type: 'number', required: true, headers: ['CostPer', 'Value', 'Rate', 'Amount'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifySupplyGroup(row) === 'area_based'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        supply_group: 'area_based',
        display_name: asDisplayName(values),
        scope: asText(values.scope),
        unit: asText(values.unit) || '$/sqft',
        cost_per: asText(values.cost_per),
        size_in: '',
        price_each: '',
        notes: asText(values.notes),
        active,
      } satisfies SupplyRateRow
    },
  },
  {
    key: 'supply_rates_per_job',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Supply Rates - Per-Job',
    tableTitles: ['CAT_Supplies', 'SUPPLIES RATES', 'Supplies Rates'],
    description: 'Consumables charged per job/task/trip.',
    columns: [
      { key: 'id', label: 'Supply ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'unit', label: 'Unit' },
      { key: 'cost_per', label: 'Cost', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['per_job'], headers: ['SupplyGroup'], writeDefault: 'per_job' },
      { key: 'id', label: 'Supply ID', type: 'text', required: true, headers: ['SupplyID', 'ID', 'Key'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'scope', label: 'Scope', type: 'text', headers: ['Scope'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'cost_per', label: 'Cost', type: 'number', required: true, headers: ['CostPer', 'Value', 'Rate', 'Amount'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifySupplyGroup(row) === 'per_job'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        supply_group: 'per_job',
        display_name: asDisplayName(values),
        scope: asText(values.scope),
        unit: asText(values.unit),
        cost_per: asText(values.cost_per),
        size_in: '',
        price_each: '',
        notes: asText(values.notes),
        active,
      } satisfies SupplyRateRow
    },
  },
  {
    key: 'supply_rates_roller_covers',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Supply Rates - Roller Covers',
    tableTitles: ['CAT_RollerCovers'],
    description: 'Roller cover consumables and unit prices.',
    columns: [
      { key: 'id', label: 'Supply ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'size_in', label: 'Size (in)', align: 'right' },
      { key: 'price_each', label: 'Price Each', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['roller_covers'], headers: ['SupplyGroup'], writeDefault: 'roller_covers' },
      { key: 'id', label: 'Supply ID', type: 'text', required: true, headers: ['RollerCoverID', 'ID'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'scope', label: 'Scope', type: 'select', options: ['Wall', 'Ceiling', 'Other'], headers: ['Scope'] },
      { key: 'size_in', label: 'Size (in)', type: 'number', headers: ['Size_in', 'Size'] },
      { key: 'price_each', label: 'Price Each', type: 'number', headers: ['Price_each', 'Price', 'Amount'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        supply_group: 'roller_covers',
        display_name: asDisplayName(values),
        scope: asText(values.scope),
        unit: 'each',
        cost_per: '',
        size_in: asText(values.size_in),
        price_each: asText(values.price_each),
        notes: asText(values.notes),
        active,
      } satisfies SupplyRateRow
    },
  },
  {
    key: 'condition_modifiers',
    tab: 'flags',
    group: 'condition_modifiers',
    label: 'Condition Modifiers',
    tableTitles: ['CAT_RoomFlags', 'Room Flags'],
    description: 'Per-room wall, ceiling, and trim condition modifiers.',
    columns: [
      { key: 'id', label: 'Flag ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'wall_factor', label: 'Wall Factor', align: 'right' },
      { key: 'ceil_factor', label: 'Ceiling Factor', align: 'right' },
      { key: 'trim_factor', label: 'Trim Factor', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Flag ID', type: 'text', required: true, headers: ['FlagID', 'RoomFlagID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'FlagName', 'Name', 'Label'] },
      { key: 'wall_factor', label: 'Wall Factor', type: 'number', headers: ['WallFactor', 'Wall Multiplier'] },
      { key: 'ceil_factor', label: 'Ceiling Factor', type: 'number', headers: ['CeilFactor', 'CeilingFactor', 'Ceiling Multiplier'] },
      { key: 'trim_factor', label: 'Trim Factor', type: 'number', headers: ['TrimFactor', 'Trim Multiplier'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        wall_factor: asText(values.wall_factor),
        ceil_factor: asText(values.ceil_factor),
        trim_factor: asText(values.trim_factor),
        notes: asText(values.notes),
        active,
      } satisfies ConditionModifierRow
    },
  },
  {
    key: 'height_factors',
    tab: 'flags',
    group: 'height_factors',
    label: 'Height Factors',
    tableTitles: ['CAT_HeightFactors', 'Height Factors'],
    description: 'Height-band multipliers.',
    columns: [
      { key: 'id', label: 'Factor ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'primary_value', label: 'Multiplier', align: 'right' },
      { key: 'secondary_value', label: 'Range (ft)' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Height Band ID', type: 'text', required: true, headers: ['HeightBandID', 'HeightFactorID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'min_height_ft', label: 'Min Height (ft)', type: 'number', headers: ['MinHeight_ft', 'MinHeight', 'Min Height'] },
      { key: 'max_height_ft', label: 'Max Height (ft)', type: 'number', headers: ['MaxHeight_ft', 'MaxHeight', 'Max Height'] },
      { key: 'primary_value', label: 'Labor Multiplier', type: 'number', required: true, headers: ['LaborMultiplier', 'Labor Multiplier', 'LaborMult'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      const min = asText(values.min_height_ft)
      const max = asText(values.max_height_ft)
      const rangeLabel = [min, max].filter(Boolean).join(' - ')
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        multiplier_type: 'height_factors',
        primary_label: 'Labor Multiplier',
        primary_value: asText(values.primary_value),
        secondary_label: 'Range (ft)',
        secondary_value: rangeLabel,
        notes: asText(values.notes),
        active,
      } satisfies MultiplierRow
    },
  },
  {
    key: 'wall_complexity',
    tab: 'flags',
    group: 'wall_complexity',
    label: 'Wall Complexity',
    tableTitles: ['CAT_WallComplexity', 'Wall Complexity'],
    description: 'Wall complexity multipliers and access adjustments.',
    columns: [
      { key: 'id', label: 'Complexity ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'primary_value', label: 'Multiplier', align: 'right' },
      { key: 'secondary_value', label: 'Access Fee', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Complexity ID', type: 'text', required: true, headers: ['ComplexityTypeID', 'WallComplexityTypeID', 'TemplateID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Label', 'Name'] },
      { key: 'primary_value', label: 'Labor Multiplier', type: 'number', required: true, headers: ['LaborMultiplier', 'Labor Multiplier', 'LaborMult'] },
      { key: 'secondary_value', label: 'Access Fee', type: 'number', headers: ['AccessFee$', 'AccessFee', 'Access Fee', 'Access Fee $'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        multiplier_type: 'wall_complexity',
        primary_label: 'Labor Multiplier',
        primary_value: asText(values.primary_value),
        secondary_label: 'Access Fee',
        secondary_value: asText(values.secondary_value),
        notes: asText(values.notes),
        active,
      } satisfies MultiplierRow
    },
  },
  {
    key: 'ceiling_types',
    tab: 'flags',
    group: 'ceiling_types',
    label: 'Ceiling Types',
    tableTitles: ['CAT_CeilingTypes', 'Ceiling Types'],
    description: 'Ceiling labor multipliers and surcharge rates.',
    columns: [
      { key: 'id', label: 'Type ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'primary_value', label: 'Multiplier', align: 'right' },
      { key: 'secondary_value', label: 'Surcharge', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Ceiling Type ID', type: 'text', required: true, headers: ['CeilingTypeID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'primary_value', label: 'Labor Multiplier', type: 'number', required: true, headers: ['LaborMult', 'LaborMultiplier', 'LaborFactor'] },
      { key: 'secondary_value', label: 'Surcharge / sqft', type: 'number', headers: ['Surcharge_per_sqft', 'Surcharge'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        multiplier_type: 'ceiling_types',
        primary_label: 'Labor Multiplier',
        primary_value: asText(values.primary_value),
        secondary_label: 'Surcharge / sqft',
        secondary_value: asText(values.secondary_value),
        notes: asText(values.notes),
        active,
      } satisfies MultiplierRow
    },
  },
  {
    key: 'room_types',
    tab: 'room_defaults',
    group: 'room_types',
    label: 'Room Types',
    tableTitles: ['CAT_RoomTypes'],
    description: 'Preset room defaults used when creating room rows.',
    columns: [
      { key: 'id', label: 'Room Type ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'default_wall_rate_id', label: 'Default Wall Rate' },
      { key: 'default_ceil_rate_id', label: 'Default Ceiling Rate' },
      { key: 'default_complexity_id', label: 'Default Complexity' },
      { key: 'default_wall_mode', label: 'Wall Mode' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Room Type ID', type: 'text', required: true, headers: ['RoomTypeID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'default_wall_rate_id', label: 'Default Wall Rate ID', type: 'text', headers: ['DefaultWallRateID', 'WallRateID', 'Wall Rate ID'] },
      { key: 'default_ceil_rate_id', label: 'Default Ceiling Rate ID', type: 'text', headers: ['DefaultCeilRateID', 'CeilRateID', 'Ceiling Rate ID'] },
      { key: 'default_complexity_id', label: 'Default Complexity ID', type: 'text', headers: ['DefaultComplexityID', 'ComplexityTypeID', 'WallComplexityTypeID'] },
      { key: 'default_wall_mode', label: 'Default Wall Mode', type: 'select', options: ['RECT', 'SEG'], headers: ['DefaultWallMode', 'WallMode', 'Wall Mode'] },
      { key: 'top_cut_in_factor', label: 'Top Cut-In Factor', type: 'number', headers: ['TopCutInFactor', 'Top Cut In Factor'] },
      { key: 'bot_cut_in_factor', label: 'Bottom Cut-In Factor', type: 'number', headers: ['BotCutInFactor', 'Bottom Cut In Factor'] },
      { key: 'typical_height_ft', label: 'Typical Height (ft)', type: 'number', headers: ['TypicalHeight_ft', 'DefaultHeight_ft', 'Height_ft'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        default_wall_rate_id: asText(values.default_wall_rate_id),
        default_ceil_rate_id: asText(values.default_ceil_rate_id),
        default_complexity_id: asText(values.default_complexity_id),
        default_wall_mode: asText(values.default_wall_mode),
        top_cut_in_factor: asText(values.top_cut_in_factor),
        bot_cut_in_factor: asText(values.bot_cut_in_factor),
        typical_height_ft: asText(values.typical_height_ft),
        notes: asText(values.notes),
        active,
      } satisfies RoomTypeDefaultRow
    },
  },
  {
    key: 'room_templates',
    tab: 'room_defaults',
    group: 'room_templates',
    label: 'Room Templates',
    tableTitles: ['CAT_RoomTemplates', 'Room Templates'],
    additionalTableTitles: [['CAT_RoomTypes']],
    description: 'Template presets for creating full room scope defaults.',
    columns: [
      { key: 'id', label: 'Template ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'room_type_id', label: 'Room Type' },
      { key: 'default_wall_mode', label: 'Wall Mode' },
      { key: 'include_walls', label: 'Walls' },
      { key: 'include_ceilings', label: 'Ceilings' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Template ID', type: 'text', required: true, headers: ['RoomTemplateID', 'TemplateID', 'RoomTypeID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'TemplateName', 'Name', 'Label'] },
      { key: 'room_type_id', label: 'Room Type ID', type: 'text', headers: ['RoomTypeID', 'TypeID'] },
      { key: 'default_wall_rate_id', label: 'Default Wall Rate ID', type: 'text', headers: ['DefaultWallRateID', 'WallRateID'] },
      { key: 'default_ceil_rate_id', label: 'Default Ceiling Rate ID', type: 'text', headers: ['DefaultCeilRateID', 'CeilRateID'] },
      { key: 'default_complexity_id', label: 'Default Complexity ID', type: 'text', headers: ['DefaultComplexityID', 'ComplexityTypeID', 'WallComplexityTypeID'] },
      { key: 'default_wall_mode', label: 'Default Wall Mode', type: 'select', options: ['RECT', 'SEG'], headers: ['DefaultWallMode', 'WallMode'] },
      { key: 'include_walls', label: 'Include Walls', type: 'select', options: ['Y', 'N'], headers: ['IncludeWalls', 'WallsInclude'], writeDefault: 'Y' },
      { key: 'include_ceilings', label: 'Include Ceilings', type: 'select', options: ['Y', 'N'], headers: ['IncludeCeilings', 'CeilingInclude'], writeDefault: 'N' },
      { key: 'include_trim', label: 'Include Trim', type: 'select', options: ['Y', 'N'], headers: ['IncludeTrim', 'TrimInclude'], writeDefault: 'N' },
      { key: 'include_doors', label: 'Include Doors', type: 'select', options: ['Y', 'N'], headers: ['IncludeDoors', 'DoorsInclude'], writeDefault: 'N' },
      { key: 'include_drywall', label: 'Include Drywall', type: 'select', options: ['Y', 'N'], headers: ['IncludeDrywall', 'DrywallInclude'], writeDefault: 'N' },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        room_type_id: asText(values.room_type_id),
        default_wall_rate_id: asText(values.default_wall_rate_id),
        default_ceil_rate_id: asText(values.default_ceil_rate_id),
        default_complexity_id: asText(values.default_complexity_id),
        default_wall_mode: asText(values.default_wall_mode),
        include_walls: toYNString(asText(values.include_walls)),
        include_ceilings: toYNString(asText(values.include_ceilings)),
        include_trim: toYNString(asText(values.include_trim)),
        include_doors: toYNString(asText(values.include_doors)),
        include_drywall: toYNString(asText(values.include_drywall)),
        notes: asText(values.notes),
        active,
      } satisfies RoomTemplateRow
    },
  },
  {
    key: 'scope_defaults',
    tab: 'room_defaults',
    group: 'scope_defaults',
    label: 'Scope Defaults',
    tableTitles: ['CAT_ScopeDefaults', 'Scope Defaults'],
    additionalTableTitles: [['CAT_RoomTemplates'], ['CAT_RoomTypes']],
    description: 'Default included scopes and wall behavior presets.',
    columns: [
      { key: 'id', label: 'Default ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'default_wall_mode', label: 'Wall Mode' },
      { key: 'typical_height_ft', label: 'Typical Height (ft)', align: 'right' },
      { key: 'include_walls', label: 'Walls' },
      { key: 'include_ceilings', label: 'Ceilings' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Default ID', type: 'text', required: true, headers: ['ScopeDefaultID', 'RoomTemplateID', 'TemplateID', 'RoomTypeID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'TemplateName', 'Name', 'Label'] },
      { key: 'default_wall_mode', label: 'Default Wall Mode', type: 'select', options: ['RECT', 'SEG'], headers: ['DefaultWallMode', 'WallMode'] },
      { key: 'top_cut_in_factor', label: 'Top Cut-In Factor', type: 'number', headers: ['TopCutInFactor', 'Top Cut In Factor'] },
      { key: 'bot_cut_in_factor', label: 'Bottom Cut-In Factor', type: 'number', headers: ['BotCutInFactor', 'Bottom Cut In Factor'] },
      { key: 'typical_height_ft', label: 'Typical Height (ft)', type: 'number', headers: ['TypicalHeight_ft', 'DefaultHeight_ft', 'Height_ft'] },
      { key: 'include_walls', label: 'Include Walls', type: 'select', options: ['Y', 'N'], headers: ['IncludeWalls', 'WallsInclude'], writeDefault: 'Y' },
      { key: 'include_ceilings', label: 'Include Ceilings', type: 'select', options: ['Y', 'N'], headers: ['IncludeCeilings', 'CeilingInclude'], writeDefault: 'N' },
      { key: 'include_trim', label: 'Include Trim', type: 'select', options: ['Y', 'N'], headers: ['IncludeTrim', 'TrimInclude'], writeDefault: 'N' },
      { key: 'include_doors', label: 'Include Doors', type: 'select', options: ['Y', 'N'], headers: ['IncludeDoors', 'DoorsInclude'], writeDefault: 'N' },
      { key: 'include_drywall', label: 'Include Drywall', type: 'select', options: ['Y', 'N'], headers: ['IncludeDrywall', 'DrywallInclude'], writeDefault: 'N' },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        default_wall_mode: asText(values.default_wall_mode),
        top_cut_in_factor: asText(values.top_cut_in_factor),
        bot_cut_in_factor: asText(values.bot_cut_in_factor),
        typical_height_ft: asText(values.typical_height_ft),
        include_walls: toYNString(asText(values.include_walls)),
        include_ceilings: toYNString(asText(values.include_ceilings)),
        include_trim: toYNString(asText(values.include_trim)),
        include_doors: toYNString(asText(values.include_doors)),
        include_drywall: toYNString(asText(values.include_drywall)),
        notes: asText(values.notes),
        active,
      } satisfies ScopeDefaultRow
    },
  },
]

function getCategoryConfig(key: RatesFlagsCategoryKey) {
  return CATEGORY_CONFIGS.find((config) => config.key === key) ?? null
}

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

function buildCategory(
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

function sanitizeMutationValues(config: CategoryConfig, input: Record<string, unknown>) {
  const values: Record<string, string> = {}
  for (const field of config.fields) {
    const raw = asText(input[field.key])
    let next = raw
    if (!next) {
      if (typeof field.writeDefault === 'string') {
        next = field.writeDefault
      }
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
      return {
        ok: false as const,
        error: `${field.label} is required.`,
      }
    }
    if (field.type === 'number' && value) {
      const num = Number(value.replace(/[$,%\s,]/g, ''))
      if (!Number.isFinite(num)) {
        return {
          ok: false as const,
          error: `${field.label} must be a valid number.`,
        }
      }
    }
  }

  for (const field of config.fields) {
    if (typeof field.writeDefault === 'function' && !values[field.key]) {
      values[field.key] = field.writeDefault(values)
    }
  }

  if (config.key === 'area_costs' || config.key === 'supply_rates_area_based') {
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

function buildMutationPlan(params: {
  table: ConstantsTableDetailed
  config: CategoryConfig
  request: RatesFlagsMutationRequest
}): MutationPlanResult {
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
  if (action === 'create') {
    if (existing) {
      return { ok: false, error: `Row '${nextId}' already exists.`, status: 409 }
    }
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
    const nextActive = toYN(
      request.values.active,
      action === 'create' ? 'Y' : 'N'
    )
    updates.push({
      range: `Constants!${col}${rowNumber}`,
      values: [[nextActive]],
    })
  }

  return { ok: true, updates }
}

function resolveTemplateSpreadsheetId() {
  return (
    process.env.GOOGLE_SHEETS_ESTIMATE_V2_TEMPLATE_ID ??
    process.env.GOOGLE_SHEETS_ESTIMATES_TEMPLATE_ID ??
    process.env.GOOGLE_SHEETS_ESTIMATE_TEMPLATE_ID ??
    FALLBACK_TEMPLATE_ID
  )
}

function toStringRecord(value: Record<string, unknown> | null | undefined) {
  const out: Record<string, string> = {}
  if (!value || typeof value !== 'object') return out
  for (const [key, raw] of Object.entries(value)) {
    out[key] = asText(raw)
  }
  return out
}

function buildCategoryFromStoredRows(
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
      if (
        (config.key === 'area_costs' || config.key === 'supply_rates_area_based') &&
        !values.unit
      ) {
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

async function fetchTemplateState(orgId: string) {
  const supabaseAdmin = await getSupabaseAdmin()
  const templateRes = await supabaseAdmin
    .from('estimator_template_constants')
    .select('id, org_id, version, seeded_at')
    .eq('org_id', orgId)
    .maybeSingle()
  if (templateRes.error) throw new Error(templateRes.error.message)
  if (!templateRes.data) {
    return { template: null as TemplateConstantsRecord | null, rows: [] as TemplateConstantRowRecord[] }
  }

  const rowRes = await supabaseAdmin
    .from('estimator_template_constant_rows')
    .select(
      'id, org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json'
    )
    .eq('org_id', orgId)
    .eq('template_id', templateRes.data.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (rowRes.error) throw new Error(rowRes.error.message)

  return {
    template: templateRes.data as TemplateConstantsRecord,
    rows: (rowRes.data ?? []) as TemplateConstantRowRecord[],
  }
}

function parseNumber(value: unknown) {
  const n = asMaybeNumber(value)
  return n == null ? null : n
}

function buildOverlayFromRows(params: {
  templateVersion: number
  rows: TemplateConstantRowRecord[]
}): RatesFlagsCatalogOverlay {
  const grouped = new Map<RatesFlagsCategoryKey, TemplateConstantRowRecord[]>()
  for (const config of CATEGORY_CONFIGS) grouped.set(config.key, [])
  for (const row of params.rows) {
    const existing = grouped.get(row.category_key)
    if (existing) {
      existing.push(row)
      continue
    }
    grouped.set(row.category_key, [row])
  }

  const production_rates: ProductionRateCatalogRow[] = []
  const height_factors: HeightFactorCatalogRow[] = []
  const wall_complexity_types: WallComplexityCatalogRow[] = []
  const ceiling_types: CeilingTypeCatalogRow[] = []
  const room_flags: RoomFlagCatalogRow[] = []
  const access_fees: AccessFeeCatalogRow[] = []
  const area_supplies_rates: AreaSupplyCatalogRow[] = []

  const productionRows = [
    ...(grouped.get('production_rates_walls') ?? []),
    ...(grouped.get('production_rates_ceilings') ?? []),
    ...(grouped.get('production_rates_trim') ?? []),
    ...(grouped.get('production_rates') ?? []),
  ]
  for (const row of productionRows) {
    const values = toStringRecord(row.values_json)
    const scope =
      normalizeProductionScope(values.production_scope || values.scope_id) ||
      normalizeProductionScope(values.display_name)
    const scopeId =
      asText(values.scope_id) ||
      (scope === 'ceilings' ? 'CEILINGS' : scope === 'walls' ? 'WALLS' : scope === 'trim' ? 'TRIM' : '')
    production_rates.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      scope_id: scopeId || null,
      surface_type: asText(values.surface_type) || null,
      condition: asText(values.condition) || null,
      prep_sqft_per_hr: parseNumber(values.prep_sqft_per_hr),
      sqft_per_hr: parseNumber(values.sqft_per_hr),
      primer_sqft_per_hr: parseNumber(values.primer_sqft_per_hr),
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  for (const row of grouped.get('height_factors') ?? []) {
    const values = toStringRecord(row.values_json)
    height_factors.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      min_height_ft: parseNumber(values.min_height_ft),
      max_height_ft: parseNumber(values.max_height_ft),
      labor_multiplier: parseNumber(values.primary_value),
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  for (const row of grouped.get('wall_complexity') ?? []) {
    const values = toStringRecord(row.values_json)
    wall_complexity_types.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      labor_multiplier: parseNumber(values.primary_value),
      access_fee: parseNumber(values.secondary_value),
      active: row.active,
    })
  }

  for (const row of grouped.get('ceiling_types') ?? []) {
    const values = toStringRecord(row.values_json)
    ceiling_types.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      labor_mult: parseNumber(values.primary_value),
      surcharge_per_sqft: parseNumber(values.secondary_value),
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  for (const row of grouped.get('condition_modifiers') ?? []) {
    const values = toStringRecord(row.values_json)
    room_flags.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      wall_factor: parseNumber(values.wall_factor),
      ceil_factor: parseNumber(values.ceil_factor),
      trim_factor: parseNumber(values.trim_factor),
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  const accessRows = [
    ...(grouped.get('access_fees_ladders') ?? []),
    ...(grouped.get('access_fees_scaffolding') ?? []),
    ...(grouped.get('access_fees_specialty') ?? []),
    ...(grouped.get('access_fees') ?? []),
    ...(grouped.get('fixed_fees') ?? []),
  ]
  for (const row of accessRows) {
    const values = toStringRecord(row.values_json)
    access_fees.push({
      id: normalizeId(values.id || row.row_id),
      label: asText(values.display_name) || row.display_name,
      fee_type: asText(values.fee_type) || null,
      amount: parseNumber(values.amount),
      unit: asText(values.unit) || null,
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  const areaSupplyRows = [
    ...(grouped.get('supply_rates_area_based') ?? []),
    ...(grouped.get('area_costs') ?? []),
    ...(grouped.get('supply_rates') ?? []),
  ]
  for (const row of areaSupplyRows) {
    const values = toStringRecord(row.values_json)
    const supplyGroup = asText(values.supply_group).toLowerCase()
    const unit = asText(values.unit) || '$/sqft'
    if (supplyGroup && supplyGroup !== 'area_based' && !isAreaBasedUnit(unit)) continue
    area_supplies_rates.push({
      key: normalizeId(values.id || row.row_id),
      scope: asText(values.scope) || null,
      unit,
      value: parseNumber(values.cost_per) ?? 0,
      notes: asText(values.notes) || null,
      active: row.active,
    })
  }

  return {
    template_version: params.templateVersion,
    production_rates,
    height_factors,
    wall_complexity_types,
    ceiling_types,
    room_flags,
    access_fees,
    area_supplies_rates,
  }
}

async function bumpTemplateVersion(orgId: string, template: TemplateConstantsRecord) {
  const supabaseAdmin = await getSupabaseAdmin()
  const nextVersion = Math.max(1, Number(template.version || 0) + 1)
  const update = await supabaseAdmin
    .from('estimator_template_constants')
    .update({ version: nextVersion })
    .eq('org_id', orgId)
    .eq('id', template.id)
  if (update.error) throw new Error(update.error.message)
}

async function getTemplateRowById(params: {
  orgId: string
  templateId: string
  categoryKey: RatesFlagsCategoryKey
  rowId: string
}) {
  const supabaseAdmin = await getSupabaseAdmin()
  const rowRes = await supabaseAdmin
    .from('estimator_template_constant_rows')
    .select(
      'id, org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json'
    )
    .eq('org_id', params.orgId)
    .eq('template_id', params.templateId)
    .eq('category_key', params.categoryKey)
    .eq('row_id', params.rowId)
    .maybeSingle()
  if (rowRes.error) throw new Error(rowRes.error.message)
  return (rowRes.data ?? null) as TemplateConstantRowRecord | null
}

export async function readRatesFlagsPayload(params: {
  origin: string
  orgId: string
  userId: string
}): Promise<RatesFlagsPayload> {
  void params.origin
  void params.userId
  const state = await fetchTemplateState(params.orgId)
  const rowsByCategory = new Map<RatesFlagsCategoryKey, TemplateConstantRowRecord[]>()
  for (const config of CATEGORY_CONFIGS) rowsByCategory.set(config.key, [])
  for (const row of state.rows) {
    const arr = rowsByCategory.get(row.category_key)
    if (arr) arr.push(row)
  }
  const categories = CATEGORY_CONFIGS.map((config) =>
    buildCategoryFromStoredRows(config, rowsByCategory.get(config.key) ?? [])
  )
  return {
    source: 'db',
    seeded: !!state.template,
    template_version: state.template?.version ?? null,
    categories,
  }
}

export function buildRatesFlagsPayloadFromValues(
  values: string[][],
  spreadsheetId: string
): RatesFlagsPayload {
  const tables = parseConstantsTablesDetailed(values)
  const categories = CATEGORY_CONFIGS.map((config) => {
    const categoryTables = findCategoryTablesDetailed(tables, config)
    return buildCategory(config, categoryTables)
  })
  return {
    source: 'sheet',
    seeded: true,
    template_version: null,
    spreadsheet_id: spreadsheetId,
    schema_version: parseSchemaVersion(values),
    categories,
  }
}

export async function applyRatesFlagsMutation(params: {
  origin: string
  orgId: string
  userId: string
  request: RatesFlagsMutationRequest
}) {
  void params.origin
  void params.userId
  const supabaseAdmin = await getSupabaseAdmin()
  const config = getCategoryConfig(params.request.category)
  if (!config) {
    return { ok: false as const, error: 'Unknown category.', status: 400 }
  }
  const state = await fetchTemplateState(params.orgId)
  if (!state.template) {
    return {
      ok: false as const,
      error: 'Template constants are not seeded yet. Import first.',
      status: 409,
    }
  }

  const originalId = normalizeId(params.request.original_id || asText(params.request.values.id))
  if (!originalId) {
    return { ok: false as const, error: 'Missing row id.', status: 400 }
  }

  try {
    if (params.request.action === 'archive' || params.request.action === 'reactivate') {
      const existing = await getTemplateRowById({
        orgId: params.orgId,
        templateId: state.template.id,
        categoryKey: config.key,
        rowId: originalId,
      })
      if (!existing) return { ok: false as const, error: 'Row not found.', status: 404 }
      const update = await supabaseAdmin
        .from('estimator_template_constant_rows')
        .update({
          active: params.request.action === 'archive' ? 'N' : 'Y',
        })
        .eq('id', existing.id)
      if (update.error) throw new Error(update.error.message)
      await bumpTemplateVersion(params.orgId, state.template)
      return { ok: true as const }
    }

    const sanitized = sanitizeMutationValues(config, params.request.values)
    if (!sanitized.ok) {
      return { ok: false as const, error: sanitized.error, status: 400 }
    }
    const nextId = normalizeId(sanitized.values.id)
    const nextDisplayName =
      asText(sanitized.values.display_name) || asText(sanitized.values.id)
    const nextActive = toYN(
      params.request.values.active,
      params.request.action === 'create' ? 'Y' : 'N'
    ) as 'Y' | 'N'
    const valuesJson = { ...sanitized.values }

    if (params.request.action === 'create') {
      const collision = await getTemplateRowById({
        orgId: params.orgId,
        templateId: state.template.id,
        categoryKey: config.key,
        rowId: nextId,
      })
      if (collision) {
        return {
          ok: false as const,
          error: `Row '${nextId}' already exists.`,
          status: 409,
        }
      }

      const sortRes = await supabaseAdmin
        .from('estimator_template_constant_rows')
        .select('sort_order')
        .eq('org_id', params.orgId)
        .eq('template_id', state.template.id)
        .eq('category_key', config.key)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (sortRes.error) throw new Error(sortRes.error.message)
      const nextSort = (sortRes.data?.[0]?.sort_order ?? -1) + 1

      const insert = await supabaseAdmin.from('estimator_template_constant_rows').insert({
        org_id: params.orgId,
        template_id: state.template.id,
        category_key: config.key,
        row_id: nextId,
        display_name: nextDisplayName,
        active: nextActive,
        sort_order: nextSort,
        values_json: valuesJson,
      })
      if (insert.error) throw new Error(insert.error.message)

      await bumpTemplateVersion(params.orgId, state.template)
      return { ok: true as const }
    }

    if (params.request.action === 'update') {
      const existing = await getTemplateRowById({
        orgId: params.orgId,
        templateId: state.template.id,
        categoryKey: config.key,
        rowId: originalId,
      })
      if (!existing) return { ok: false as const, error: 'Row not found.', status: 404 }

      if (nextId !== originalId) {
        const collision = await getTemplateRowById({
          orgId: params.orgId,
          templateId: state.template.id,
          categoryKey: config.key,
          rowId: nextId,
        })
        if (collision) {
          return {
            ok: false as const,
            error: `Row '${nextId}' already exists.`,
            status: 409,
          }
        }
      }

      const update = await supabaseAdmin
        .from('estimator_template_constant_rows')
        .update({
          row_id: nextId,
          display_name: nextDisplayName,
          active: nextActive,
          values_json: valuesJson,
        })
        .eq('id', existing.id)
      if (update.error) throw new Error(update.error.message)

      await bumpTemplateVersion(params.orgId, state.template)
      return { ok: true as const }
    }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Failed to apply mutation.',
      status: 400,
    }
  }

  return { ok: false as const, error: 'Unsupported mutation action.', status: 400 }
}

export async function seedRatesFlagsFromTemplateSpreadsheet(params: {
  origin: string
  orgId: string
  userId: string
}) {
  const supabaseAdmin = await getSupabaseAdmin()
  const existing = await supabaseAdmin
    .from('estimator_template_constants')
    .select('id')
    .eq('org_id', params.orgId)
    .maybeSingle()
  if (existing.error) {
    return { ok: false as const, error: existing.error.message, status: 400 }
  }
  if (existing.data) {
    return {
      ok: false as const,
      error: 'Template constants are already seeded for this org.',
      status: 409,
    }
  }

  const { readRangeValues } = await import('./googleSheets.ts')
  const spreadsheetId = resolveTemplateSpreadsheetId()
  const constants = await readRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId,
    range: CONSTANTS_RANGE,
    includeEmptyRows: true,
  })
  if ('error' in constants) {
    return {
      ok: false as const,
      error: `Unable to read Constants sheet: ${constants.error}`,
      status: 400,
    }
  }

  const tables = parseConstantsTablesDetailed(constants.values)
  const importedRows: Array<{
    category_key: RatesFlagsCategoryKey
    row_id: string
    display_name: string
    active: 'Y' | 'N'
    sort_order: number
    values_json: Record<string, string>
  }> = []
  const dedupe = new Set<string>()

  try {
    for (const config of CATEGORY_CONFIGS) {
      const categoryTables = findCategoryTablesDetailed(tables, config)
      if (categoryTables.length === 0) continue
      let sort = 0
      for (const table of categoryTables) {
        for (const row of table.rows) {
          const rawValues = buildRowValues(config, row.values)
          if (config.rowFilter && !config.rowFilter(row.values)) continue
          if (!asText(rawValues.id)) continue
          const sanitized = sanitizeMutationValues(config, rawValues)
          if (!sanitized.ok) {
            throw new Error(`${config.label}: ${sanitized.error}`)
          }
          const id = normalizeId(sanitized.values.id)
          if (!validateId(id)) {
            throw new Error(`${config.label}: invalid ID '${id}'.`)
          }
          const dedupeKey = `${config.key}:${id}`
          if (dedupe.has(dedupeKey)) {
            throw new Error(`${config.label}: duplicate ID '${id}'.`)
          }
          dedupe.add(dedupeKey)
          importedRows.push({
            category_key: config.key,
            row_id: id,
            display_name:
              asText(sanitized.values.display_name) || asText(sanitized.values.id),
            active: getActiveValueFromRow(row.values) ? 'Y' : 'N',
            sort_order: sort,
            values_json: sanitized.values,
          })
          sort += 1
        }
      }
    }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Unable to parse Constants sheet.',
      status: 400,
    }
  }

  const createdTemplate = await supabaseAdmin
    .from('estimator_template_constants')
    .insert({
      org_id: params.orgId,
      version: 1,
      seeded_at: new Date().toISOString(),
    })
    .select('id, org_id, version, seeded_at')
    .single()
  if (createdTemplate.error) {
    return { ok: false as const, error: createdTemplate.error.message, status: 400 }
  }

  if (importedRows.length > 0) {
    const insertRows = await supabaseAdmin.from('estimator_template_constant_rows').insert(
      importedRows.map((row) => ({
        org_id: params.orgId,
        template_id: createdTemplate.data.id,
        category_key: row.category_key,
        row_id: row.row_id,
        display_name: row.display_name,
        active: row.active,
        sort_order: row.sort_order,
        values_json: row.values_json,
      }))
    )
    if (insertRows.error) {
      await supabaseAdmin
        .from('estimator_template_constants')
        .delete()
        .eq('org_id', params.orgId)
        .eq('id', createdTemplate.data.id)
      return { ok: false as const, error: insertRows.error.message, status: 400 }
    }
  }

  return { ok: true as const }
}

export async function readLiveRatesFlagsCatalogOverlay(params: { orgId: string }) {
  const state = await fetchTemplateState(params.orgId)
  if (!state.template) return null
  return buildOverlayFromRows({
    templateVersion: state.template.version,
    rows: state.rows,
  })
}

function parseSnapshotPayload(payload: unknown): RatesFlagsCatalogOverlay | null {
  if (!payload || typeof payload !== 'object') return null
  const raw = payload as Record<string, unknown>
  const templateVersion = asMaybeNumber(raw.template_version) ?? null
  if (templateVersion == null) return null
  const pickArray = <T>(key: string) =>
    Array.isArray(raw[key]) ? (raw[key] as T[]) : []
  return {
    template_version: templateVersion,
    production_rates: pickArray<ProductionRateCatalogRow>('production_rates'),
    height_factors: pickArray<HeightFactorCatalogRow>('height_factors'),
    wall_complexity_types: pickArray<WallComplexityCatalogRow>('wall_complexity_types'),
    ceiling_types: pickArray<CeilingTypeCatalogRow>('ceiling_types'),
    room_flags: pickArray<RoomFlagCatalogRow>('room_flags'),
    access_fees: pickArray<AccessFeeCatalogRow>('access_fees'),
    area_supplies_rates: pickArray<AreaSupplyCatalogRow>('area_supplies_rates'),
  }
}

export async function getOrCreateEstimateRatesFlagsCatalogOverlay(params: {
  orgId: string
  estimateId: string
}) {
  const supabaseAdmin = await getSupabaseAdmin()
  const existing = await supabaseAdmin
    .from('estimate_catalog_snapshots')
    .select('template_version, payload_json')
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  if (existing.data) {
    const parsed = parseSnapshotPayload(existing.data.payload_json)
    if (parsed) return parsed
  }

  const live = await readLiveRatesFlagsCatalogOverlay({ orgId: params.orgId })
  if (!live) return null

  const insert = await supabaseAdmin.from('estimate_catalog_snapshots').insert({
    org_id: params.orgId,
    estimate_id: params.estimateId,
    template_version: live.template_version,
    payload_json: live,
  })
  if (insert.error) {
    const lowered = insert.error.message.toLowerCase()
    if (!(lowered.includes('duplicate') || lowered.includes('unique'))) {
      throw new Error(insert.error.message)
    }
  }
  return live
}

export async function createEstimateRatesFlagsCatalogSnapshot(params: {
  orgId: string
  estimateId: string
}) {
  const supabaseAdmin = await getSupabaseAdmin()
  const live = await readLiveRatesFlagsCatalogOverlay({ orgId: params.orgId })
  if (!live) return { ok: true as const, created: false as const }

  const insert = await supabaseAdmin.from('estimate_catalog_snapshots').insert({
    org_id: params.orgId,
    estimate_id: params.estimateId,
    template_version: live.template_version,
    payload_json: live,
  })
  if (insert.error) {
    const lowered = insert.error.message.toLowerCase()
    if (lowered.includes('duplicate') || lowered.includes('unique')) {
      return { ok: true as const, created: false as const }
    }
    return { ok: false as const, error: insert.error.message, status: 400 }
  }
  return { ok: true as const, created: true as const }
}

export const _test = {
  CATEGORY_CONFIGS,
  buildMutationPlan,
  findTableDetailed,
  getHeaderIndex,
  isAreaBasedUnit,
}
