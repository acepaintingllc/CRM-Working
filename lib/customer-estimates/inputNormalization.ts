import type {
  CompanyProfile,
  CustomerEstimatePricingSummary,
  CustomerEstimateSectionKey,
  Unsafe,
} from './types.ts'
import type { QuoteTermsSections } from './termsDefaults.ts'
import {
  asNum,
  asText,
  humanizeIdentifier,
  humanizeRoomCode,
  labelOrFallback,
} from './buildShared.ts'
import type {
  CustomerVisibleAllocationScopeKey,
  HiddenCustomerFee,
} from './hiddenFeeAllocation.ts'

export type CustomerEstimateRow = Unsafe
export type CustomerEstimateCatalogs = {
  paint_products?: CustomerEstimateRow[]
  trim_items?: CustomerEstimateRow[]
  door_types?: CustomerEstimateRow[]
}

export type NormalizedEstimateMeta = {
  id: string
  version_name: string
  version_state: string
  created_at: string
  updated_at: string
}

export type NormalizedJobRecord = {
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  estimate_date: string
}

export type NormalizedCustomerRecord = {
  name: string
  email: string
  phone: string
  address: string
  street: string
  city: string
  state: string
  zip: string
}

export type NormalizedRoomRow = {
  roomId: string
  roomLabel: string
}

export type NormalizedPaintScopeRow = {
  roomId: string
  included: boolean
  price: number
  paintProductId: string
  paintProductLabel: string
  notes: string[]
  coatCount: number | null
  primeMode: 'SPOT' | 'FULL' | null
}

export type NormalizedTrimScopeRow = {
  roomId: string
  included: boolean
  trimId: string
  trimLabel: string
  family: string
  price: number
  paintProductId: string
  paintProductLabel: string
  notes: string[]
  coats: number | null
  primeMode: 'SPOT' | 'FULL' | null
}

export type NormalizedTrimItemRow = {
  roomId: string
  trimId: string
  trimLabel: string
  family: string
  price: number
  paintProductId: string
  paintProductLabel: string
  notes: string[]
  coats: number | null
  primeMode: 'SPOT' | 'FULL' | null
}

export type NormalizedDoorScopeRow = {
  roomId: string
  included: boolean
  doorId: string
  doorLabel: string
  price: number
  paintProductId: string
  paintProductLabel: string
  notes: string[]
  coats: number | null
  primeMode: 'SPOT' | 'FULL' | null
}

export type NormalizedDrywallScopeRow = {
  roomId: string
  included: boolean
  repairLabel: string
  surface: string
  unit: string
  quantity: number | null
  price: number
  notes: string[]
}

export type NormalizedOtherRow = {
  description: string
  location: string
  qty: number
  uom: string
  price: number
}

export type NormalizedPaintCatalogRow = {
  id: string
  displayId: string
  label: string
}

export type NormalizedTrimCatalogRow = {
  id: string
  label: string
  family: string
  category: string
}

export type NormalizedDoorCatalogRow = {
  id: string
  label: string
}

export type NormalizedJobSettings = {
  wallPaintProductId: string
  ceilingPaintProductId: string
  trimPaintProductId: string
}

export interface CustomerEstimateInput {
  estimate: CustomerEstimateRow
  job: CustomerEstimateRow
  customer?: CustomerEstimateRow | null
  company: CompanyProfile
  inputs: {
    rooms?: CustomerEstimateRow[]
    room_wall_scopes?: CustomerEstimateRow[]
    room_ceiling_scopes?: CustomerEstimateRow[]
    room_trim_scopes?: CustomerEstimateRow[]
    room_door_scopes?: CustomerEstimateRow[]
    drywall_repairs?: CustomerEstimateRow[]
    access_fees?: CustomerEstimateRow[]
    prejob?: CustomerEstimateRow[]
    trim_items?: CustomerEstimateRow[]
    other?: CustomerEstimateRow[]
    jobsettings?: CustomerEstimateRow | null
    org_defaults?: CustomerEstimateRow | null
  }
  catalogs?: CustomerEstimateCatalogs | null
  settings?: {
    quote_validity_days?: number | null
    terms_font_size?: number | null
    terms_text?: string | null
    terms_sections?: QuoteTermsSections | null
    default_template_key?: string | null
  }
  pricingSummary?: CustomerEstimatePricingSummary | null
  overrides?: {
    title?: string
    intro_paragraph?: string
    closing_paragraph?: string
    scope_text_edits?: Partial<Record<CustomerEstimateSectionKey, string>>
    quote_validity_days?: number | string | null
    deposit_language?: string
    card_fee_note?: string
  }
  publicMeta?: {
    status?: string
    sent_at?: string | null
    viewed_at?: string | null
    accepted_at?: string | null
    declined_at?: string | null
    public_token?: string | null
  }
}

export type NormalizedCustomerEstimateInput = {
  estimate: NormalizedEstimateMeta
  job: NormalizedJobRecord
  customer: NormalizedCustomerRecord | null
  company: CompanyProfile
  rooms: NormalizedRoomRow[]
  roomWallScopes: NormalizedPaintScopeRow[]
  roomCeilingScopes: NormalizedPaintScopeRow[]
  roomTrimScopes: NormalizedTrimScopeRow[]
  roomDoorScopes: NormalizedDoorScopeRow[]
  roomDrywallScopes: NormalizedDrywallScopeRow[]
  trimItems: NormalizedTrimItemRow[]
  otherRows: NormalizedOtherRow[]
  hiddenFees: HiddenCustomerFee[]
  jobsettings: NormalizedJobSettings
  paintCatalogRows: NormalizedPaintCatalogRow[]
  trimCatalogRows: NormalizedTrimCatalogRow[]
  doorCatalogRows: NormalizedDoorCatalogRow[]
  pricingSummary: CustomerEstimatePricingSummary | null
  settings: CustomerEstimateInput['settings']
  overrides: CustomerEstimateInput['overrides']
  publicMeta: CustomerEstimateInput['publicMeta']
}

function rowsOf(input: unknown): Unsafe[] {
  return Array.isArray(input) ? input.filter((row): row is Unsafe => !!row && typeof row === 'object') : []
}

function normalizePrimeMode(value: unknown) {
  const mode = asText(value).toUpperCase()
  if (mode === 'FULL' || mode === 'SPOT') return mode
  return null
}

function normalizeEstimateMeta(row: CustomerEstimateRow): NormalizedEstimateMeta {
  return {
    id: asText(row.id),
    version_name: asText(row.version_name),
    version_state: asText(row.version_state),
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  }
}

function normalizeJobRecord(row: CustomerEstimateRow): NormalizedJobRecord {
  return {
    customer_name: asText(row.customer_name),
    customer_email: asText(row.customer_email),
    customer_phone: asText(row.customer_phone),
    customer_address: asText(row.customer_address),
    estimate_date: asText(row.estimate_date),
  }
}

function normalizeCustomerRecord(row: CustomerEstimateRow | null | undefined): NormalizedCustomerRecord | null {
  if (!row || typeof row !== 'object') return null
  return {
    name: asText(row.name),
    email: asText(row.email),
    phone: asText(row.phone),
    address: asText(row.address),
    street: asText(row.street),
    city: asText(row.city),
    state: asText(row.state),
    zip: asText(row.zip),
  }
}

function normalizeRoomRow(row: CustomerEstimateRow): NormalizedRoomRow | null {
  const roomId = asText(row.room_id).toUpperCase()
  if (!roomId) return null
  return {
    roomId,
    roomLabel: labelOrFallback(row.room_name, humanizeRoomCode(roomId)),
  }
}

function normalizePaintScopeRow(
  row: CustomerEstimateRow,
  prepKeys: string[],
  coatKeys: string[]
): NormalizedPaintScopeRow {
  return {
    roomId: asText(row.room_id).toUpperCase(),
    included: asText(row.active || row.include).toUpperCase() !== 'N',
    price:
      asNum(row.effective_total) ??
      asNum(row.final_total) ??
      asNum(row.raw_total) ??
      asNum(row.override_total) ??
      0,
    paintProductId: asText(row.paint_product_id).toUpperCase(),
    paintProductLabel: asText(row.paint_product_label),
    notes: prepKeys.map((key) => asText(row[key])).filter(Boolean),
    coatCount: coatKeys.map((key) => asNum(row[key])).find((value) => value != null) ?? null,
    primeMode: normalizePrimeMode(row.prime_mode),
  }
}

function normalizeTrimScopeRow(
  row: CustomerEstimateRow,
  trimCatalogById: Map<string, NormalizedTrimCatalogRow>
): NormalizedTrimScopeRow {
  const trimId = asText(row.trim_type_id || row.trim_menu_id).toUpperCase()
  const catalogMatch = trimCatalogById.get(trimId)
  return {
    roomId: asText(row.room_id).toUpperCase(),
    included: asText(row.active || row.include).toUpperCase() !== 'N',
    trimId,
    trimLabel:
      catalogMatch?.label ||
      labelOrFallback(row.scope_name, '') ||
      labelOrFallback(row.trim_menu_label, '') ||
      humanizeIdentifier(trimId) ||
      trimId,
    family: catalogMatch?.family || asText(row.trim_family),
    price:
      asNum(row.effective_total) ??
      asNum(row.final_total) ??
      asNum(row.raw_total) ??
      asNum(row.override_total) ??
      0,
    paintProductId: asText(row.paint_product_id).toUpperCase(),
    paintProductLabel: asText(row.paint_product_label),
    notes: [asText(row.notes), asText(row.prep_level_override), asText(row.override_description)].filter(Boolean),
    coats: asNum(row.paint_coats) ?? asNum(row.coats),
    primeMode: normalizePrimeMode(row.prime_mode),
  }
}

function normalizeDoorScopeRow(
  row: CustomerEstimateRow,
  doorCatalogById: Map<string, NormalizedDoorCatalogRow>
): NormalizedDoorScopeRow {
  const rawDoorId = asText(row.door_type_id)
  const doorId = rawDoorId.toUpperCase()
  const catalogMatch = doorCatalogById.get(doorId)
  return {
    roomId: asText(row.room_id).toUpperCase(),
    included: asText(row.active || row.include).toUpperCase() !== 'N',
    doorId,
    doorLabel:
      catalogMatch?.label ||
      labelOrFallback(row.scope_name, '') ||
      humanizeIdentifier(rawDoorId.toLowerCase()) ||
      doorId,
    price:
      asNum(row.effective_total) ??
      asNum(row.final_total) ??
      asNum(row.raw_total) ??
      asNum(row.override_total) ??
      0,
    paintProductId: asText(row.paint_product_id).toUpperCase(),
    paintProductLabel: asText(row.paint_product_label),
    notes: [asText(row.notes)].filter(Boolean),
    coats: asNum(row.paint_coats) ?? asNum(row.coats),
    primeMode: normalizePrimeMode(row.prime_mode),
  }
}

function normalizeDrywallScopeRow(row: CustomerEstimateRow): NormalizedDrywallScopeRow {
  const repairType = asText(row.repair_type).toLowerCase()
  const surface = asText(row.surface).toLowerCase()
  return {
    roomId: asText(row.room_id).toUpperCase(),
    included: asText(row.active || row.include).toUpperCase() !== 'N',
    repairLabel: humanizeIdentifier(repairType) || 'Drywall repair',
    surface: humanizeIdentifier(surface) || 'Drywall',
    unit: asText(row.unit).toUpperCase(),
    quantity: asNum(row.effective_quantity) ?? asNum(row.raw_quantity) ?? asNum(row.quantity),
    price:
      asNum(row.effective_total) ??
      asNum(row.final_total) ??
      asNum(row.raw_total) ??
      asNum(row.override_total) ??
      asNum(row.calculated_total) ??
      0,
    notes: [asText(row.notes), 'primer included'].filter(Boolean),
  }
}

function normalizeOtherRow(row: CustomerEstimateRow): NormalizedOtherRow {
  return {
    description: asText(row.client_description),
    location: asText(row.location),
    qty: asNum(row.qty) ?? 1,
    uom: asText(row.uom),
    price:
      asNum(row.effective_total) ??
      asNum(row.final_total) ??
      asNum(row.raw_total) ??
      asNum(row.override_total) ??
      0,
  }
}

function isIncluded(row: CustomerEstimateRow) {
  return asText(row.active || row.include).toUpperCase() !== 'N'
}

function normalizeScopeKey(value: unknown): CustomerVisibleAllocationScopeKey | null {
  const normalized = asText(value).toLowerCase().replace(/[^a-z]/g, '')
  if (normalized === 'wall' || normalized === 'walls') return 'walls'
  if (normalized === 'ceiling' || normalized === 'ceilings') return 'ceilings'
  if (normalized === 'trim' || normalized === 'baseboard' || normalized === 'baseboards') return 'trim'
  if (normalized === 'door' || normalized === 'doors') return 'doors'
  if (normalized === 'drywall' || normalized === 'repair' || normalized === 'repairs') return 'drywall'
  if (normalized === 'cabinet' || normalized === 'cabinets') return 'cabinets'
  if (normalized === 'other' || normalized === 'additionalwork') return 'other'
  return null
}

function accessFeeAmount(row: CustomerEstimateRow) {
  const qty = asNum(row.qty) ?? 1
  return (
    asNum(row.effective_total) ??
    asNum(row.final_total) ??
    asNum(row.raw_total) ??
    asNum(row.override_total) ??
    asNum(row.calculated_total) ??
    asNum(row.actual_cost_override) ??
    (asNum(row.catalog_amount) ?? asNum(row.amount) ?? 0) * qty
  )
}

function prejobAmount(row: CustomerEstimateRow) {
  const tripCost = (asNum(row.trip_num) ?? 0) * (asNum(row.trip_rate) ?? 0)
  return (
    asNum(row.effective_total) ??
    asNum(row.final_total) ??
    asNum(row.raw_total) ??
    asNum(row.override_total) ??
    asNum(row.calculated_total) ??
    tripCost + (asNum(row.manual_adjustment) ?? 0)
  )
}

function normalizeAccessFeeHiddenFee(row: CustomerEstimateRow, index: number): HiddenCustomerFee | null {
  if (!isIncluded(row)) return null
  const amount = accessFeeAmount(row)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const id = asText(row.id) || `access-fee-${index + 1}`
  return {
    id,
    kind: 'access_fee',
    roomId: asText(row.room_id).toUpperCase() || null,
    amount,
    preferredScopeKey:
      normalizeScopeKey(row.preferred_scope_key) ??
      normalizeScopeKey(row.scope_key) ??
      normalizeScopeKey(row.scope) ??
      normalizeScopeKey(row.access_group),
    source: { access_fee_id: asText(row.access_fee_id) },
  }
}

function normalizePrejobHiddenFee(row: CustomerEstimateRow, index: number): HiddenCustomerFee | null {
  if (!isIncluded(row)) return null
  const amount = prejobAmount(row)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const id = asText(row.id) || `prejob-trip-${index + 1}`
  return {
    id,
    kind: 'prejob_trip',
    roomId: asText(row.room_id).toUpperCase() || null,
    amount,
    preferredScopeKey: normalizeScopeKey(row.preferred_scope_key) ?? normalizeScopeKey(row.scope_key),
    source: { trip_name: asText(row.trip_name) },
  }
}

export function roomNameMap(rows: NormalizedRoomRow[]) {
  const map = new Map<string, string>()
  for (const row of rows) {
    if (!row.roomId) continue
    map.set(row.roomId, row.roomLabel)
  }
  return map
}

export function paintNameMap(rows: NormalizedPaintCatalogRow[]) {
  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.label) {
      if (row.id) map.set(row.id, row.label)
      if (row.displayId) map.set(row.displayId, row.label)
    }
  }
  return map
}

export function jobSettingsPaintProductId(
  jobsettings: NormalizedJobSettings,
  scope: 'walls' | 'ceilings' | 'trim'
) {
  if (scope === 'walls') return jobsettings.wallPaintProductId
  if (scope === 'ceilings') return jobsettings.ceilingPaintProductId
  return jobsettings.trimPaintProductId
}

export function resolvePaintProductLabel(params: {
  paintProductId?: string | null
  fallbackLabel?: unknown
  paintLabelsById: Map<string, string>
}) {
  const productId = asText(params.paintProductId).toUpperCase()
  const catalogLabel = productId ? params.paintLabelsById.get(productId) ?? '' : ''
  return (
    labelOrFallback(catalogLabel, '') ||
    labelOrFallback(params.fallbackLabel, '') ||
    labelOrFallback(productId, '')
  )
}

export function normalizeCustomerEstimateInput(
  input: CustomerEstimateInput
): NormalizedCustomerEstimateInput {
  const trimCatalogRows = rowsOf(input.catalogs?.trim_items).map((row) => {
    const id = asText(row.id).toUpperCase()
    const label = labelOrFallback(row.label, humanizeIdentifier(id))
    const family = asText(row.family)
    return {
      id,
      label,
      family,
      category: asText(row.family || row.label),
    } satisfies NormalizedTrimCatalogRow
  })
  const trimCatalogById = new Map(trimCatalogRows.map((row) => [row.id, row]))
  const doorCatalogRows = rowsOf(input.catalogs?.door_types).map((row) => {
    const id = asText(row.id).toUpperCase()
    return {
      id,
      label: labelOrFallback(row.label, humanizeIdentifier(id)),
    } satisfies NormalizedDoorCatalogRow
  })
  const doorCatalogById = new Map(doorCatalogRows.map((row) => [row.id, row]))

  return {
    estimate: normalizeEstimateMeta(input.estimate),
    job: normalizeJobRecord(input.job),
    customer: normalizeCustomerRecord(input.customer),
    company: input.company,
    rooms: rowsOf(input.inputs.rooms).map(normalizeRoomRow).filter((row): row is NormalizedRoomRow => !!row),
    roomWallScopes: rowsOf(input.inputs.room_wall_scopes).map((row) =>
      normalizePaintScopeRow(row, ['notes', 'walls_prep_override', 'scope_notes'], ['paint_coats', 'wall_coats'])
    ),
    roomCeilingScopes: rowsOf(input.inputs.room_ceiling_scopes).map((row) =>
      normalizePaintScopeRow(
        row,
        ['notes', 'ceiling_prep_override', 'scope_notes'],
        ['paint_coats', 'ceiling_coats']
      )
    ),
    roomTrimScopes: rowsOf(input.inputs.room_trim_scopes).map((row) =>
      normalizeTrimScopeRow(row, trimCatalogById)
    ),
    roomDoorScopes: rowsOf(input.inputs.room_door_scopes).map((row) =>
      normalizeDoorScopeRow(row, doorCatalogById)
    ),
    roomDrywallScopes: rowsOf(input.inputs.drywall_repairs).map(normalizeDrywallScopeRow),
    trimItems: rowsOf(input.inputs.trim_items).map((row) => {
      const trimId = asText(row.trim_menu_id).toUpperCase()
      const catalogMatch = trimCatalogById.get(trimId)
      return {
        roomId: asText(row.room_id).toUpperCase(),
        trimId,
        trimLabel:
          catalogMatch?.label ||
          labelOrFallback(row.trim_menu_label, '') ||
          humanizeIdentifier(trimId) ||
          trimId,
        family: catalogMatch?.family || '',
        price:
          asNum(row.effective_total) ??
          asNum(row.final_total) ??
          asNum(row.raw_total) ??
          asNum(row.override_total) ??
          0,
        paintProductId: asText(row.paint_product_id).toUpperCase(),
        paintProductLabel: asText(row.paint_product_label),
        notes: [asText(row.notes), asText(row.prep_level_override), asText(row.override_description)].filter(Boolean),
        coats: asNum(row.coats),
        primeMode: normalizePrimeMode(row.prime_mode),
      } satisfies NormalizedTrimItemRow
    }),
    otherRows: rowsOf(input.inputs.other).map(normalizeOtherRow),
    hiddenFees: [
      ...rowsOf(input.inputs.access_fees)
        .map(normalizeAccessFeeHiddenFee)
        .filter((row): row is HiddenCustomerFee => !!row),
      ...rowsOf(input.inputs.prejob)
        .map(normalizePrejobHiddenFee)
        .filter((row): row is HiddenCustomerFee => !!row),
    ],
    jobsettings: {
      wallPaintProductId: asText(
        input.inputs.jobsettings?.walls_paint_id ||
          input.inputs.jobsettings?.wall_paint_id ||
          input.inputs.org_defaults?.walls_paint_id ||
          input.inputs.org_defaults?.wall_paint_id
      ).toUpperCase(),
      ceilingPaintProductId: asText(
        input.inputs.jobsettings?.ceiling_paint_id || input.inputs.org_defaults?.ceiling_paint_id
      ).toUpperCase(),
      trimPaintProductId: asText(
        input.inputs.jobsettings?.trim_paint_id || input.inputs.org_defaults?.trim_paint_id
      ).toUpperCase(),
    },
    paintCatalogRows: rowsOf(input.catalogs?.paint_products).map((row) => ({
      id: asText(row.id).toUpperCase(),
      displayId: asText(row.display_id).toUpperCase(),
      label:
        asText(row.display_name) ||
        asText(row.label) ||
        asText(row.name) ||
        humanizeIdentifier(asText(row.display_id)),
    })),
    trimCatalogRows,
    doorCatalogRows,
    pricingSummary: input.pricingSummary ?? null,
    settings: input.settings,
    overrides: input.overrides,
    publicMeta: input.publicMeta,
  }
}
