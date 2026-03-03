import { readRangeValues } from '@/lib/server/googleSheets'
import { supabaseAdmin } from '@/lib/server/org'

const FALLBACK_TEMPLATE_ID = '1zufQIEtGqP8wZoPjg203TG2HkYS9iSdvBImHC6Ok3Rs'
const CACHE_TTL_MS = 5 * 60 * 1000

type CatalogOption = {
  id: string
  label: string
  active: 'Y' | 'N'
}

type PaintProduct = CatalogOption & {
  type: string
  price_per_gal: number | null
  coverage_sqft_per_gal_per_coat: number | null
  notes: string | null
}

type CeilingType = CatalogOption & {
  labor_mult: number | null
  surcharge_per_sqft: number | null
  notes: string | null
}

type RollerCover = CatalogOption & {
  scope: 'Wall' | 'Ceiling' | 'Other'
  size_in: number | null
  price_each: number | null
  notes: string | null
}

type WallComplexityType = CatalogOption & {
  labor_multiplier: number | null
  access_fee: number | null
}

type TrimItem = CatalogOption & {
  unit: string | null
  notes: string | null
  default_qty: number | null
  is_active: boolean
  category: string | null
  size: string | null
}

type PreJobTrip = CatalogOption & {
  rollup_scope: string | null
  man_trip_name: string
  task: string | null
  trip_num: number | null
  man_qty: number | null
  man_hours_each: number | null
  extra_supplies: number | null
  qty: number | null
  notes: string | null
}

export type ConstantsTable = {
  title: string
  headers: string[]
  rows: Record<string, string>[]
}

export type ConstantsTables = Record<string, ConstantsTable>

type SuppliesRate = {
  key: string
  scope: string | null
  unit: string | null
  value: number
  notes: string | null
}

export type EstimateCatalogs = {
  paint_products: PaintProduct[]
  ceiling_types: CeilingType[]
  wall_complexity_types: WallComplexityType[]
  color_codes: CatalogOption[]
  roller_covers: RollerCover[]
  trim_items: TrimItem[]
  trim_menu_items: TrimItem[]
  prejob_trips: PreJobTrip[]
  supplies_rates: SuppliesRate[]
}

export type EstimateSheetDefaults = {
  override_labor_rate: number | null
  override_markup: number | null
  rounding_increment_hours: number | null
  dayhours: number | null
}

export type EstimateCatalogsResult = {
  spreadsheet_id: string
  schema_version: string
  schema_mismatch: boolean
  defaults: EstimateSheetDefaults
  catalogs: EstimateCatalogs
}

type CachedCatalogs = {
  at: number
  data: EstimateCatalogs
  defaults: EstimateSheetDefaults
}

const catalogCache = new Map<string, CachedCatalogs>()

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asMaybeNumber(value: unknown) {
  const raw = asText(value)
  if (!raw) return null
  const cleaned = raw.replace(/[$,%\s,]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function toYN(value: unknown, fallback: 'Y' | 'N' = 'N') {
  const raw = asText(value).toUpperCase()
  if (raw === 'Y' || raw === 'N') return raw
  return fallback
}

function normalizeKey(value: unknown) {
  return asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function parseSpreadsheetIdFromPath(path: string | null | undefined) {
  const filePathMatch = /sheet_([a-zA-Z0-9\-_]+)\.xlsx/.exec(String(path ?? ''))
  if (filePathMatch?.[1]) return filePathMatch[1]
  const urlMatch = /\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/.exec(String(path ?? ''))
  return urlMatch?.[1] ?? null
}

function constantsTableKey(title: string) {
  return normalizeKey(title)
}

function nonEmptyIndexes(row: string[]) {
  const indexes: number[] = []
  for (let i = 0; i < row.length; i += 1) {
    if (asText(row[i])) indexes.push(i)
  }
  return indexes
}

function isLikelyTableTitle(values: string[][], rowIndex: number) {
  const row = values[rowIndex] ?? []
  const title = asText(row[0])
  if (!title) return false
  if (asMaybeNumber(title) != null) return false

  const rowNonEmptyCount = nonEmptyIndexes(row).length
  if (rowNonEmptyCount > 2) return false

  const headerRow = values[rowIndex + 1] ?? []
  const headerIndexes = nonEmptyIndexes(headerRow)
  if (headerIndexes.length < 1) return false
  if (headerIndexes[0] !== 0) return false

  const headerFirst = asText(headerRow[0])
  if (!headerFirst || normalizeKey(headerFirst).startsWith('cat')) return false
  return true
}

export function parseTableToObjects(values: string[][], titleRowIndex: number): ConstantsTable | null {
  const title = asText(values[titleRowIndex]?.[0])
  if (!title) return null
  const headerRow = values[titleRowIndex + 1] ?? []
  const headerIndexes = nonEmptyIndexes(headerRow)
  if (headerIndexes.length < 1 || headerIndexes[0] !== 0) return null
  const headers = headerIndexes.map((colIdx) => asText(headerRow[colIdx]))
  if (headers.some((h) => !h)) return null

  const rows: Record<string, string>[] = []
  for (let rowIndex = titleRowIndex + 2; rowIndex < values.length; rowIndex += 1) {
    if (rowIndex !== titleRowIndex && isLikelyTableTitle(values, rowIndex)) break
    const row = values[rowIndex] ?? []
    const isBlank = headerIndexes.every((colIdx) => !asText(row[colIdx]))
    if (isBlank) break

    const obj: Record<string, string> = {}
    for (let i = 0; i < headerIndexes.length; i += 1) {
      obj[headers[i]] = asText(row[headerIndexes[i]])
    }
    rows.push(obj)
  }

  return { title, headers, rows }
}

export function loadConstants(values: string[][]): ConstantsTables {
  const tables: ConstantsTables = {}
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    if (!isLikelyTableTitle(values, rowIndex)) continue
    const parsed = parseTableToObjects(values, rowIndex)
    if (!parsed) continue
    tables[constantsTableKey(parsed.title)] = parsed
  }
  return tables
}

export function findTable(constants: ConstantsTables, title: string): ConstantsTable | null {
  const target = constantsTableKey(title)
  if (constants[target]) return constants[target]

  const entries = Object.values(constants)
  const exact = entries.find((table) => constantsTableKey(table.title) === target)
  if (exact) return exact

  const fuzzy = entries.find((table) => constantsTableKey(table.title).includes(target))
  if (fuzzy) return fuzzy
  return null
}

function tableHasAnyHeader(table: ConstantsTable | null | undefined, headers: string[]) {
  if (!table) return false
  const normalized = new Set(table.headers.map((h) => normalizeKey(h)))
  return headers.some((header) => normalized.has(normalizeKey(header)))
}

function rowByHeader(row: Record<string, string>, synonyms: string[]) {
  for (const key of Object.keys(row)) {
    if (synonyms.map((s) => normalizeKey(s)).includes(normalizeKey(key))) {
      return row[key]
    }
  }
  return ''
}

function rowByHeaderPattern(
  row: Record<string, string>,
  matcher: (normalizedHeader: string) => boolean
) {
  for (const key of Object.keys(row)) {
    const normalized = normalizeKey(key)
    if (matcher(normalized)) return row[key]
  }
  return ''
}

function activeTrimRows(constants: ConstantsTables) {
  const trimTable = findTable(constants, 'CAT_TrimItems')
  if (!trimTable) return []
  return trimTable.rows.filter((row) => toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y') === 'Y')
}

export function getTrimCategories(constants: ConstantsTables) {
  return Array.from(
    new Set(
      activeTrimRows(constants)
        .map((row) => asText(rowByHeader(row, ['Category'])))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))
}

export function getTrimVariants(constants: ConstantsTables, category: string) {
  const target = asText(category).toLowerCase()
  return Array.from(
    new Set(
      activeTrimRows(constants)
        .filter((row) => asText(rowByHeader(row, ['Category'])).toLowerCase() === target)
        .map((row) => asText(rowByHeader(row, ['Variant', 'Size', 'Type'])))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))
}

export function getTrimItem(constants: ConstantsTables, category: string, variant: string) {
  const targetCategory = asText(category).toLowerCase()
  const targetVariant = asText(variant).toLowerCase()
  return (
    activeTrimRows(constants).find((row) => {
      const rowCategory = asText(rowByHeader(row, ['Category'])).toLowerCase()
      const rowVariant = asText(rowByHeader(row, ['Variant', 'Size', 'Type'])).toLowerCase()
      return rowCategory === targetCategory && rowVariant === targetVariant
    }) ?? null
  )
}

export function getSuppliesRate(constants: ConstantsTables, scope: string, unit: string) {
  const suppliesTable = findTable(constants, 'SUPPLIES RATES')
  if (!suppliesTable) return 0

  const targetScope = asText(scope).toLowerCase()
  const targetUnit = asText(unit).toLowerCase()
  for (const row of suppliesTable.rows) {
    const rowScope = asText(rowByHeader(row, ['Scope'])).toLowerCase()
    const rowUnit = asText(rowByHeader(row, ['Unit', 'UOM'])).toLowerCase()
    if (rowScope && rowUnit && rowScope === targetScope && rowUnit === targetUnit) {
      return asMaybeNumber(rowByHeader(row, ['Value', 'Rate', 'Amount'])) ?? 0
    }
  }
  return 0
}

function inferTrimCategory(label: string) {
  const l = label.toLowerCase()
  if (l.includes('window') && l.includes('casing')) return 'window_casing'
  if (l.includes('door') && l.includes('casing')) return 'door_casing'
  if (l.includes('baseboard') || l.includes('base board')) return 'baseboard'
  if (l.includes('crown')) return 'crown'
  if (l.includes('door')) return 'door'
  return null
}

function inferTrimSize(label: string) {
  const l = label.toLowerCase()
  if (l.includes('standard') || l.includes('normal')) return 'standard'
  if (l.includes('medium')) return 'medium'
  if (l.includes('large') || l.includes('lg')) return 'large'
  if (l.includes('6 panel') || l.includes('6-panel')) return '6_panel'
  if (l.includes('window') && !l.includes('casing')) return 'window'
  if (l.includes('flat')) return 'flat'
  return null
}

function readSchemaVersionFromConstants(values: string[][]) {
  for (const row of values) {
    for (let i = 0; i < row.length; i += 1) {
      if (normalizeKey(row[i]) !== 'schemaversion') continue
      const candidate = asText(row[i + 1]) || asText(row[i + 2])
      if (candidate) return candidate
    }
  }
  return ''
}

function parseCatalogs(values: string[][]): EstimateCatalogs {
  const constants = loadConstants(values)
  const paintRows = findTable(constants, 'CAT_PaintProducts')?.rows ?? []
  const ceilingRows = findTable(constants, 'CAT_CeilingTypes')?.rows ?? []
  const wallComplexityRows = findTable(constants, 'CAT_WallComplexity')?.rows ?? []
  const rollerRows = findTable(constants, 'CAT_RollerCovers')?.rows ?? []
  const colorRows =
    findTable(constants, 'CAT_ColorCodes')?.rows ??
    findTable(constants, 'COLOR CODES')?.rows ??
    []
  const trimRows = findTable(constants, 'CAT_TrimItems')?.rows ?? []
  const doorTypeRows = findTable(constants, 'CAT_DoorTypes')?.rows ?? []
  const preJobPrimary = findTable(constants, 'CAT_PreJobTrips')
  const preJobTasksTable =
    findTable(constants, 'PRE-JOB TASKS') ??
    findTable(constants, 'PRE JOB TASKS') ??
    findTable(constants, 'PREJOBTASKS')
  const preJobTable = tableHasAnyHeader(preJobPrimary, ['TaskName', 'Task', 'Task Name'])
    ? preJobPrimary
    : preJobTasksTable ?? preJobPrimary
  const preJobRows = preJobTable?.rows ?? []
  const suppliesRows = findTable(constants, 'SUPPLIES RATES')?.rows ?? []

  const paintProducts: PaintProduct[] = paintRows
    .map((row) => ({
      id: asText(rowByHeader(row, ['PaintProductID', 'ID'])),
      label: asText(rowByHeader(row, ['DisplayName', 'Name', 'Label'])),
      type: asText(rowByHeader(row, ['Type'])),
      price_per_gal: asMaybeNumber(rowByHeader(row, ['Price_per_gal', '$/gal', 'Price'])),
      coverage_sqft_per_gal_per_coat: asMaybeNumber(
        rowByHeader(row, ['Coverage_sqft_per_gal_per_coat', 'Coverage'])
      ),
      notes: asText(rowByHeader(row, ['Notes', 'Note'])) || null,
      active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y'),
    }))
    .filter((row) => row.id && row.label && row.active === 'Y')

  const ceilingTypes: CeilingType[] = ceilingRows
    .map((row) => ({
      id: asText(rowByHeader(row, ['CeilingTypeID', 'ID'])),
      label: asText(rowByHeader(row, ['DisplayName', 'Name', 'Label'])),
      labor_mult: asMaybeNumber(rowByHeader(row, ['LaborMult', 'LaborFactor'])),
      surcharge_per_sqft: asMaybeNumber(rowByHeader(row, ['Surcharge_per_sqft', 'Surcharge'])),
      notes: asText(rowByHeader(row, ['Notes', 'Note'])) || null,
      active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y'),
    }))
    .filter((row) => row.id && row.label && row.active === 'Y')

  const wallComplexityTypes: WallComplexityType[] = wallComplexityRows
    .map((row) => ({
      id: asText(rowByHeader(row, ['ComplexityTypeID', 'WallComplexityTypeID', 'TemplateID', 'ID'])).toUpperCase(),
      label:
        asText(rowByHeader(row, ['DisplayName', 'TemplateName', 'Name', 'Label'])) ||
        asText(rowByHeader(row, ['ComplexityTypeID', 'WallComplexityTypeID', 'TemplateID', 'ID'])).toUpperCase(),
      labor_multiplier: asMaybeNumber(rowByHeader(row, ['LaborMultiplier', 'Labor Multiplier'])),
      access_fee: asMaybeNumber(rowByHeader(row, ['AccessFee$', 'AccessFee', 'Access Fee', 'Access Fee $'])),
      active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y'),
    }))
    .filter((row) => row.id && row.label && row.active === 'Y')

  const rollerCovers: RollerCover[] = rollerRows
    .map((row) => {
      const scopeRaw = asText(rowByHeader(row, ['Scope'])).toLowerCase()
      const scope: RollerCover['scope'] =
        scopeRaw === 'wall' ? 'Wall' : scopeRaw === 'ceiling' ? 'Ceiling' : 'Other'
      const sizeText = asText(rowByHeader(row, ['Size_in', 'Size']))
      return {
        id: asText(rowByHeader(row, ['RollerCoverID', 'ID'])),
        label: `${sizeText}" ${scope}`,
        scope,
        size_in: asMaybeNumber(rowByHeader(row, ['Size_in', 'Size'])),
        price_each: asMaybeNumber(rowByHeader(row, ['Price_each', 'Price'])),
        notes: asText(rowByHeader(row, ['Notes', 'Note'])) || null,
        active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y'),
      }
    })
    .filter((row) => row.id && row.active === 'Y')

  const colorCodes: CatalogOption[] = colorRows
    .map((row) => ({
      id: asText(rowByHeader(row, ['ColorID', 'ID'])).toUpperCase(),
      label:
        asText(rowByHeader(row, ['DisplayName', 'Name', 'Label'])) ||
        asText(rowByHeader(row, ['ColorID', 'ID'])).toUpperCase(),
      active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y'),
    }))
    .filter((row) => row.id && row.active === 'Y')

  const trimMenuItems: TrimItem[] = trimRows
    .map((row) => ({
      id: asText(rowByHeader(row, ['TrimItemID', 'TrimMenuID', 'ItemID', 'ID'])),
      label:
        asText(rowByHeader(row, ['DisplayName', 'Name', 'Label'])) ||
        asText(rowByHeader(row, ['TrimItemID', 'TrimMenuID', 'ItemID', 'ID'])),
      unit: asText(rowByHeader(row, ['Unit', 'UOM'])) || null,
      notes: asText(rowByHeader(row, ['Notes', 'Note'])) || null,
      default_qty: asMaybeNumber(rowByHeader(row, ['DefaultQty', 'QtyDefault'])),
      active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y'),
      is_active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y') === 'Y',
      category:
        asText(rowByHeader(row, ['Category'])) ||
        inferTrimCategory(asText(rowByHeader(row, ['DisplayName', 'Name', 'Label']))),
      size:
        asText(rowByHeader(row, ['Variant', 'Size', 'Type'])) ||
        inferTrimSize(asText(rowByHeader(row, ['DisplayName', 'Name', 'Label']))),
    }))
    .filter((row) => row.id && row.active === 'Y')

  const doorMenuItems: TrimItem[] = doorTypeRows
    .map((row) => ({
      id: asText(rowByHeader(row, ['DoorTypeID', 'ID'])),
      label:
        asText(rowByHeader(row, ['DisplayName', 'Name', 'Label'])) ||
        asText(rowByHeader(row, ['DoorTypeID', 'ID'])),
      unit: asText(rowByHeader(row, ['Unit', 'UOM'])) || null,
      notes: asText(rowByHeader(row, ['Notes', 'Note'])) || null,
      default_qty: asMaybeNumber(rowByHeader(row, ['DefaultQty', 'QtyDefault'])),
      active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y'),
      is_active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y') === 'Y',
      category: 'door',
      size:
        asText(rowByHeader(row, ['Variant', 'Size', 'Type'])) ||
        inferTrimSize(asText(rowByHeader(row, ['DisplayName', 'Name', 'Label']))),
    }))
    .filter((row) => row.id && row.active === 'Y')

  const mergedTrimMenuItems = Array.from(
    new Map<string, TrimItem>([
      ...trimMenuItems.map((item) => [item.id, item] as const),
      ...doorMenuItems.map((item) => [item.id, item] as const),
    ]).values()
  )

  const preJobTrips: PreJobTrip[] = preJobRows
    .map((row) => {
      const rollupScope =
        asText(rowByHeader(row, ['RollupScope', 'FollowUpScope', 'FollowupScope', 'Category', 'Scope'])) || null
      const manTripName =
        asText(rowByHeader(row, ['Man_TripName', 'Trip Name', 'TripName', 'Name', 'DisplayName', 'Label'])) || ''
      const task =
        asText(
          rowByHeader(row, [
            'Task',
            'TaskName',
            'Task Name',
            'TemplateTaskName',
            'Template Task Name',
            'TaskLabel',
            'Task Label',
          ])
        ) ||
        asText(
          rowByHeaderPattern(row, (header) =>
            header === 'task' || header.includes('taskname') || header.startsWith('task')
          )
        ) ||
        null
      const idRaw = asText(rowByHeader(row, ['PreJobTripID', 'TripID', 'ID']))
      const fallbackId =
        normalizeKey(`${rollupScope ?? 'other'}-${manTripName || task || ''}`) ||
        normalizeKey(manTripName || task || '')
      const id = idRaw || fallbackId
      return {
        id,
        label:
          task ||
          asText(rowByHeader(row, ['TaskName', 'Task Name'])) ||
          asText(rowByHeader(row, ['DisplayName', 'Label', 'Name'])) ||
          manTripName ||
          id,
        rollup_scope: rollupScope,
        man_trip_name:
          manTripName ||
          task ||
          asText(rowByHeader(row, ['DisplayName', 'Label', 'Name'])) ||
          id,
        task,
        trip_num: asMaybeNumber(rowByHeader(row, ['TripNum', 'Trip #'])),
        man_qty: asMaybeNumber(rowByHeader(row, ['Man_Qty', 'Man Qty'])),
        man_hours_each: asMaybeNumber(rowByHeader(row, ['Man_Hours_each', 'Man Hours Each'])),
        qty: asMaybeNumber(rowByHeader(row, ['Qty', 'Quantity'])),
        extra_supplies: asMaybeNumber(rowByHeader(row, ['ExtraSupplies', 'Extra Supplies'])),
        notes: asText(rowByHeader(row, ['Notes', 'Note'])) || null,
        active: toYN(rowByHeader(row, ['Active?', 'Active', 'IsActive']), 'Y'),
      }
    })
    .filter((row) => row.id && (row.man_trip_name || row.task) && row.active === 'Y')

  const suppliesRates: SuppliesRate[] = suppliesRows
    .map((row) => ({
      key: asText(rowByHeader(row, ['Key', 'ID'])),
      scope: asText(rowByHeader(row, ['Scope'])) || null,
      unit: asText(rowByHeader(row, ['Unit', 'UOM'])) || null,
      value: asMaybeNumber(rowByHeader(row, ['Value', 'Rate', 'Amount'])) ?? 0,
      notes: asText(rowByHeader(row, ['Notes', 'Note'])) || null,
    }))
    .filter((row) => row.key || row.scope || row.unit)

  return {
    paint_products: paintProducts,
    ceiling_types: ceilingTypes,
    wall_complexity_types: wallComplexityTypes,
    color_codes: colorCodes,
    roller_covers: rollerCovers,
    trim_items: mergedTrimMenuItems,
    trim_menu_items: mergedTrimMenuItems,
    prejob_trips: preJobTrips,
    supplies_rates: suppliesRates,
  }
}

function parseSheetDefaults(values: string[][]): EstimateSheetDefaults {
  const constants = loadConstants(values)
  const defaultsTable = findTable(constants, 'JOB DEFAULTS')
  const map = new Map<string, number>()
  for (const row of defaultsTable?.rows ?? []) {
    const key = normalizeKey(rowByHeader(row, ['Key', 'Name', 'ID']))
    const value = asMaybeNumber(rowByHeader(row, ['Value', 'Default', 'Amount']))
    if (key && value != null) map.set(key, value)
  }
  return {
    override_labor_rate: map.get('laborrate') ?? null,
    override_markup: map.get('markup') ?? null,
    rounding_increment_hours: map.get('roundincrementhours') ?? map.get('roundingincrementhours') ?? null,
    dayhours: map.get('dayhours') ?? map.get('workdayhours') ?? null,
  }
}

export async function getEstimateCatalogs(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  forceRefresh?: boolean
}): Promise<EstimateCatalogsResult> {
  const estimateRes = await supabaseAdmin
    .from('estimates')
    .select('id, sheet_file_path, sheet_schema_version')
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
    .maybeSingle()
  if (estimateRes.error) throw new Error(estimateRes.error.message)
  if (!estimateRes.data) throw new Error('Estimate not found')

  const spreadsheetId =
    parseSpreadsheetIdFromPath(estimateRes.data.sheet_file_path) ??
    process.env.GOOGLE_SHEETS_ESTIMATES_TEMPLATE_ID ??
    process.env.GOOGLE_SHEETS_ESTIMATE_TEMPLATE_ID ??
    FALLBACK_TEMPLATE_ID

  const constants = await readRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId,
    range: 'Constants!A1:ZZ400',
  })
  if ('error' in constants) throw new Error(`Unable to read Constants sheet: ${constants.error}`)

  const schemaVersion = readSchemaVersionFromConstants(constants.values)
  if (!schemaVersion) throw new Error('Missing sheet/tab/header: Constants!SchemaVersion not found')

  const cacheKey = `${spreadsheetId}:${schemaVersion}`
  const cached = catalogCache.get(cacheKey)
  if (!params.forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return {
      spreadsheet_id: spreadsheetId,
      schema_version: schemaVersion,
      schema_mismatch:
        !!estimateRes.data.sheet_schema_version &&
        asText(estimateRes.data.sheet_schema_version) !== schemaVersion,
      defaults: cached.defaults,
      catalogs: cached.data,
    }
  }

  const parsed = parseCatalogs(constants.values)
  const defaults = parseSheetDefaults(constants.values)
  catalogCache.set(cacheKey, { at: Date.now(), data: parsed, defaults })

  return {
    spreadsheet_id: spreadsheetId,
    schema_version: schemaVersion,
    schema_mismatch:
      !!estimateRes.data.sheet_schema_version &&
      asText(estimateRes.data.sheet_schema_version) !== schemaVersion,
    defaults,
    catalogs: parsed,
  }
}
