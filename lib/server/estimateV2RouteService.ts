import { supabaseAdmin } from '@/lib/server/org'
import {
  buildV2RoomRosterRows,
  buildV2WallScopeRows,
  buildV2WallSegmentRows,
  buildV2CeilingScopeRows,
  buildV2CeilingSegmentRows,
  buildV2TrimScopeRows,
  type V2RoomRosterRow,
  type V2WallScopeSaveRow,
  type V2WallSegmentSaveRow,
  type V2CeilingScopeSaveRow,
  type V2CeilingSegmentSaveRow,
  type V2TrimScopeSaveRow,
} from '@/lib/server/estimateV2RoutePayload'
import {
  calculateWalls,
} from '@/lib/estimator/walls'
import {
  calculateCeilings,
} from '@/lib/estimator/ceilings'
import {
  calculateTrim,
} from '@/lib/estimator/trim'
import {
  buildEstimatePricingSummary,
} from '@/lib/estimator/pricingPolicies'
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from '@/lib/estimator/defaults'
import { productMap } from '@/lib/estimator/wallsHelpers'
import {
  buildTrimPaintInput,
  normalizeTrimPaintGallons,
} from '@/lib/server/trimPaint'
import {
  buildEstimateGetResponse,
} from '@/lib/server/estimateGetResponse'
import { loadEstimateTemplateSettings } from '@/lib/server/estimateTemplateSettings'
import {
  asNullableNumber,
  asNullableNumberFromKeys,
  asText,
  isUuid,
  pickValue,
  toColorId,
  toYN,
  UUID_RE as uuid,
  type UnsafeRecord as Unsafe,
} from '@/lib/estimator/parsing'
import {
  loadEstimateV2CalculationCatalogs,
  loadEstimateV2RoomModesForTrimFromDb,
  resolveEstimateV2RoomModeById,
} from '@/lib/server/estimateV2Catalogs'

export class EstimateV2RouteServiceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'EstimateV2RouteServiceError'
    this.status = status
  }
}

function fail(message: string, status = 400): never {
  throw new EstimateV2RouteServiceError(message, status)
}

function toWallsCalcMethod(value: unknown): 'REGULAR' | 'PANEL' {
  return asText(value).toUpperCase() === 'PANEL' ? 'PANEL' : 'REGULAR'
}

function toOtherRollupScope(value: unknown): 'Walls' | 'Ceilings' | 'Trim' | null {
  const raw = asText(value).toLowerCase()
  if (raw === 'walls' || raw === 'wall') return 'Walls'
  if (raw === 'ceilings' || raw === 'ceiling') return 'Ceilings'
  if (raw === 'trim') return 'Trim'
  return null
}

function nextRoomId(used: Set<string>, startAt: number) {
  let n = Math.max(1, startAt)
  while (used.has(`R${String(n).padStart(3, '0')}`)) {
    n += 1
  }
  return `R${String(n).padStart(3, '0')}`
}

async function saveV2RoomRoster(params: {
  orgId: string
  estimateId: string
  jobId: string
  rows: V2RoomRosterRow[]
}) {
  const existing = await supabaseAdmin
    .from('estimate_rooms')
    .select('id, room_id')
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)

  if (existing.error) throw new Error(existing.error.message)

  const existingById = new Map<string, { id: string; room_id: string | null }>()
  const existingByRoomId = new Map<string, { id: string; room_id: string | null }>()
  for (const row of existing.data ?? []) {
    const record = row as { id: string; room_id: string | null }
    existingById.set(record.id, record)
    if (record.room_id) existingByRoomId.set(record.room_id, record)
  }

  const keepIds = new Set<string>()
  const withId: Record<string, unknown>[] = []
  const withoutId: Record<string, unknown>[] = []
  for (const row of params.rows) {
    const existingMatch =
      (row.id ? existingById.get(row.id) : undefined) ?? existingByRoomId.get(row.room_id)
    const id = existingMatch?.id ?? row.id
    if (id) keepIds.add(id)

    const baseRow = {
      id,
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
      position: row.position,
      room_id: row.room_id,
      room_name: row.room_name,
      notes: row.notes,
      length_in: row.length_in,
      width_in: row.width_in,
      wallheight_in: row.wallheight_in,
    }
    if (id) {
      withId.push(baseRow)
    } else {
      withoutId.push({
        ...baseRow,
        mode: 'RECT',
        walls_include: 'N',
        ceiling_include: 'N',
        trim_include: 'N',
        doors_include: 'N',
        drywall_include: 'N',
      })
    }
  }

  const deleteIds = (existing.data ?? [])
    .map((row) => asText((row as { id?: unknown }).id))
    .filter((value) => !!value && !keepIds.has(value))

  if (deleteIds.length > 0) {
    const remove = await supabaseAdmin
      .from('estimate_rooms')
      .delete()
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .in('id', deleteIds)
    if (remove.error) throw new Error(remove.error.message)
  }

  if (withId.length > 0) {
    const upsert = await supabaseAdmin.from('estimate_rooms').upsert(withId, { onConflict: 'id' })
    if (upsert.error) throw new Error(upsert.error.message)
  }

  if (withoutId.length > 0) {
    const insert = await supabaseAdmin.from('estimate_rooms').insert(withoutId)
    if (insert.error) throw new Error(insert.error.message)
  }
}

async function softReplaceWallSegments(params: {
  orgId: string
  estimateId: string
  rows: Record<string, unknown>[]
}) {
  const deactivate = await supabaseAdmin
    .from('estimate_segments')
    .update({ active: 'N' })
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .eq('active', 'Y')
    .not('wall_scope_id', 'is', null)
  if (deactivate.error) throw new Error(deactivate.error.message)

  if (!params.rows.length) return

  const withId = params.rows
    .filter((row) => isUuid(row.id))
    .map((row) => ({ ...row, active: 'Y' }))
  const withoutId = params.rows
    .filter((row) => !isUuid(row.id))
    .map((row) => ({ ...row, active: 'Y' }))

  if (withId.length > 0) {
    const upsert = await supabaseAdmin.from('estimate_segments').upsert(withId, { onConflict: 'id' })
    if (upsert.error) throw new Error(upsert.error.message)
  }
  if (withoutId.length > 0) {
    const insert = await supabaseAdmin.from('estimate_segments').insert(withoutId)
    if (insert.error) throw new Error(insert.error.message)
  }
}

async function getEstimate(orgId: string, estimateId: string) {
  const res = await supabaseAdmin
    .from('estimates')
    .select(
      'id, org_id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'
    )
    .eq('org_id', orgId)
    .eq('id', estimateId)
    .maybeSingle()
  if (res.error) return { error: res.error.message } as const
  if (!res.data) return { error: 'Estimate not found' } as const
  return { estimate: res.data } as const
}

async function softReplaceRows(params: {
  table:
    | 'estimate_room_wall_scopes'
    | 'estimate_segments'
    | 'estimate_ceiling_segments'
    | 'estimate_room_ceiling_scopes'
    | 'estimate_room_ceiling_scope_segments'
    | 'estimate_room_trim_scopes'
    | 'estimate_rollers'
    | 'estimate_prejob'
    | 'estimate_trim_items'
    | 'estimate_job_colors'
    | 'estimate_room_flags'
    | 'estimate_access_fees'
    | 'estimate_other'
  orgId: string
  estimateId: string
  rows: Record<string, unknown>[]
}) {
  const deactivate = await supabaseAdmin
    .from(params.table)
    .update({ active: 'N' })
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .eq('active', 'Y')
  if (deactivate.error) throw new Error(deactivate.error.message)

  if (!params.rows.length) return

  const withId = params.rows
    .filter((row) => {
      const id = asText(row.id)
      return !!id && uuid.test(id)
    })
    .map((row) => ({ ...row, active: 'Y' }))
  const withoutId = params.rows
    .filter((row) => {
      const id = asText(row.id)
      return !(id && uuid.test(id))
    })
    .map((row) => ({ ...row, active: 'Y' }))

  if (withId.length > 0) {
    const upsert = await supabaseAdmin.from(params.table).upsert(withId, { onConflict: 'id' })
    if (upsert.error) throw new Error(upsert.error.message)
  }
  if (withoutId.length > 0) {
    const insert = await supabaseAdmin.from(params.table).insert(withoutId)
    if (insert.error) throw new Error(insert.error.message)
  }
}

async function saveEstimateStructuredInputsTransactional(params: {
  orgId: string
  estimateId: string
  jobId: string
  payload: Record<string, unknown>
}) {
  const rpc = await supabaseAdmin.rpc('save_estimate_v2_inputs', {
    p_org_id: params.orgId,
    p_estimate_id: params.estimateId,
    p_job_id: params.jobId,
    p_payload: params.payload,
  })
  if (rpc.error) throw new Error(rpc.error.message)
}

function isMissingStructuredEstimateSaveRpc(message: string) {
  const lowered = asText(message).toLowerCase()
  if (!lowered.includes('save_estimate_v2_inputs')) return false
  return (
    lowered.includes('does not exist') ||
    lowered.includes('could not find the function') ||
    lowered.includes('function public.save_estimate_v2_inputs')
  )
}

function isRecoverableStructuredEstimateSaveRpcPkCollision(message: string) {
  const lowered = asText(message).toLowerCase()
  if (!lowered.includes('duplicate key value violates unique constraint')) return false
  return (
    lowered.includes('estimate_job_colors_pkey') ||
    lowered.includes('estimate_room_flags_pkey') ||
    lowered.includes('estimate_access_fees_pkey') ||
    lowered.includes('estimate_segments_pkey')
  )
}

export async function loadEstimateV2Response(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
}) {
  const orgId = params.orgId
  const id = params.estimateId
  const userId = params.userId
  const requestOrigin = params.requestOrigin
  const estimateRes = await getEstimate(params.orgId, params.estimateId)
  if ('error' in estimateRes) {
    const message = asText(estimateRes.error) || 'Failed to load estimate'
    fail(message, message === 'Estimate not found' ? 404 : 500)
  }

  let quoteWallScopes: Unsafe[] = []
  let quoteCeilingScopes: Unsafe[] = []
  let quoteTrimScopes: Unsafe[] = []

  const [jobsettings, rooms, roomWallScopes, segments, wallSegments, ceilingSegments, roomCeilingScopes, ceilingScopeSegments, roomTrimScopes, rollers, prejob, trimItems, jobColors, roomFlags, accessFees, other] = await Promise.all([
    supabaseAdmin
      .from('estimate_jobsettings')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .maybeSingle(),
    supabaseAdmin
      .from('estimate_rooms')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_wall_scopes')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('room_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .is('wall_scope_id', null)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .not('wall_scope_id', 'is', null)
      .order('wall_scope_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_ceiling_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_ceiling_scopes')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('room_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_ceiling_scope_segments')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('ceiling_scope_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_trim_scopes')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('room_id', { ascending: true })
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_rollers')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_prejob')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_trim_items')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('estimate_job_colors')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_room_flags')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_access_fees')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_other')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
  ])

  if (jobsettings.error) fail(jobsettings.error.message, 500)
  if (rooms.error) fail(rooms.error.message, 500)
  if (roomWallScopes.error) fail(roomWallScopes.error.message, 500)
  if (segments.error) fail(segments.error.message, 500)
  if (wallSegments.error) fail(wallSegments.error.message, 500)
  if (ceilingSegments.error) fail(ceilingSegments.error.message, 500)
  if (roomCeilingScopes.error) fail(roomCeilingScopes.error.message, 500)
  if (ceilingScopeSegments.error) fail(ceilingScopeSegments.error.message, 500)
  if (roomTrimScopes.error) fail(roomTrimScopes.error.message, 500)
  if (rollers.error) fail(rollers.error.message, 500)
  if (prejob.error) fail(prejob.error.message, 500)
  if (trimItems.error) fail(trimItems.error.message, 500)
  if (jobColors.error) fail(jobColors.error.message, 500)
  if (roomFlags.error) fail(roomFlags.error.message, 500)
  if (accessFees.error) fail(accessFees.error.message, 500)
  if (other.error) fail(other.error.message, 500)

  const orgDefaults = await loadEstimateTemplateSettings(params.orgId).catch(() => null)
  const js = jobsettings.data as Unsafe | null
  const wallDefaultPaintId =
    asText(js?.walls_paint_id ?? js?.wall_paint_id) || orgDefaults?.walls_paint_id || null
  const wallDefaultPrimerId =
    asText(js?.walls_primer_id ?? js?.primer_id) || orgDefaults?.walls_primer_id || null
  const ceilingDefaultPaintId =
    asText(js?.ceiling_paint_id) || orgDefaults?.ceiling_paint_id || null
  const ceilingDefaultPrimerId =
    asText(js?.ceiling_primer_id ?? js?.primer_id) || orgDefaults?.ceiling_primer_id || null
  const trimDefaultPaintId =
    asText(js?.trim_paint_id) || orgDefaults?.trim_paint_id || null
  const trimDefaultPrimerId =
    asText(js?.trim_primer_id ?? js?.primer_id) || orgDefaults?.trim_primer_id || null
  const effectiveLaborRate =
    asNullableNumber(js?.override_labor_rate) ?? orgDefaults?.override_labor_rate ?? null
  const effectiveLaborDayEnabled =
    typeof js?.labor_day_policy_enabled === 'boolean'
      ? js.labor_day_policy_enabled
      : orgDefaults?.labor_day_policy_enabled
  const effectiveDayhours = asNullableNumber(js?.dayhours) ?? orgDefaults?.dayhours ?? null
  const effectiveRoundingIncrement =
    asNullableNumber(js?.rounding_increment_hours) ?? orgDefaults?.rounding_increment_hours ?? null
  const effectiveJobMinimumEnabled =
    typeof js?.job_minimum_enabled === 'boolean'
      ? js.job_minimum_enabled
      : orgDefaults?.job_minimum_enabled
  const effectiveJobMinimumAmount =
    asNullableNumber(js?.job_minimum_amount) ?? orgDefaults?.job_minimum_amount ?? null

  const calculationCatalogs = await loadEstimateV2CalculationCatalogs({
    requestOrigin,
    orgId,
    userId,
    estimateId: id,
  })

  const wallScopeRowsForSave = (roomWallScopes.data ?? []) as unknown as V2WallScopeSaveRow[]
  const wallScopePaintById = new Map<string, string | null>()
  const wallScopePrimerById = new Map<string, string | null>()
  const wallScopeRowsForCalc = wallScopeRowsForSave.map((row) => {
    const rowId = asText(row.id)
    const paintProductId = asText((row as unknown as Unsafe).paint_product_id) || null
    const primerProductId = asText((row as unknown as Unsafe).primer_product_id) || null
    if (rowId) wallScopePaintById.set(rowId, paintProductId)
    if (rowId) wallScopePrimerById.set(rowId, primerProductId)
    return {
      ...row,
      paint_product_id: paintProductId || wallDefaultPaintId,
      primer_product_id: primerProductId || wallDefaultPrimerId,
      paint_coats: asNullableNumberFromKeys(row as unknown as Unsafe, ['paint_coats', 'wall_coats', 'walls_topcoats']),
      primer_coats: asNullableNumberFromKeys(row as unknown as Unsafe, ['primer_coats', 'wall_primer_coats']),
      spot_prime_percent: asNullableNumberFromKeys(row as unknown as Unsafe, ['spot_prime_percent', 'wall_spot_prime_pct']),
    }
  })
  const wallCalculations = calculateWalls({
    scopes: wallScopeRowsForCalc,
    segments: (wallSegments.data ?? []) as unknown as V2WallSegmentSaveRow[],
    settings: {
      labor_rate_per_hour: effectiveLaborRate,
    },
    catalogs: calculationCatalogs.wall,
  })
  quoteWallScopes = ((wallCalculations.scopes ?? []) as Unsafe[]).map((row) => {
    const rowId = asText((row as Unsafe).id)
    const originalPaintProductId = rowId ? wallScopePaintById.get(rowId) : null
    const originalPrimerProductId = rowId ? wallScopePrimerById.get(rowId) : null
    return {
      ...row,
      paint_product_id: originalPaintProductId ?? (asText((row as Unsafe).paint_product_id) || null),
      primer_product_id: originalPrimerProductId ?? (asText((row as Unsafe).primer_product_id) || null),
    }
  })

  const ceilingScopeRowsForSave = (roomCeilingScopes.data ?? []) as unknown as V2CeilingScopeSaveRow[]
  const ceilingScopePaintById = new Map<string, string | null>()
  const ceilingScopePrimerById = new Map<string, string | null>()
  const ceilingScopeRowsForCalc = ceilingScopeRowsForSave.map((row) => {
    const rowId = asText(row.id)
    const paintProductId = asText((row as unknown as Unsafe).paint_product_id) || null
    const primerProductId = asText((row as unknown as Unsafe).primer_product_id) || null
    if (rowId) ceilingScopePaintById.set(rowId, paintProductId)
    if (rowId) ceilingScopePrimerById.set(rowId, primerProductId)
    return {
      ...row,
      paint_product_id: paintProductId || ceilingDefaultPaintId,
      primer_product_id: primerProductId || ceilingDefaultPrimerId,
    }
  })
  const ceilingCalculations = calculateCeilings({
    scopes: ceilingScopeRowsForCalc,
    segments: (ceilingScopeSegments.data ?? []) as unknown as V2CeilingSegmentSaveRow[],
    settings: {
      labor_rate_per_hour: effectiveLaborRate,
    },
    catalogs: calculationCatalogs.ceiling ?? undefined,
  })
  quoteCeilingScopes = ((ceilingCalculations.scopes ?? []) as Unsafe[]).map((row) => {
    const rowId = asText((row as Unsafe).id)
    const originalPaintProductId = rowId ? ceilingScopePaintById.get(rowId) : null
    const originalPrimerProductId = rowId ? ceilingScopePrimerById.get(rowId) : null
    return {
      ...row,
      paint_product_id: originalPaintProductId ?? (asText((row as Unsafe).paint_product_id) || null),
      primer_product_id: originalPrimerProductId ?? (asText((row as Unsafe).primer_product_id) || null),
    }
  })

  const roomModeById = resolveEstimateV2RoomModeById({
    rooms: (rooms.data ?? []) as unknown as Unsafe[],
    wallScopes: (roomWallScopes.data ?? []) as unknown as Unsafe[],
    ceilingScopes: (roomCeilingScopes.data ?? []) as unknown as Unsafe[],
  })
  const trimScopeRowsForSave = (roomTrimScopes.data ?? []) as unknown as V2TrimScopeSaveRow[]
  const trimScopePaintById = new Map<string, string | null>()
  const trimScopePrimerById = new Map<string, string | null>()
  const trimScopeRowsForCalc = trimScopeRowsForSave.map((row) => {
    const rowId = asText(row.id)
    const paintProductId = asText((row as unknown as Unsafe).paint_product_id) || null
    const primerProductId = asText((row as unknown as Unsafe).primer_product_id) || null
    if (rowId) trimScopePaintById.set(rowId, paintProductId)
    if (rowId) trimScopePrimerById.set(rowId, primerProductId)
    return {
      ...row,
      paint_product_id: paintProductId || trimDefaultPaintId,
      primer_product_id: primerProductId || trimDefaultPrimerId,
    }
  })
  const trimCalculations = calculateTrim({
    scopes: trimScopeRowsForCalc,
    rooms: ((rooms.data ?? []) as Unsafe[]).map((row) => {
      const roomId = asText(row.room_id).toUpperCase()
      return {
        room_id: roomId,
        length_in: asNullableNumber(row.length_in),
        width_in: asNullableNumber(row.width_in),
        mode: roomModeById.get(roomId) ?? 'RECT',
      }
    }),
    settings: {
      labor_rate_per_hour: effectiveLaborRate,
    },
    catalogs: calculationCatalogs.trim ?? undefined,
  })
  quoteTrimScopes = ((trimCalculations.scopes ?? []) as Unsafe[]).map((row) => {
    const rowId = asText((row as Unsafe).id)
    const originalPaintProductId = rowId ? trimScopePaintById.get(rowId) : null
    const originalPrimerProductId = rowId ? trimScopePrimerById.get(rowId) : null
    return {
      ...row,
      paint_product_id: originalPaintProductId ?? (asText((row as Unsafe).paint_product_id) || null),
      primer_product_id: originalPrimerProductId ?? (asText((row as Unsafe).primer_product_id) || null),
    }
  })

  const trimPaintInput = buildTrimPaintInput({
    jobsettings: js,
    catalogs: calculationCatalogs.trim ? productMap(calculationCatalogs.trim) : null,
  })
  const pricingSummary = buildEstimatePricingSummary(
    [wallCalculations, ceilingCalculations, trimCalculations],
    {
      enabled: effectiveLaborDayEnabled !== false,
      dayhours: effectiveDayhours ?? DEFAULT_DAY_HOURS,
      roundingIncrementHours: effectiveRoundingIncrement ?? DEFAULT_ROUNDING_INCREMENT_HOURS,
    },
    {
      enabled: effectiveJobMinimumEnabled === true,
      amount: effectiveJobMinimumAmount ?? DEFAULT_JOB_MINIMUM_AMOUNT,
    },
    trimPaintInput
  )

  return buildEstimateGetResponse({
    estimate: estimateRes.estimate,
    inputs: {
      jobsettings: jobsettings.data,
      org_defaults: orgDefaults,
      paint_products: calculationCatalogs.wall?.paint_products ?? [],
      rooms: rooms.data ?? [],
      room_wall_scopes: quoteWallScopes,
      segments: segments.data ?? [],
      wall_segments: wallSegments.data ?? [],
      ceiling_segments: ceilingSegments.data ?? [],
      room_ceiling_scopes: quoteCeilingScopes,
      ceiling_scope_segments: ceilingScopeSegments.data ?? [],
      room_trim_scopes: quoteTrimScopes,
      rollers: rollers.data ?? [],
      prejob: prejob.data ?? [],
      trim_items: trimItems.data ?? [],
      job_colors: jobColors.data ?? [],
      room_flags: roomFlags.data ?? [],
      access_fees: accessFees.data ?? [],
      other: other.data ?? [],
    },
    wall_calculations: wallCalculations,
    ceiling_calculations: ceilingCalculations,
    trim_calculations: trimCalculations,
    trim_paint: trimPaintInput,
    pricing_summary: pricingSummary,
  })
}

export async function saveEstimateV2Inputs(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
  body: Unsafe
  autosaveOnly: boolean
}) {
  const orgId = params.orgId
  const id = params.estimateId
  const userId = params.userId
  const requestOrigin = params.requestOrigin
  const estimateRes = await getEstimate(params.orgId, params.estimateId)
  if ('error' in estimateRes) {
    const message = asText(estimateRes.error) || 'Failed to load estimate'
    fail(message, message === 'Estimate not found' ? 404 : 500)
  }
  const estimate = estimateRes.estimate

  const body = params.body
  if (!body || typeof body !== 'object') fail('Missing body', 400)
  const autosaveOnly = params.autosaveOnly

  try {
    const useV2WallsSave =
      Array.isArray(body.room_wall_scopes) || Array.isArray(body.wall_segments)
    const useV2CeilingsSave = Array.isArray(body.room_ceiling_scopes)
    const useV2TrimSave = Array.isArray(body.room_trim_scopes)
    const useStructuredTransactionalSave =
      !useV2WallsSave &&
      !useV2CeilingsSave &&
      !useV2TrimSave &&
      (Array.isArray(body.job_colors) ||
        Array.isArray(body.room_flags) ||
        Array.isArray(body.access_fees))

    let v2RoomRows: V2RoomRosterRow[] | null = null
    let v2WallScopeRows: V2WallScopeSaveRow[] | null = null
    let v2WallSegmentRows: V2WallSegmentSaveRow[] | null = null
    let wallCalculations: ReturnType<typeof calculateWalls> | null = null
    let v2CeilingScopeRows: V2CeilingScopeSaveRow[] | null = null
    let v2CeilingSegmentRows: V2CeilingSegmentSaveRow[] | null = null
    let ceilingCalculations: ReturnType<typeof calculateCeilings> | null = null
    let v2TrimScopeRows: V2TrimScopeSaveRow[] | null = null
    let trimCalculations: ReturnType<typeof calculateTrim> | null = null
    let calculationCatalogs: Awaited<ReturnType<typeof loadEstimateV2CalculationCatalogs>> | null = null
    const ensureCalculationCatalogs = async () => {
      if (calculationCatalogs) return calculationCatalogs
      calculationCatalogs = await loadEstimateV2CalculationCatalogs({
        requestOrigin,
        orgId,
        userId,
        estimateId: id,
      })
      return calculationCatalogs
    }

    if (useV2WallsSave) {
      if (!Array.isArray(body.rooms)) {
        throw new Error('V2 walls save requires rooms')
      }

      v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      const roomIds = new Set(v2RoomRows.map((row) => row.room_id))
      const nextWallScopes = buildV2WallScopeRows(
        (Array.isArray(body.room_wall_scopes) ? body.room_wall_scopes : []) as Unsafe[],
        roomIds
      )
      v2WallScopeRows = nextWallScopes.scopeRows
      v2WallSegmentRows = buildV2WallSegmentRows(
        (Array.isArray(body.wall_segments) ? body.wall_segments : []) as Unsafe[],
        nextWallScopes.scopeRows
      )
      if (!autosaveOnly) {
        const laborRateFromBody = body.jobsettings
          ? asNullableNumber((body.jobsettings as Unsafe).override_labor_rate)
          : null
        let effectiveLaborRate = laborRateFromBody
        if (effectiveLaborRate == null) {
          const existingJobsettings = await supabaseAdmin
            .from('estimate_jobsettings')
            .select('override_labor_rate')
            .eq('org_id', orgId)
            .eq('estimate_id', id)
            .maybeSingle()
          if (!existingJobsettings.error) {
            effectiveLaborRate = asNullableNumber(existingJobsettings.data?.override_labor_rate)
          }
        }

        const wallCatalogs = await ensureCalculationCatalogs()

        wallCalculations = calculateWalls({
          scopes: v2WallScopeRows,
          segments: v2WallSegmentRows,
          settings: {
            labor_rate_per_hour: effectiveLaborRate,
          },
          catalogs: wallCatalogs.wall,
        })

        v2WallSegmentRows = wallCalculations.segments
      }
    }

    if (useV2CeilingsSave) {
      if (!Array.isArray(body.rooms)) {
        throw new Error('V2 ceiling save requires rooms')
      }

      if (!v2RoomRows) {
        v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      }
      const ceilingRoomIds = new Set(v2RoomRows.map((row) => row.room_id))

      const nextCeilingScopes = buildV2CeilingScopeRows(
        body.room_ceiling_scopes as Unsafe[],
        ceilingRoomIds
      )
      v2CeilingScopeRows = nextCeilingScopes.scopeRows

      v2CeilingSegmentRows = buildV2CeilingSegmentRows(
        (Array.isArray(body.ceiling_scope_segments) ? body.ceiling_scope_segments : []) as Unsafe[],
        nextCeilingScopes.scopeRows
      )
      if (!autosaveOnly) {
        const ceilingLaborRateFromBody = body.jobsettings
          ? asNullableNumber((body.jobsettings as Unsafe).override_labor_rate)
          : null
        let ceilingLaborRate = ceilingLaborRateFromBody
        if (ceilingLaborRate == null) {
          const existingJobsettings = await supabaseAdmin
            .from('estimate_jobsettings')
            .select('override_labor_rate')
            .eq('org_id', orgId)
            .eq('estimate_id', id)
            .maybeSingle()
          if (!existingJobsettings.error) {
            ceilingLaborRate = asNullableNumber(existingJobsettings.data?.override_labor_rate)
          }
        }

        const ceilingCatalogs = await ensureCalculationCatalogs()

        ceilingCalculations = calculateCeilings({
          scopes: v2CeilingScopeRows,
          segments: v2CeilingSegmentRows,
          settings: { labor_rate_per_hour: ceilingLaborRate },
          catalogs: ceilingCatalogs.ceiling ?? undefined,
        })

        v2CeilingSegmentRows = ceilingCalculations.segments as V2CeilingSegmentSaveRow[]
      }
    }

    if (useV2TrimSave) {
      if (!Array.isArray(body.rooms)) {
        throw new Error('V2 trim save requires rooms')
      }

      if (!v2RoomRows) {
        v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      }
      const trimRoomIds = new Set(v2RoomRows.map((row) => row.room_id))
      const nextTrimScopes = buildV2TrimScopeRows(
        body.room_trim_scopes as Unsafe[],
        trimRoomIds
      )
      v2TrimScopeRows = nextTrimScopes.scopeRows
      if (!autosaveOnly) {
        const trimLaborRateFromBody = body.jobsettings
          ? asNullableNumber((body.jobsettings as Unsafe).override_labor_rate)
          : null
        let trimLaborRate = trimLaborRateFromBody
        if (trimLaborRate == null) {
          const existingJobsettings = await supabaseAdmin
            .from('estimate_jobsettings')
            .select('override_labor_rate')
            .eq('org_id', orgId)
            .eq('estimate_id', id)
            .maybeSingle()
          if (!existingJobsettings.error) {
            trimLaborRate = asNullableNumber(existingJobsettings.data?.override_labor_rate)
          }
        }

        let trimRoomModeById: Map<string, 'RECT' | 'SEG'>
        if (v2WallScopeRows || v2CeilingScopeRows) {
          trimRoomModeById = resolveEstimateV2RoomModeById({
            rooms: (v2RoomRows as unknown as Unsafe[]),
            wallScopes: (v2WallScopeRows ?? []) as unknown as Unsafe[],
            ceilingScopes: (v2CeilingScopeRows ?? []) as unknown as Unsafe[],
          })
        } else {
          trimRoomModeById = await loadEstimateV2RoomModesForTrimFromDb({
            orgId,
            estimateId: id,
          })
        }

        const trimCatalogs = await ensureCalculationCatalogs()

        trimCalculations = calculateTrim({
          scopes: v2TrimScopeRows,
          rooms: v2RoomRows.map((room) => ({
            room_id: room.room_id,
            length_in: room.length_in,
            width_in: room.width_in,
            mode: trimRoomModeById.get(room.room_id) ?? 'RECT',
          })),
          settings: { labor_rate_per_hour: trimLaborRate },
          catalogs: trimCatalogs.trim ?? undefined,
        })

      }
    }

    if (useStructuredTransactionalSave) {
      const jobId = asText(estimate.job_id)
      if (uuid.test(jobId)) {
        try {
          await saveEstimateStructuredInputsTransactional({
            orgId,
            estimateId: id,
            jobId,
            payload: body as Record<string, unknown>,
          })
          return { ok: true as const }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed saving estimate inputs transactionally'
          if (
            !isMissingStructuredEstimateSaveRpc(message) &&
            !isRecoverableStructuredEstimateSaveRpcPkCollision(message)
          ) {
            throw error
          }
        }
      }
    }

    if (body.jobsettings) {
      const row = body.jobsettings as Unsafe
      const existingJobSettingsRes = await supabaseAdmin
        .from('estimate_jobsettings')
        .select('*')
        .eq('org_id', orgId)
        .eq('estimate_id', id)
        .maybeSingle()
      if (existingJobSettingsRes.error) throw new Error(existingJobSettingsRes.error.message)
      const existingRow = (existingJobSettingsRes.data ?? {}) as Unsafe
      const has = (key: string) => Object.prototype.hasOwnProperty.call(row, key)
      const trimPaintGallons = asNullableNumber(row.trim_paint_gallons)
      const trimPaintQuarts = asNullableNumber(row.trim_paint_quarts)
      const legacyTrimPaintQty = asNullableNumber(row.trim_paint_qty)
      const legacyTrimPaintUom = asText(row.trim_paint_uom).toLowerCase()
      const normalizedTrimPaintGallons =
        trimPaintGallons != null || trimPaintQuarts != null
          ? normalizeTrimPaintGallons(trimPaintGallons, trimPaintQuarts)
          : legacyTrimPaintQty != null
            ? legacyTrimPaintUom === 'quart'
              ? legacyTrimPaintQty / 4
              : legacyTrimPaintQty
            : null
      const normalizedTrimPaintQuarts =
        trimPaintQuarts != null
          ? trimPaintQuarts
          : legacyTrimPaintQty != null && legacyTrimPaintUom === 'quart'
            ? legacyTrimPaintQty
            : 0
      const upsert = await supabaseAdmin.from('estimate_jobsettings').upsert(
        {
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          walls_paint_id: has('walls_paint_id') ? asText(row.walls_paint_id) || null : existingRow.walls_paint_id,
          ceiling_paint_id: has('ceiling_paint_id') ? asText(row.ceiling_paint_id) || null : existingRow.ceiling_paint_id,
          trim_paint_id: has('trim_paint_id') ? asText(row.trim_paint_id) || null : existingRow.trim_paint_id,
          primer_id:
            has('primer_id') || has('walls_primer_id') || has('ceiling_primer_id') || has('trim_primer_id')
              ? asText(row.primer_id) ||
                asText(row.walls_primer_id) ||
                asText(row.ceiling_primer_id) ||
                asText(row.trim_primer_id) ||
                null
              : existingRow.primer_id,
          walls_primer_id: has('walls_primer_id') ? asText(row.walls_primer_id) || null : existingRow.walls_primer_id,
          ceiling_primer_id: has('ceiling_primer_id') ? asText(row.ceiling_primer_id) || null : existingRow.ceiling_primer_id,
          trim_primer_id: has('trim_primer_id') ? asText(row.trim_primer_id) || null : existingRow.trim_primer_id,
          override_labor_rate: has('override_labor_rate') ? asNullableNumber(row.override_labor_rate) : existingRow.override_labor_rate,
          override_markup: has('override_markup') ? asNullableNumber(row.override_markup) : existingRow.override_markup,
          rounding_increment_hours: has('rounding_increment_hours') ? asNullableNumber(row.rounding_increment_hours) : existingRow.rounding_increment_hours,
          dayhours: has('dayhours') ? asNullableNumber(row.dayhours) : existingRow.dayhours,
          default_walls_prep_level: has('default_walls_prep_level') ? asText(row.default_walls_prep_level) || null : existingRow.default_walls_prep_level,
          default_ceiling_prep_level: has('default_ceiling_prep_level') ? asText(row.default_ceiling_prep_level) || null : existingRow.default_ceiling_prep_level,
          default_trim_prep_level: has('default_trim_prep_level') ? asText(row.default_trim_prep_level) || null : existingRow.default_trim_prep_level,
          notes: has('notes') ? asText(row.notes) || null : existingRow.notes,
          walls_paint_gal_override: has('walls_paint_gal_override') ? asNullableNumber(row.walls_paint_gal_override) : existingRow.walls_paint_gal_override,
          ceiling_paint_gal_override: has('ceiling_paint_gal_override') ? asNullableNumber(row.ceiling_paint_gal_override) : existingRow.ceiling_paint_gal_override,
          primer_gal_override: has('primer_gal_override') ? asNullableNumber(row.primer_gal_override) : existingRow.primer_gal_override,
          extra_supplies_walls: has('extra_supplies_walls') ? asNullableNumber(row.extra_supplies_walls) : existingRow.extra_supplies_walls,
          extra_supplies_ceilings: has('extra_supplies_ceilings') ? asNullableNumber(row.extra_supplies_ceilings) : existingRow.extra_supplies_ceilings,
          extra_supplies_trim: has('extra_supplies_trim') ? asNullableNumber(row.extra_supplies_trim) : existingRow.extra_supplies_trim,
          trim_paint_gallons:
            has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
              ? normalizedTrimPaintGallons
              : existingRow.trim_paint_gallons,
          trim_paint_quarts:
            has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
              ? normalizedTrimPaintQuarts
              : existingRow.trim_paint_quarts,
          trim_paint_qty:
            has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
              ? normalizedTrimPaintGallons
              : existingRow.trim_paint_qty,
          trim_paint_uom:
            has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
              ? normalizedTrimPaintGallons != null ? 'Gallon' : null
              : existingRow.trim_paint_uom,
          trim_primer_qty: has('trim_primer_qty') ? asNullableNumber(row.trim_primer_qty) : existingRow.trim_primer_qty,
          trim_primer_uom: has('trim_primer_uom') ? asText(row.trim_primer_uom) || null : existingRow.trim_primer_uom,
          paint_supplied_by: has('paint_supplied_by') ? asText(row.paint_supplied_by) || null : existingRow.paint_supplied_by,
          crew_size: has('crew_size') ? asNullableNumber(row.crew_size) : existingRow.crew_size,
          labor_day_policy_enabled: has('labor_day_policy_enabled')
            ? typeof row.labor_day_policy_enabled === 'boolean'
              ? row.labor_day_policy_enabled
              : row.labor_day_policy_enabled == null ? undefined : Boolean(row.labor_day_policy_enabled)
            : existingRow.labor_day_policy_enabled,
          job_minimum_enabled: has('job_minimum_enabled')
            ? typeof row.job_minimum_enabled === 'boolean'
              ? row.job_minimum_enabled
              : row.job_minimum_enabled == null ? undefined : Boolean(row.job_minimum_enabled)
            : existingRow.job_minimum_enabled,
          job_minimum_amount: has('job_minimum_amount') ? asNullableNumber(row.job_minimum_amount) : existingRow.job_minimum_amount,
        },
        { onConflict: 'org_id,estimate_id' }
      )
      if (upsert.error) throw new Error(upsert.error.message)
    }

    if (Array.isArray(body.rooms)) {
      if (useV2WallsSave) {
        await saveV2RoomRoster({
          orgId,
          estimateId: id,
          jobId: asText(estimate.job_id),
          rows: v2RoomRows ?? [],
        })
      } else {
        const remove = await supabaseAdmin
          .from('estimate_rooms')
          .delete()
          .eq('org_id', orgId)
          .eq('estimate_id', id)
        if (remove.error) throw new Error(remove.error.message)

        const usedRoomIds = new Set<string>()
        const rows = body.rooms
          .map((row: Unsafe, idx: number) => {
            const wallsInclude = toYN(row.walls_include, 'Y')
            const ceilingInclude = toYN(row.ceiling_include, 'N')
            const doorsInclude = toYN(row.doors_include, 'N')
            const drywallInclude = toYN(row.drywall_include, 'N')
            const mode = asText(row.mode || 'RECT').toUpperCase() === 'SEG' ? 'SEG' : 'RECT'
            const rawRoomId = asText(row.room_id).toUpperCase()
            const roomId = rawRoomId && !usedRoomIds.has(rawRoomId) ? rawRoomId : nextRoomId(usedRoomIds, idx + 1)
            usedRoomIds.add(roomId)
            const height = asNullableNumber(row.wallheight_in ?? row.height_in)
            const wallColorId = wallsInclude === 'Y' ? toColorId(row.wall_color_id) || 'A' : null
            const trimInclude = toYN(row.trim_include, 'N')
            const baseboardTypeId = trimInclude === 'Y' ? asText(row.baseboard_type_id) || null : null
            const crownTypeId = asText(row.crown_type_id) || null
            const paintCrown = toYN(row.paint_crown, 'N') === 'Y' || !!crownTypeId ? 'Y' : 'N'
            const windowCasingTypeId = trimInclude === 'Y' ? asText(row.window_casing_type_id) || null : null
            const doorCasingTypeId = trimInclude === 'Y' ? asText(row.door_casing_type_id) || null : null
            const doorTypeId = trimInclude === 'Y' ? asText(row.door_type_id) || null : null
            const baseboardLf = trimInclude === 'Y' ? asNullableNumber(row.baseboard_lf) : null
            const crownLf = trimInclude === 'Y' ? asNullableNumber(row.crown_lf) : null
            const windowCount = trimInclude === 'Y' ? asNullableNumber(row.window_count) : null
            const doorCasingCount = trimInclude === 'Y' ? asNullableNumber(row.door_casing_count) : null
            const doorPaintCount = trimInclude === 'Y' ? asNullableNumber(row.door_paint_count) : null
            const doorSides = trimInclude === 'Y' ? asNullableNumber(row.door_sides) : null
            const doorCount = doorCasingCount ?? doorPaintCount ?? asNullableNumber(row.door_count)
            const baseboardAuto = trimInclude === 'Y' && mode === 'RECT' ? toYN(row.baseboard_auto, 'N') : 'N'
            const crownAuto = trimInclude === 'Y' && mode === 'RECT' ? toYN(row.crown_auto, 'N') : 'N'
            const autoCalcTrimPerimeter = baseboardAuto === 'Y' || crownAuto === 'Y' ? 'Y' : 'N'
            return {
              org_id: orgId,
              estimate_id: id,
              job_id: estimate.job_id,
              position: idx,
              room_id: roomId,
              room_name: asText(row.room_name),
              room_type_id: asText(row.room_type_id).toUpperCase() || null,
              mode,
              length_in: mode === 'RECT' ? asNullableNumber(row.length_in) : null,
              width_in: mode === 'RECT' ? asNullableNumber(row.width_in) : null,
              wallheight_in: height,
              ceilingheight_in:
                asNullableNumber(row.ceilingheight_in ?? row.height_in ?? row.wallheight_in) ?? height,
              ceilingsqft_override:
                ceilingInclude === 'Y' ? asNullableNumber(row.ceilingsqft_override) : null,
              baseexclude_in: mode === 'RECT' ? asNullableNumber(row.baseexclude_in) : null,
              walls_include: wallsInclude,
              walls_primer: asText(row.walls_primer || row.wall_primer_mode) || null,
              walls_topcoats:
                wallsInclude === 'Y'
                  ? asNullableNumber(row.walls_topcoats ?? row.wall_coats)
                  : null,
              wall_primer_coats:
                wallsInclude === 'Y'
                  ? asNullableNumber(row.wall_primer_coats)
                  : null,
              wall_spot_prime_pct:
                wallsInclude === 'Y'
                  ? asNullableNumber(row.wall_spot_prime_pct)
                  : null,
              walls_prep_override: asText(row.walls_prep_override) || null,
              walls_prep_level:
                wallsInclude === 'Y'
                  ? asText(row.walls_prep_level || row.walls_prep_override) || null
                  : null,
              wall_complexity_id:
                asText(
                  row.wall_complexity_id ||
                    row.wall_complexity_type_id ||
                    row.wallcomplexitytypeid
                ).toUpperCase() || null,
              wall_sqft_override: wallsInclude === 'Y' ? asNullableNumber(row.wall_sqft_override) : null,
              openings_sqft: wallsInclude === 'Y' ? asNullableNumber(row.openings_sqft) : null,
              walls_notes: wallsInclude === 'Y' ? asText(row.walls_notes) || null : null,
              ceiling_include: ceilingInclude,
              ceiling_primer: ceilingInclude === 'Y' ? asText(row.ceiling_primer) || null : null,
              ceiling_topcoats: ceilingInclude === 'Y' ? asNullableNumber(row.ceiling_topcoats) : null,
              ceiling_prep_level:
                ceilingInclude === 'Y'
                  ? asText(row.ceiling_prep_level || row.ceiling_prep_override) || null
                  : null,
              ceiling_prep_override:
                ceilingInclude === 'Y' ? asText(row.ceiling_prep_override) || null : null,
              ceiling_height_surcharge:
                ceilingInclude === 'Y' ? asNullableNumber(row.ceiling_height_surcharge) : null,
              trim_include: trimInclude,
              doors_include: doorsInclude,
              drywall_include: drywallInclude,
              trim_primer: asText(row.trim_primer) || null,
              trim_topcoats: asNullableNumber(row.trim_topcoats),
              trim_prep_override: asText(row.trim_prep_override) || null,
              doors_prep_override: asText(row.doors_prep_override) || null,
              paint_base: baseboardTypeId ? 'Y' : 'N',
              paint_crown: paintCrown,
              paint_window_casing: windowCasingTypeId ? 'Y' : 'N',
              paint_door_casing: doorCasingTypeId ? 'Y' : 'N',
              paint_doors: doorsInclude === 'Y' || doorTypeId ? 'Y' : 'N',
              door_count: doorCount,
              window_count: windowCount,
              baseboard_lf: baseboardLf,
              crown_lf: crownLf,
              baseboard_type_id: baseboardTypeId,
              baseboard_auto: baseboardAuto,
              crown_type_id: crownTypeId,
              crown_auto: crownAuto,
              window_casing_type_id: windowCasingTypeId,
              door_casing_type_id: doorCasingTypeId,
              door_casing_count: doorCasingCount,
              door_type_id: doorTypeId,
              door_paint_count: doorPaintCount,
              door_sides: doorSides,
              auto_calc_trim_perimeter: autoCalcTrimPerimeter,
              wall_color_id: wallColorId,
              ceiling_type_id:
                ceilingInclude === 'Y' ? asText(row.ceiling_type_id).toUpperCase() || 'FLAT' : null,
              paint_supplied_by: asText(row.paint_supplied_by) || null,
              notes: asText(row.notes) || null,
            }
          })
          .filter((row: { room_name: string }) => row.room_name)

        if (rows.length) {
          const insert = await supabaseAdmin.from('estimate_rooms').insert(rows)
          if (insert.error) throw new Error(insert.error.message)
        }
      }
    }

    if (useV2WallsSave) {
      await softReplaceRows({
        table: 'estimate_room_wall_scopes',
        orgId,
        estimateId: id,
        rows: (v2WallScopeRows ?? []).map((row) => ({
          id: row.id,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          room_id: row.room_id,
          position: row.position,
          mode: row.mode,
          include: row.include,
          scope_name: row.scope_name,
          color_id: row.color_id,
          paint_product_id: row.paint_product_id,
          primer_product_id: row.primer_product_id,
          prime_mode: row.prime_mode,
          height_in: row.height_in,
          perimeter_in: row.perimeter_in,
          standard_door_count: row.standard_door_count,
          standard_window_count: row.standard_window_count,
          height_factor: row.height_factor,
          complexity_factor: row.complexity_factor,
          wall_flag_factor: row.wall_flag_factor,
          cut_in_top_factor: row.cut_in_top_factor,
          cut_in_bottom_factor: row.cut_in_bottom_factor,
          paint_coats: row.paint_coats,
          primer_coats: row.primer_coats,
          spot_prime_percent: row.spot_prime_percent,
          raw_area_sf: row.raw_area_sf,
          override_area_sf: row.override_area_sf,
          effective_area_sf: row.effective_area_sf,
          raw_paint_hours: row.raw_paint_hours,
          override_paint_hours: row.override_paint_hours,
          effective_paint_hours: row.effective_paint_hours,
          raw_primer_hours: row.raw_primer_hours,
          override_primer_hours: row.override_primer_hours,
          effective_primer_hours: row.effective_primer_hours,
          raw_paint_gallons: row.raw_paint_gallons,
          override_paint_gallons: row.override_paint_gallons,
          effective_paint_gallons: row.effective_paint_gallons,
          raw_primer_gallons: row.raw_primer_gallons,
          override_primer_gallons: row.override_primer_gallons,
          effective_primer_gallons: row.effective_primer_gallons,
          raw_supply_cost: row.raw_supply_cost,
          override_supply_cost: row.override_supply_cost,
          effective_supply_cost: row.effective_supply_cost,
          raw_total: row.raw_total,
          override_total: row.override_total,
          effective_total: row.effective_total,
          notes: row.notes,
        })),
      })

      const segNoByScope = new Map<string, number>()
      await softReplaceWallSegments({
        orgId,
        estimateId: id,
        rows: (v2WallSegmentRows ?? []).map((row) => {
          const nextSegNo = (segNoByScope.get(row.wall_scope_id) ?? 0) + 1
          segNoByScope.set(row.wall_scope_id, nextSegNo)
          return {
            id: row.id,
            org_id: orgId,
            estimate_id: id,
            job_id: estimate.job_id,
            wall_scope_id: row.wall_scope_id,
            room_id: row.room_id,
            position: row.position,
            seg_no: nextSegNo,
            segment_name: row.segment_name,
            include: row.include,
            shape_type: row.shape_type,
            quantity: row.quantity,
            width_in: row.width_in,
            height_in: row.height_in,
            base_in: row.base_in,
            manual_area_sf: row.manual_area_sf,
            standard_door_count: row.standard_door_count,
            standard_window_count: row.standard_window_count,
            raw_area_sf: row.raw_area_sf,
            override_area_sf: row.override_area_sf,
            effective_area_sf: row.effective_area_sf,
            notes: row.notes,
          }
        }),
      })
    }

    if (useV2CeilingsSave) {
      await softReplaceRows({
        table: 'estimate_room_ceiling_scopes',
        orgId,
        estimateId: id,
        rows: (v2CeilingScopeRows ?? []).map((row) => ({
          id: row.id,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          room_id: row.room_id,
          position: row.position,
          mode: row.mode,
          include: row.include,
          scope_name: row.scope_name,
          color_id: row.color_id,
          paint_product_id: row.paint_product_id,
          primer_product_id: row.primer_product_id,
          prime_mode: row.prime_mode,
          spot_prime_percent: row.spot_prime_percent,
          ceiling_type_id: row.ceiling_type_id,
          length_in: row.length_in,
          width_in: row.width_in,
          area_sf: row.area_sf,
          height_factor: row.height_factor,
          complexity_factor: row.complexity_factor,
          ceiling_flag_factor: row.ceiling_flag_factor,
          override_area_sf: row.override_area_sf,
          override_paint_hours: row.override_paint_hours,
          override_primer_hours: row.override_primer_hours,
          override_paint_gallons: row.override_paint_gallons,
          override_primer_gallons: row.override_primer_gallons,
          override_supply_cost: row.override_supply_cost,
          override_total: row.override_total,
          raw_area_sf: row.raw_area_sf,
          effective_area_sf: row.effective_area_sf,
          raw_paint_hours: row.raw_paint_hours,
          effective_paint_hours: row.effective_paint_hours,
          raw_primer_hours: row.raw_primer_hours,
          effective_primer_hours: row.effective_primer_hours,
          raw_paint_gallons: row.raw_paint_gallons,
          effective_paint_gallons: row.effective_paint_gallons,
          raw_primer_gallons: row.raw_primer_gallons,
          effective_primer_gallons: row.effective_primer_gallons,
          raw_supply_cost: row.raw_supply_cost,
          effective_supply_cost: row.effective_supply_cost,
          raw_total: row.raw_total,
          effective_total: row.effective_total,
          paint_coats: row.paint_coats,
          primer_coats: row.primer_coats,
          notes: row.notes,
        })),
      })

      await softReplaceRows({
        table: 'estimate_room_ceiling_scope_segments',
        orgId,
        estimateId: id,
        rows: (v2CeilingSegmentRows ?? []).map((row) => ({
          id: row.id,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          ceiling_scope_id: row.ceiling_scope_id,
          room_id: row.room_id,
          position: row.position,
          segment_name: row.segment_name,
          include: row.include,
          shape_type: row.shape_type,
          quantity: row.quantity,
          width_in: row.width_in,
          height_in: row.height_in,
          base_in: row.base_in,
          manual_area_sf: row.manual_area_sf,
          raw_area_sf: row.raw_area_sf,
          override_area_sf: row.override_area_sf,
          effective_area_sf: row.effective_area_sf,
          notes: row.notes,
        })),
      })
    }

    if (useV2TrimSave) {
      await softReplaceRows({
        table: 'estimate_room_trim_scopes',
        orgId,
        estimateId: id,
        rows: (v2TrimScopeRows ?? []).map((row) => ({
          id: row.id,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          room_id: row.room_id,
          position: row.position,
          include: row.include,
          scope_name: row.scope_name,
          trim_type_id: row.trim_type_id,
          trim_family: row.trim_family,
          unit_type: row.unit_type,
          measurement_mode: row.measurement_mode,
          helper_source: row.helper_source,
          measurement_value: row.measurement_value,
          helper_value: row.helper_value,
          color_id: row.color_id,
          paint_product_id: row.paint_product_id,
          primer_product_id: row.primer_product_id,
          paint_enabled: row.paint_enabled,
          prime_mode: row.prime_mode,
          spot_prime_percent: row.spot_prime_percent,
          production_rate_id: row.production_rate_id,
          prep_factor: row.prep_factor,
          height_factor: row.height_factor,
          profile_factor: row.profile_factor,
          room_flag_factor: row.room_flag_factor,
          masking_factor: row.masking_factor,
          stair_factor: row.stair_factor,
          difficult_finish_factor: row.difficult_finish_factor,
          caulk_fill_factor: row.caulk_fill_factor,
          override_measurement: row.override_measurement,
          override_hours: row.override_hours,
          override_gallons: row.override_gallons,
          override_supply_cost: row.override_supply_cost,
          override_total: row.override_total,
          override_description: row.override_description,
          raw_measurement: row.raw_measurement,
          effective_measurement: row.effective_measurement,
          raw_paint_hours: row.raw_paint_hours,
          effective_paint_hours: row.effective_paint_hours,
          raw_primer_hours: row.raw_primer_hours,
          effective_primer_hours: row.effective_primer_hours,
          raw_paint_gallons: row.raw_paint_gallons,
          effective_paint_gallons: row.effective_paint_gallons,
          raw_primer_gallons: row.raw_primer_gallons,
          effective_primer_gallons: row.effective_primer_gallons,
          raw_supply_cost: row.raw_supply_cost,
          effective_supply_cost: row.effective_supply_cost,
          raw_total: row.raw_total,
          effective_total: row.effective_total,
          paint_coats: row.paint_coats,
          primer_coats: row.primer_coats,
          paint_prod_rate_units_per_hour: row.paint_prod_rate_units_per_hour,
          primer_prod_rate_units_per_hour: row.primer_prod_rate_units_per_hour,
          paint_coverage_units_per_gal_per_coat: row.paint_coverage_units_per_gal_per_coat,
          primer_coverage_units_per_gal_per_coat: row.primer_coverage_units_per_gal_per_coat,
          area_supply_cost_per_unit: row.area_supply_cost_per_unit,
          per_color_supply_cost: row.per_color_supply_cost,
          labor_rate_per_hour: row.labor_rate_per_hour,
          paint_price_per_gal: row.paint_price_per_gal,
          primer_price_per_gal: row.primer_price_per_gal,
          notes: row.notes,
        })),
      })
    }

    if (Array.isArray(body.segments)) {
      const segNoByRoom = new Map<string, number>()
      const rows = body.segments
        .map((row: Unsafe, idx: number) => {
          const roomId = asText(row.room_id) || null
          const existingNo = asNullableNumber(row.seg_no)
          const nextNo = roomId ? (segNoByRoom.get(roomId) ?? 0) + 1 : null
          const segNo = existingNo ?? nextNo
          if (roomId && segNo != null) {
            segNoByRoom.set(roomId, segNo)
          }
          return {
            id: asText(row.id) || undefined,
            org_id: orgId,
            estimate_id: id,
            job_id: estimate.job_id,
            position: idx,
            room_id: roomId,
            seg_no: segNo,
            seglen_in: asNullableNumber(row.seglen_in),
            seg_wallheight_in: asNullableNumber(row.seg_wallheight_in ?? row.segwallheight_in),
            wall_complexity_type_id: asText(row.wall_complexity_type_id).toUpperCase() || 'STANDARD',
            walls_calc_method: toWallsCalcMethod(
              row.walls_calc_method ?? row.wallscalcmethod ?? row.walls_calcmethod
            ),
            panel_length_in: asNullableNumber(row.panel_length_in),
            panel_height_bottom_in: asNullableNumber(row.panel_height_bottom_in),
            panel_height_top_in: asNullableNumber(row.panel_height_top_in),
            baseexclude_in: asNullableNumber(row.baseexclude_in),
            notes: asText(row.notes) || null,
            wall_label: asText(row.wall_label) || null,
            wall_color_override_id: toColorId(row.wall_color_override_id) || null,
            active: toYN(row.active, 'Y'),
          }
        })
        .filter((row: { room_id: string | null; seg_no: number | null }) => row.room_id && row.seg_no != null)
      await softReplaceRows({ table: 'estimate_segments', orgId, estimateId: id, rows })
    }

    if (Array.isArray(body.ceiling_segments)) {
      const segNoByRoom = new Map<string, number>()
      const rows = body.ceiling_segments
        .map((row: Unsafe, idx: number) => {
          const roomId = asText(row.room_id) || null
          const existingNo = asNullableNumber(row.seg_no)
          const nextNo = roomId ? (segNoByRoom.get(roomId) ?? 0) + 1 : null
          const segNo = existingNo ?? nextNo
          if (roomId && segNo != null) {
            segNoByRoom.set(roomId, segNo)
          }
          return {
            id: asText(row.id) || undefined,
            org_id: orgId,
            estimate_id: id,
            job_id: estimate.job_id,
            position: idx,
            room_id: roomId,
            seg_no: segNo,
            length_in: asNullableNumber(row.length_in),
            width_in: asNullableNumber(row.width_in),
            ceiling_height_in: asNullableNumber(
              row.ceiling_height_in ?? row.ceilingheight_in ?? row.height_in ?? row.seg_ceiling_height_in
            ),
            notes: asText(row.notes) || null,
            active: toYN(row.active, 'Y'),
          }
        })
        .filter((row: { room_id: string | null; seg_no: number | null }) => row.room_id && row.seg_no != null)
      await softReplaceRows({ table: 'estimate_ceiling_segments', orgId, estimateId: id, rows })
    }

    if (Array.isArray(body.rollers)) {
      const rows = body.rollers
        .map((row: Unsafe, idx: number) => ({
          id: asText(row.id) || undefined,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          position: idx,
          scope: asText(row.scope) === 'Ceiling' ? 'Ceiling' : 'Wall',
          wall_color_id: toColorId(row.wall_color_id) || null,
          roller_size_in: asNullableNumber(row.roller_size_in),
          covers_qty: asNullableNumber(row.covers_qty),
          notes: asText(row.notes) || null,
          active: toYN(row.active, 'Y'),
        }))
        .filter((row) => row.scope === 'Ceiling' || !!row.wall_color_id)
      await softReplaceRows({ table: 'estimate_rollers', orgId, estimateId: id, rows })
    }

    if (Array.isArray(body.job_colors)) {
      const rows = body.job_colors
        .map((row: Unsafe, idx: number) => ({
          id: asText(row.id) || undefined,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          position: idx,
          color_id: asText(row.color_id || row.wall_color_id).toUpperCase(),
          color_name: asText(row.color_name) || null,
          roller_cover_id: asText(row.roller_cover_id).toUpperCase() || null,
          roller_cover_qty: asNullableNumber(row.roller_cover_qty),
          active: toYN(row.active, 'Y'),
        }))
        .filter((row: { color_id: string }) => !!row.color_id)
      await softReplaceRows({ table: 'estimate_job_colors', orgId, estimateId: id, rows })
    }

    if (Array.isArray(body.room_flags)) {
      const validRoomIds = new Set(
        (Array.isArray(body.rooms) ? body.rooms : []).map((r: Unsafe) => asText(r.room_id).toUpperCase())
      )
      const rows = body.room_flags
        .map((row: Unsafe, idx: number) => ({
          id: asText(row.id) || undefined,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          position: idx,
          room_id: asText(row.room_id).toUpperCase() || null,
          flag_id: asText(row.flag_id).toUpperCase(),
          active: toYN(row.active, 'Y'),
        }))
        .filter((row: { room_id: string | null; flag_id: string }) =>
          !!(row.room_id && row.flag_id && validRoomIds.has(row.room_id))
        )
      await softReplaceRows({ table: 'estimate_room_flags', orgId, estimateId: id, rows })
    }

    if (Array.isArray(body.access_fees)) {
      const rows = body.access_fees
        .map((row: Unsafe, idx: number) => ({
          id: asText(row.id) || undefined,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          position: idx,
          room_id: asText(row.room_id).toUpperCase() || null,
          segment_num: asNullableNumber(row.segment_num ?? row.segment_id),
          access_fee_id: asText(row.access_fee_id).toUpperCase(),
          qty: asNullableNumber(row.qty) ?? 1,
          active: toYN(row.active, 'Y'),
          notes: asText(row.notes) || null,
          actual_cost_override: asNullableNumber(row.actual_cost_override),
        }))
        .filter((row: { room_id: string | null; access_fee_id: string }) => !!(row.room_id && row.access_fee_id))
      await softReplaceRows({ table: 'estimate_access_fees', orgId, estimateId: id, rows })
    }

    if (Array.isArray(body.prejob)) {
      const rows = body.prejob
        .map((row: Unsafe, idx: number) => {
          const hasTemplateTask = !!asText(row.task_template_id)
          const quantity = asNullableNumber(row.qty ?? row.man_qty)
          return {
            id: asText(row.id) || undefined,
            org_id: orgId,
            estimate_id: id,
            job_id: estimate.job_id,
            position: idx,
            category: asText(row.category || row.rollup_scope) || null,
            trip_name: asText(row.trip_name || row.manual_task_name || row.man_trip_name) || null,
            trip_num: asNullableNumber(row.trip_num),
            rollup_scope: asText(row.rollup_scope || row.category) || null,
            man_trip_name:
              hasTemplateTask ? null : asText(row.manual_task_name || row.man_trip_name || row.trip_name) || null,
            man_qty: hasTemplateTask ? null : quantity,
            man_hours_each: asNullableNumber(row.man_hours_each ?? row.hours_each),
            task:
              asText(
                row.task_name || row.task_label || row.manual_task_name || row.man_trip_name || row.trip_name || row.task
              ) || null,
            qty: hasTemplateTask ? quantity : null,
            hours_each: asNullableNumber(row.hours_each),
            laborrate: asNullableNumber(row.laborrate ?? row.man_hours_each),
            markup: asNullableNumber(row.markup),
            extra_supplies: asNullableNumber(row.extra_supplies),
            notes: asText(row.notes) || null,
            active: toYN(row.active, 'Y'),
          }
        })
        .filter((row: { task: string | null; man_trip_name: string | null; trip_name: string | null }) => !!(row.task || row.man_trip_name || row.trip_name))
      await softReplaceRows({ table: 'estimate_prejob', orgId, estimateId: id, rows })
    }

    if (Array.isArray(body.trim_items)) {
      const rows = body.trim_items
        .map((row: Unsafe, idx: number) => ({
          id: asText(row.id) || undefined,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          room_id: asText(row.room_id) || null,
          trim_menu_id: asText(row.trim_menu_id),
          qty: asNullableNumber(row.qty),
          coats: asNullableNumber(row.coats),
          auto_calc: toYN(row.auto_calc, 'N'),
          primer_mode: asText(row.primer_mode) || null,
          spot_prime_pct: asNullableNumber(row.spot_prime_pct),
          prep_level_override: asText(row.prep_level_override) || null,
          door_sides: asNullableNumber(row.door_sides),
          notes: asText(row.notes) || null,
          active: toYN(row.active, 'Y'),
          sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : idx,
        }))
        .filter((row: { trim_menu_id: string; qty: number | null }) => row.trim_menu_id && (row.qty ?? 0) > 0)
      await softReplaceRows({ table: 'estimate_trim_items', orgId, estimateId: id, rows })
    }

    if (Array.isArray(body.other)) {
      const rows = body.other.map((row: Unsafe, idx: number) => {
        const rollupScope = toOtherRollupScope(
          pickValue(row, ['rollup_scope', 'rollupScope', 'RollupScope'])
        )
        if (!rollupScope) {
          throw new Error(`Other row ${idx + 1}: RollupScope must be Walls, Ceilings, or Trim`)
        }
        const clientDescription = asText(
          pickValue(row, ['client_description', 'clientDescription', 'ClientDescription'])
        )
        if (!clientDescription) {
          throw new Error(`Other row ${idx + 1}: ClientDescription is required`)
        }
        const qtyRaw = pickValue(row, ['qty', 'Qty'])
        const qty = qtyRaw == null || qtyRaw === '' ? 1 : asNullableNumber(qtyRaw)
        if (qty == null || qty <= 0) {
          throw new Error(`Other row ${idx + 1}: Qty must be numeric and greater than 0`)
        }
        const laborHrsEach = asNullableNumber(
          pickValue(row, ['labor_hrs_each', 'laborHrsEach', 'LaborHrs_Each'])
        )
        if (laborHrsEach == null || laborHrsEach < 0) {
          throw new Error(`Other row ${idx + 1}: LaborHrs_Each must be numeric and >= 0`)
        }
        const materialsEach = asNullableNumber(
          pickValue(row, ['materials_each', 'materialsEach', 'Materials$_Each'])
        )
        if (materialsEach == null || materialsEach < 0) {
          throw new Error(`Other row ${idx + 1}: Materials$_Each must be numeric and >= 0`)
        }
        return {
          id: asText(row.id) || undefined,
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          position: idx,
          rollup_scope: rollupScope,
          location: asText(pickValue(row, ['location', 'Location'])) || null,
          client_description: clientDescription,
          qty,
          uom: asText(pickValue(row, ['uom', 'UOM'])) || null,
          labor_hrs_each: laborHrsEach,
          materials_each: materialsEach,
          notes: asText(pickValue(row, ['notes', 'Notes'])) || null,
          active: toYN(pickValue(row, ['active', 'Active?', 'Active']), 'Y'),
        }
      })
      await softReplaceRows({ table: 'estimate_other', orgId, estimateId: id, rows })
    }

    if (autosaveOnly) {
      return { ok: true as const, autosave: true as const }
    }
    if (useV2WallsSave || useV2CeilingsSave || useV2TrimSave) {
      return {
        ok: true,
        wall_calculations: wallCalculations,
        ceiling_calculations: ceilingCalculations,
        trim_calculations: trimCalculations,
      }
    }
    return { ok: true as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed saving estimate inputs'
    fail(message, 400)
  }
}

export async function deleteEstimateV2(params: { orgId: string; estimateId: string }) {
  const estimateRes = await getEstimate(params.orgId, params.estimateId)
  if ('error' in estimateRes) {
    const message = asText(estimateRes.error) || 'Failed to load estimate'
    fail(message, message === 'Estimate not found' ? 404 : 500)
  }

  const remove = await supabaseAdmin
    .from('estimates')
    .delete()
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
  if (remove.error) {
    fail(remove.error.message, 500)
  }

  return { ok: true as const }
}
