import { type ScopeKind } from '../../estimator/scopeKinds.ts'
import type { StringRecord } from './categoryTypes.ts'

export type AccessFeeCatalogRow = {
  id: string
  label: string
  access_group: 'ladders' | 'scaffolding' | 'specialty'
  fee_type: string | null
  amount: number | null
  unit: string | null
  notes: string | null
  active: 'Y' | 'N'
}

export type RoomFlagCatalogRow = {
  id: string
  label: string
  wall_factor: number | null
  ceil_factor: number | null
  trim_factor: number | null
  notes: string | null
  active: 'Y' | 'N'
}

export type ConditionModifierCatalogRow = {
  id: string
  label: string
  scope: 'room' | 'wall' | 'ceiling' | 'trim'
  modifier_type: 'binary' | 'severity'
  factor_field: string | null
  levels: Partial<Record<'active' | 'minor' | 'moderate' | 'major', number>>
  notes: string | null
  active: 'Y' | 'N'
}

export type WallComplexityCatalogRow = {
  id: string
  label: string
  labor_multiplier: number | null
  access_fee: number | null
  active: 'Y' | 'N'
}

export type CeilingTypeCatalogRow = {
  id: string
  label: string
  labor_mult: number | null
  area_factor: number | null
  surcharge_per_sqft: number | null
  notes: string | null
  active: 'Y' | 'N'
}

export type HeightFactorCatalogRow = {
  id: string
  label: string
  min_height_ft: number | null
  max_height_ft: number | null
  labor_multiplier: number | null
  notes: string | null
  active: 'Y' | 'N'
}

export type RoomTypeCatalogRow = {
  id: string
  label: string
  default_wall_rate_id: string | null
  default_ceil_rate_id: string | null
  top_cut_in_factor: number | null
  bot_cut_in_factor: number | null
  height_factor_ovr: number | null
  default_complexity_id: string | null
  default_wall_mode: 'RECT' | 'SEG' | null
  notes: string | null
  active: 'Y' | 'N'
}

export type ProductionRateCatalogRow = {
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

export type TrimItemCatalogRow = {
  id: string
  label: string
  unit: string | null
  family: string | null
  unit_type: string | null
  helper_allowed: boolean
  default_production_rate_id: string | null
  production_rate_id: string | null
  notes: string | null
  default_qty: number | null
  category: string | null
  size: string | null
  active: 'Y' | 'N'
  trim_category?: string | null
  measurement_class?: string | null
  picker_group?: string | null
}

export type DoorUnitRateCatalogRow = {
  id: string
  label: string
  unit_rate_type: string | null
  unit: string | null
  default_qty: number | null
  labor_rate: number | null
  material_rate: number | null
  amount: number | null
  notes: string | null
  active: 'Y' | 'N'
}

export type DrywallUnitRateCatalogRow = DoorUnitRateCatalogRow & {
  ceiling_multiplier: number | null
}

export type AreaSupplyCatalogRow = {
  key: string
  supply_group: 'per_color' | 'area_based' | 'per_job'
  scope: string | null
  unit: string | null
  value: number
  crew_multiplier: 'Y' | 'N'
  notes: string | null
  active: 'Y' | 'N'
}

export type RatesFlagsCatalogOverlay = {
  template_version: number
  production_rates: ProductionRateCatalogRow[]
  height_factors: HeightFactorCatalogRow[]
  room_types: RoomTypeCatalogRow[]
  wall_complexity_types: WallComplexityCatalogRow[]
  ceiling_types: CeilingTypeCatalogRow[]
  room_flags: RoomFlagCatalogRow[]
  condition_modifiers: ConditionModifierCatalogRow[]
  access_fees: AccessFeeCatalogRow[]
  trim_items: TrimItemCatalogRow[]
  door_unit_rates?: DoorUnitRateCatalogRow[]
  drywall_unit_rates?: DrywallUnitRateCatalogRow[]
  area_supplies_rates: AreaSupplyCatalogRow[]
}

export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function normalizeKey(value: unknown) {
  return asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function normalizeId(value: unknown) {
  return asText(value).toUpperCase()
}

export function toYN(value: unknown, fallback: 'Y' | 'N' = 'N') {
  const raw = asText(value).toUpperCase()
  if (raw === 'Y' || raw === 'N') return raw
  return fallback
}

export function toYNString(value: string) {
  return toYN(value, 'Y') === 'Y' ? 'Y' : 'N'
}

export function asBooleanYN(value: unknown) {
  return toYN(value, 'N') === 'Y'
}

export function asMaybeNumber(value: unknown) {
  const raw = asText(value)
  if (!raw) return null
  const cleaned = raw.replace(/[$,%\s,]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function parseNumber(value: unknown) {
  const n = asMaybeNumber(value)
  return n == null ? null : n
}

export function rowByHeader(row: StringRecord, synonyms: string[]) {
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

export function isAreaBasedUnit(value: unknown) {
  const raw = asText(value).toLowerCase().replace(/\s+/g, '')
  if (!raw) return false
  if (!raw.includes('$')) return false
  return raw.includes('/sqft') || raw.includes('/sf')
}

export function asDisplayName(values: StringRecord) {
  return asText(values.display_name) || asText(values.id)
}

export function includesAny(raw: string, terms: string[]) {
  const value = raw.toLowerCase()
  return terms.some((term) => value.includes(term))
}

export function normalizeProductionScope(value: unknown): ScopeKind | '' {
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

export function classifyAccessGroup(row: StringRecord): 'ladders' | 'scaffolding' | 'specialty' {
  const id = normalizeId(rowByHeader(row, ['AccessFeeID', 'FeeID', 'ID']))
  if (id && ACCESS_GROUP_BY_ID[id]) return ACCESS_GROUP_BY_ID[id]

  const text = `${rowByHeader(row, ['AccessGroup', 'Group', 'Category'])} ${rowByHeader(row, ['DisplayName', 'FeeName', 'Name', 'Label'])} ${rowByHeader(row, ['AccessFeeID', 'FeeID', 'ID'])}`.toLowerCase()
  if (includesAny(text, ['ladder', 'step ladder', 'extension'])) return 'ladders'
  if (includesAny(text, ['scaffold', 'scaffolding'])) return 'scaffolding'
  return 'specialty'
}

export function classifySupplyGroup(row: StringRecord): 'per_color' | 'area_based' | 'per_job' {
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
