import { supabaseAdmin } from '@/lib/server/org'
import {
  getOrCreateLiveRatesFlagsCatalogOverlay,
  readLiveRatesFlagsCatalogOverlay,
} from '@/lib/server/rates-flags'
import {
  loadActiveSettingSet,
  loadEstimateSettingSet,
  loadSettingSetById,
  settingValuesToTemplateRows,
} from '@/lib/server/estimate-feedback/settingSets'
import { inferTrimTypeMetadata } from '@/lib/estimator/trimTypeMetadata'
import { buildOverlayFromRows } from '@/lib/server/rates-flags/overlay'

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
  scopes?: string[]
}

type CeilingType = CatalogOption & {
  labor_mult: number | null
  area_factor: number | null
  surcharge_per_sqft: number | null
  notes: string | null
}

type RoomType = CatalogOption & {
  default_wall_rate_id: string | null
  default_ceil_rate_id: string | null
  top_cut_in_factor: number | null
  bot_cut_in_factor: number | null
  height_factor_ovr: number | null
  default_complexity_id: string | null
  default_wall_mode: 'RECT' | 'SEG' | null
  notes: string | null
}

type WallComplexityType = CatalogOption & {
  labor_multiplier: number | null
  access_fee: number | null
}

type HeightFactor = CatalogOption & {
  min_height_ft: number | null
  max_height_ft: number | null
  labor_multiplier: number | null
  notes: string | null
}

type RoomFlag = CatalogOption & {
  wall_factor: number | null
  ceil_factor: number | null
  trim_factor: number | null
  notes: string | null
}

type ConditionModifier = CatalogOption & {
  scope: 'room' | 'wall' | 'ceiling' | 'trim'
  modifier_type: 'binary' | 'severity'
  factor_field: string | null
  levels: Partial<Record<'active' | 'minor' | 'moderate' | 'major', number>>
  notes: string | null
}

type AccessFee = CatalogOption & {
  access_group: 'ladders' | 'scaffolding' | 'specialty'
  fee_type: string | null
  amount: number | null
  unit: string | null
  notes: string | null
}

type TrimItem = CatalogOption & {
  unit: string | null
  family: string | null
  unit_type: string | null
  helper_allowed: boolean
  default_production_rate_id: string | null
  production_rate_id: string | null
  notes: string | null
  default_qty: number | null
  is_active: boolean
  category: string | null
  size: string | null
  trim_category?: string | null
  measurement_class?: string | null
  picker_group?: string | null
}

type DoorType = CatalogOption & {
  unit_rate_type: string | null
  unit: string | null
  default_qty: number | null
  labor_rate: number | null
  material_rate: number | null
  amount: number | null
  notes: string | null
}

type DrywallRate = DoorType & {
  ceiling_multiplier: number | null
}

type ProductionRate = CatalogOption & {
  scope_id: string | null
  surface_type: string | null
  condition: string | null
  prep_sqft_per_hr: number | null
  sqft_per_hr: number | null
  primer_sqft_per_hr: number | null
  notes: string | null
}

type LiveRatesFlagsCatalogOverlay = NonNullable<
  Awaited<ReturnType<typeof readLiveRatesFlagsCatalogOverlay>>
>

export type EstimateCatalogs = {
  paint_products: PaintProduct[]
  ceiling_types: CeilingType[]
  room_types: RoomType[]
  wall_complexity_types: WallComplexityType[]
  production_rates?: ProductionRate[]
  height_factors?: HeightFactor[]
  color_codes: CatalogOption[]
  roller_covers: CatalogOption[]
  room_flags: RoomFlag[]
  condition_modifiers: ConditionModifier[]
  access_fees: AccessFee[]
  trim_items: TrimItem[]
  door_types: DoorType[]
  drywall_rates: DrywallRate[]
  trim_menu_items: TrimItem[]
  prejob_trips: CatalogOption[]
  supplies_rates: Array<{
    key: string
    supply_group?: 'per_color' | 'area_based' | 'per_job'
    scope: string | null
    unit: string | null
    value: number | null
    crew_multiplier?: 'Y' | 'N'
    notes: string | null
  }>
}

export type EstimateCatalogsResult = {
  catalogs: EstimateCatalogs
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function inferTrimUnitType(value: unknown): string | null {
  const text = asText(value).toUpperCase()
  if (!text) return null
  if (text.includes(' EA') || text.endsWith('EA')) return 'EA'
  if (text.includes(' SF') || text.endsWith('SF')) return 'SF'
  if (text.includes(' LF') || text.endsWith('LF')) return 'LF'
  return null
}

function normalizeTrimCatalogUnit(value: unknown): 'LF' | 'EA' | 'SF' | null {
  const raw = asText(value).toUpperCase()
  if (raw === 'LF' || raw === 'EA' || raw === 'SF') return raw
  return inferTrimUnitType(raw) as 'LF' | 'EA' | 'SF' | null
}

async function readV2Products(orgId: string): Promise<PaintProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('v2_products')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'Active')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to read V2 products: ${error.message}`)

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: asText(row.id),
    label: asText(row.display_name ?? row.display_id ?? row.label ?? row.name),
    type: asText(row.family ?? ''),
    price_per_gal: row.cost_per_unit as number | null,
    coverage_sqft_per_gal_per_coat: row.coverage_sqft_per_gal_per_coat as number | null,
    notes: asText(row.notes ?? ''),
    active: 'Y' as const,
    scopes: (row.default_scopes ?? []) as string[],
  }))
}

function buildV2CatalogResultFromSources(params: {
  overlay: LiveRatesFlagsCatalogOverlay
  products: PaintProduct[]
}): EstimateCatalogsResult {
  const activeProductionRates = params.overlay.production_rates.filter((row) => row.active === 'Y')
  const activeTrimProductionRates = activeProductionRates.filter((row) => asText(row.scope_id).toUpperCase() === 'TRIM')
  const activeTrimItems = params.overlay.trim_items.filter((row) => row.active === 'Y')
  const trimItems =
    activeTrimItems.length > 0
      ? activeTrimItems.map((row) => {
          const unitType = normalizeTrimCatalogUnit(row.unit_type || row.unit)
          const metadata = inferTrimTypeMetadata({
            id: row.id,
            label: row.label,
            family: row.family,
            category: row.category,
            unitType,
            trimCategory: row.trim_category,
            measurementClass: row.measurement_class,
            pickerGroup: row.picker_group,
          })
          return {
            id: row.id,
            label: row.label || row.id,
            active: row.active,
            unit: normalizeTrimCatalogUnit(row.unit),
            family: row.family,
            unit_type: unitType,
            helper_allowed: row.helper_allowed,
            default_production_rate_id: row.default_production_rate_id,
            production_rate_id: row.production_rate_id,
            notes: row.notes,
            default_qty: row.default_qty,
            is_active: row.active === 'Y',
            category: row.category,
            size: row.size,
            trim_category: metadata.trim_category,
            measurement_class: metadata.measurement_class,
            picker_group: metadata.picker_group,
          }
        })
      : activeTrimProductionRates.map((row) => {
          const source = `${row.id} ${row.label} ${row.surface_type} ${row.condition}`
          const unitType = inferTrimUnitType(source)
          const metadata = inferTrimTypeMetadata({
            id: row.id,
            label: row.label,
            family: row.surface_type,
            category: row.surface_type,
            unitType,
          })
          return {
            id: row.id,
            label: row.label || row.id,
            active: row.active,
            unit: unitType,
            family: row.surface_type,
            unit_type: unitType,
            helper_allowed: false,
            default_production_rate_id: row.id,
            production_rate_id: row.id,
            notes: row.notes,
            default_qty: null,
            is_active: row.active === 'Y',
            category: row.surface_type,
            size: row.condition,
            trim_category: metadata.trim_category,
            measurement_class: metadata.measurement_class,
            picker_group: metadata.picker_group,
          }
        })

  return {
    catalogs: {
      paint_products: params.products,
      ceiling_types: params.overlay.ceiling_types
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          id: row.id,
          label: row.label || row.id,
          active: row.active,
          labor_mult: row.labor_mult,
          area_factor: row.area_factor,
          surcharge_per_sqft: row.surcharge_per_sqft,
          notes: row.notes,
        })),
      room_types: params.overlay.room_types
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          id: row.id,
          label: row.label || row.id,
          active: row.active,
          default_wall_rate_id: row.default_wall_rate_id,
          default_ceil_rate_id: row.default_ceil_rate_id,
          top_cut_in_factor: row.top_cut_in_factor,
          bot_cut_in_factor: row.bot_cut_in_factor,
          height_factor_ovr: row.height_factor_ovr,
          default_complexity_id: row.default_complexity_id,
          default_wall_mode: row.default_wall_mode,
          notes: row.notes,
        })),
      wall_complexity_types: [],
      production_rates: activeProductionRates.map((row) => ({
        id: row.id,
        label: row.label || row.id,
        active: row.active,
        scope_id: row.scope_id,
        surface_type: row.surface_type,
        condition: row.condition,
        prep_sqft_per_hr: row.prep_sqft_per_hr,
        sqft_per_hr: row.sqft_per_hr,
        primer_sqft_per_hr: row.primer_sqft_per_hr,
        notes: row.notes,
      })),
      height_factors: params.overlay.height_factors
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          id: row.id,
          label: row.label || row.id,
          active: row.active,
          min_height_ft: row.min_height_ft,
          max_height_ft: row.max_height_ft,
          labor_multiplier: row.labor_multiplier,
          notes: row.notes,
        })),
      color_codes: [],
      roller_covers: [],
      room_flags: params.overlay.room_flags
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          id: row.id,
          label: row.label || row.id,
          active: row.active,
          wall_factor: row.wall_factor,
          ceil_factor: row.ceil_factor,
          trim_factor: row.trim_factor,
          notes: row.notes,
        })),
      condition_modifiers: params.overlay.condition_modifiers
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          id: row.id,
          label: row.label || row.id,
          active: row.active,
          scope: row.scope,
          modifier_type: row.modifier_type,
          factor_field: row.factor_field,
          levels: row.levels,
          notes: row.notes,
        })),
      access_fees: params.overlay.access_fees
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          id: row.id,
          label: row.label || row.id,
          active: row.active,
          access_group: row.access_group,
          fee_type: row.fee_type,
          amount: row.amount,
          unit: row.unit,
          notes: row.notes,
        })),
      trim_items: trimItems,
      door_types: (params.overlay.door_unit_rates ?? [])
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          id: row.id,
          label: row.label || row.id,
          active: row.active,
          unit_rate_type: row.unit_rate_type,
          unit: row.unit,
          default_qty: row.default_qty,
          labor_rate: row.labor_rate,
          material_rate: row.material_rate,
          amount: row.amount,
          notes: row.notes,
        })),
      drywall_rates: (params.overlay.drywall_unit_rates ?? [])
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          id: row.id.toLowerCase(),
          label: row.label || row.id,
          active: row.active,
          unit_rate_type: row.unit_rate_type,
          unit: row.unit,
          default_qty: row.default_qty,
          labor_rate: row.labor_rate,
          material_rate: row.material_rate,
          amount: row.amount,
          ceiling_multiplier: row.ceiling_multiplier,
          notes: row.notes,
        })),
      trim_menu_items: trimItems,
      prejob_trips: [],
      supplies_rates: params.overlay.area_supplies_rates
        .filter((row) => row.active === 'Y')
        .map((row) => ({
          key: row.key,
          supply_group: row.supply_group,
          scope: row.scope,
          unit: row.unit,
          value: row.value,
          crew_multiplier: row.crew_multiplier,
          notes: row.notes,
        })),
    },
  }
}

async function resolveCatalogOverlay(params: {
  orgId: string
  estimateId?: string | null
  settingSetId?: string | null
  forceActiveAdmin?: boolean
}): Promise<LiveRatesFlagsCatalogOverlay> {
  if (params.forceActiveAdmin) {
    return getOrCreateLiveRatesFlagsCatalogOverlay({ orgId: params.orgId })
  }

  const snapshot = params.settingSetId
    ? await loadSettingSetById({
        orgId: params.orgId,
        settingSetId: params.settingSetId,
      })
    : params.estimateId
      ? await loadEstimateSettingSet({
          orgId: params.orgId,
          estimateId: params.estimateId,
        })
      : await loadActiveSettingSet({ orgId: params.orgId })

  if (snapshot) {
    return buildOverlayFromRows({
      templateVersion: snapshot.set.version_number,
      rows: settingValuesToTemplateRows(snapshot),
    })
  }

  return getOrCreateLiveRatesFlagsCatalogOverlay({ orgId: params.orgId })
}

async function buildV2CatalogResult(params: {
  orgId: string
  estimateId?: string | null
  settingSetId?: string | null
  forceActiveAdmin?: boolean
}): Promise<EstimateCatalogsResult> {
  const overlay = await resolveCatalogOverlay(params)
  const products = await readV2Products(params.orgId)
  return buildV2CatalogResultFromSources({ overlay, products })
}

export async function getEstimateCatalogs(params: {
  origin: string
  orgId: string
  userId: string
  estimateId?: string
  settingSetId?: string
  forceRefresh?: boolean
  adminRefreshMode?: 'active'
}): Promise<EstimateCatalogsResult> {
  void params.origin
  void params.userId
  return buildV2CatalogResult({
    orgId: params.orgId,
    estimateId: params.estimateId,
    settingSetId: params.settingSetId,
    forceActiveAdmin: params.adminRefreshMode === 'active',
  })
}

export const _test = {
  buildV2CatalogResultFromSources,
  resolveCatalogOverlay,
}
