import { supabaseAdmin } from './org.ts'
import {
  readLiveRatesFlagsCatalogOverlay,
  type RatesFlagsCatalogOverlay,
} from './rates-flags'

type ProductionRateCatalogRow = RatesFlagsCatalogOverlay['production_rates'][number]
type HeightFactorCatalogRow = RatesFlagsCatalogOverlay['height_factors'][number]
type RoomTypeCatalogRow = RatesFlagsCatalogOverlay['room_types'][number]
type WallComplexityCatalogRow = RatesFlagsCatalogOverlay['wall_complexity_types'][number]
type CeilingTypeCatalogRow = RatesFlagsCatalogOverlay['ceiling_types'][number]
type RoomFlagCatalogRow = RatesFlagsCatalogOverlay['room_flags'][number]
type AccessFeeCatalogRow = RatesFlagsCatalogOverlay['access_fees'][number]
type TrimItemCatalogRow = RatesFlagsCatalogOverlay['trim_items'][number]
type AreaSupplyCatalogRow = RatesFlagsCatalogOverlay['area_supplies_rates'][number]

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
    room_types: pickArray<RoomTypeCatalogRow>('room_types'),
    wall_complexity_types: pickArray<WallComplexityCatalogRow>('wall_complexity_types'),
    ceiling_types: pickArray<CeilingTypeCatalogRow>('ceiling_types'),
    room_flags: pickArray<RoomFlagCatalogRow>('room_flags'),
    access_fees: pickArray<AccessFeeCatalogRow>('access_fees'),
    trim_items: pickArray<TrimItemCatalogRow>('trim_items'),
    area_supplies_rates: pickArray<AreaSupplyCatalogRow>('area_supplies_rates'),
  }
}

export async function getOrCreateEstimateRatesFlagsCatalogOverlay(params: {
  orgId: string
  estimateId: string
}) {
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
