import { supabaseAdmin } from '../org.ts'
import { calculateWalls } from '../../estimator/walls.ts'
import { calculateCeilings } from '../../estimator/ceilings.ts'
import { calculateTrim } from '../../estimator/trim.ts'
import { buildEstimatePricingSummary, buildPerJobSupplyCost } from '../../estimator/pricingPolicies.ts'
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from '../../estimator/defaults.ts'
import { productMap } from '../../estimator/wallsHelpers.ts'
import { asNullableNumber, asNullableNumberFromKeys, asText, type UnsafeRecord as Unsafe } from '../../estimator/parsing.ts'
import {
  normalizeConditionSelections,
  resolveConditionFactor,
  type EstimateV2ConditionScope,
} from '../../estimator/conditionModifiers.ts'
import { buildTrimPaintInput } from '../trimPaint.ts'
import {
  loadEstimateV2CalculationCatalogs,
  loadEstimateV2RoomModesForTrimFromDb,
  resolveEstimateV2RoomModeById,
} from '../estimateV2Catalogs.ts'
import type {
  V2CeilingScopeSaveRow,
  V2CeilingSegmentSaveRow,
  V2RoomRosterRow,
  V2TrimScopeSaveRow,
  V2WallScopeSaveRow,
  V2WallSegmentSaveRow,
} from '../estimateV2RoutePayload.ts'
import type { EstimateTemplateSettingsRow } from '../estimateTemplateSettings.ts'

function roomConditionSelectionsById(rooms: Unsafe[]) {
  const result = new Map<string, ReturnType<typeof normalizeConditionSelections>>()
  for (const room of rooms) {
    const roomId = asText(room.room_id).toUpperCase()
    if (roomId) result.set(roomId, normalizeConditionSelections(room.condition_selections))
  }
  return result
}

function resolveCombinedConditionFactor(params: {
  catalogs: Awaited<ReturnType<typeof loadEstimateV2CalculationCatalogs>>
  roomSelectionsById: Map<string, ReturnType<typeof normalizeConditionSelections>>
  roomId: string
  scope: EstimateV2ConditionScope
  selections: unknown
}) {
  const catalog = params.catalogs.wall?.condition_modifiers ?? []
  const factor =
    resolveConditionFactor({
      catalog,
      scope: 'room',
      selections: params.roomSelectionsById.get(params.roomId),
    }) *
    resolveConditionFactor({
      catalog,
      scope: params.scope,
      selections: normalizeConditionSelections(params.selections),
    })
  return factor === 1 ? null : factor
}

export async function loadCalculatedEstimateV2Artifacts(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
  jobsettings: Unsafe | null
  rooms: Unsafe[]
  roomWallScopes: Unsafe[]
  wallSegments: Unsafe[]
  roomCeilingScopes: Unsafe[]
  ceilingScopeSegments: Unsafe[]
  roomTrimScopes: Unsafe[]
  orgDefaults: EstimateTemplateSettingsRow | null
}) {
  const js = params.jobsettings
  const orgDefaults = params.orgDefaults
  const wallDefaultPaintId =
    asText(js?.walls_paint_id ?? js?.wall_paint_id) || orgDefaults?.walls_paint_id || null
  const wallDefaultPrimerId =
    asText(js?.walls_primer_id ?? js?.primer_id) || orgDefaults?.walls_primer_id || null
  const ceilingDefaultPaintId = asText(js?.ceiling_paint_id) || orgDefaults?.ceiling_paint_id || null
  const ceilingDefaultPrimerId =
    asText(js?.ceiling_primer_id ?? js?.primer_id) || orgDefaults?.ceiling_primer_id || null
  const trimDefaultPaintId = asText(js?.trim_paint_id) || orgDefaults?.trim_paint_id || null
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
  const effectiveCrewSize = Math.max(1, Math.floor(asNullableNumber(js?.crew_size) ?? 1))

  const calculationCatalogs = await loadEstimateV2CalculationCatalogs({
    requestOrigin: params.requestOrigin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
  })

  const conditionSelectionsByRoomId = roomConditionSelectionsById(params.rooms)
  const wallScopeRowsForSave = params.roomWallScopes as unknown as V2WallScopeSaveRow[]
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
      condition_factor: resolveCombinedConditionFactor({
        catalogs: calculationCatalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: asText((row as unknown as Unsafe).room_id).toUpperCase(),
        scope: 'wall',
        selections: (row as unknown as Unsafe).condition_selections,
      }),
      paint_product_id: paintProductId || wallDefaultPaintId,
      primer_product_id: primerProductId || wallDefaultPrimerId,
      paint_coats: asNullableNumberFromKeys(row as unknown as Unsafe, ['paint_coats', 'wall_coats', 'walls_topcoats']),
      primer_coats: asNullableNumberFromKeys(row as unknown as Unsafe, ['primer_coats', 'wall_primer_coats']),
      spot_prime_percent: asNullableNumberFromKeys(row as unknown as Unsafe, ['spot_prime_percent', 'wall_spot_prime_pct']),
    }
  })
  const wallCalculations = calculateWalls({
    scopes: wallScopeRowsForCalc,
    segments: params.wallSegments as unknown as V2WallSegmentSaveRow[],
    settings: { labor_rate_per_hour: effectiveLaborRate, crew_size: effectiveCrewSize },
    catalogs: calculationCatalogs.wall,
  })
  const quoteWallScopes = ((wallCalculations.scopes ?? []) as Unsafe[]).map((row) => {
    const rowId = asText((row as Unsafe).id)
    const originalPaintProductId = rowId ? wallScopePaintById.get(rowId) : null
    const originalPrimerProductId = rowId ? wallScopePrimerById.get(rowId) : null
    return {
      ...row,
      paint_product_id: originalPaintProductId ?? (asText((row as Unsafe).paint_product_id) || null),
      primer_product_id: originalPrimerProductId ?? (asText((row as Unsafe).primer_product_id) || null),
    }
  })

  const ceilingScopeRowsForSave = params.roomCeilingScopes as unknown as V2CeilingScopeSaveRow[]
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
      condition_factor: resolveCombinedConditionFactor({
        catalogs: calculationCatalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: asText((row as unknown as Unsafe).room_id).toUpperCase(),
        scope: 'ceiling',
        selections: (row as unknown as Unsafe).condition_selections,
      }),
      paint_product_id: paintProductId || ceilingDefaultPaintId,
      primer_product_id: primerProductId || ceilingDefaultPrimerId,
    }
  })
  const ceilingCalculations = calculateCeilings({
    scopes: ceilingScopeRowsForCalc,
    segments: params.ceilingScopeSegments as unknown as V2CeilingSegmentSaveRow[],
    settings: { labor_rate_per_hour: effectiveLaborRate, crew_size: effectiveCrewSize },
    catalogs: calculationCatalogs.ceiling ?? undefined,
  })
  const quoteCeilingScopes = ((ceilingCalculations.scopes ?? []) as Unsafe[]).map((row) => {
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
    rooms: params.rooms,
    wallScopes: params.roomWallScopes,
    ceilingScopes: params.roomCeilingScopes,
  })
  const trimScopeRowsForSave = params.roomTrimScopes as unknown as V2TrimScopeSaveRow[]
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
      condition_factor: resolveCombinedConditionFactor({
        catalogs: calculationCatalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: asText((row as unknown as Unsafe).room_id).toUpperCase(),
        scope: 'trim',
        selections: (row as unknown as Unsafe).condition_selections,
      }),
      paint_product_id: paintProductId || trimDefaultPaintId,
      primer_product_id: primerProductId || trimDefaultPrimerId,
    }
  })
  const trimCalculations = calculateTrim({
    scopes: trimScopeRowsForCalc,
    rooms: params.rooms.map((row) => {
      const roomId = asText(row.room_id).toUpperCase()
      return {
        room_id: roomId,
        length_in: asNullableNumber(row.length_in),
        width_in: asNullableNumber(row.width_in),
        mode: roomModeById.get(roomId) ?? 'RECT',
      }
    }),
    settings: { labor_rate_per_hour: effectiveLaborRate, crew_size: effectiveCrewSize },
    catalogs: calculationCatalogs.trim ?? undefined,
  })
  const quoteTrimScopes = ((trimCalculations.scopes ?? []) as Unsafe[]).map((row) => {
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
    trimPaintInput,
    buildPerJobSupplyCost({
      catalogs: calculationCatalogs.wall,
      crewSize: effectiveCrewSize,
      activeScopes: [
        wallCalculations.scopes.some((scope) => scope.include === 'Y') ? 'walls' as const : null,
        ceilingCalculations.scopes.some((scope) => scope.include === 'Y') ? 'ceilings' as const : null,
        trimCalculations.scopes.some((scope) => scope.include === 'Y') ? 'trim' as const : null,
      ].filter((scope): scope is 'walls' | 'ceilings' | 'trim' => scope != null),
    })
  )

  return {
    calculationCatalogs,
    quoteWallScopes,
    quoteCeilingScopes,
    quoteTrimScopes,
    wallCalculations,
    ceilingCalculations,
    trimCalculations,
    trimPaintInput,
    pricingSummary,
  }
}

export async function loadEffectiveLaborRate(orgId: string, estimateId: string, fromBody: Unsafe | undefined) {
  const laborRateFromBody = fromBody ? asNullableNumber(fromBody.override_labor_rate) : null
  if (laborRateFromBody != null) return laborRateFromBody

  const existingJobsettings = await supabaseAdmin
    .from('estimate_jobsettings')
    .select('override_labor_rate')
    .eq('org_id', orgId)
    .eq('estimate_id', estimateId)
    .maybeSingle()
  if (existingJobsettings.error) return null
  return asNullableNumber(existingJobsettings.data?.override_labor_rate)
}

export function createCalculationCatalogsLoader(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
}) {
  let calculationCatalogs: Awaited<ReturnType<typeof loadEstimateV2CalculationCatalogs>> | null = null
  return async () => {
    if (calculationCatalogs) return calculationCatalogs
    calculationCatalogs = await loadEstimateV2CalculationCatalogs(params)
    return calculationCatalogs
  }
}

export async function calculateWallsForSave(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
  scopes: V2WallScopeSaveRow[]
  roomRows: V2RoomRosterRow[]
  segments: V2WallSegmentSaveRow[]
  jobsettings: Unsafe | undefined
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const laborRate = await loadEffectiveLaborRate(params.orgId, params.estimateId, params.jobsettings)
  const crewSize = Math.max(1, Math.floor(asNullableNumber(params.jobsettings?.crew_size) ?? 1))
  const catalogs = await params.ensureCatalogs()
  const conditionSelectionsByRoomId = roomConditionSelectionsById(params.roomRows as unknown as Unsafe[])
  const wallCalculations = calculateWalls({
    scopes: params.scopes.map((scope) => ({
      ...scope,
      condition_factor: resolveCombinedConditionFactor({
        catalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: scope.room_id,
        scope: 'wall',
        selections: (scope as unknown as Unsafe).condition_selections,
      }),
    })),
    segments: params.segments,
    settings: { labor_rate_per_hour: laborRate, crew_size: crewSize },
    catalogs: catalogs.wall,
  })
  return {
    wallCalculations,
    wallSegmentRows: wallCalculations.segments,
  }
}

export async function calculateCeilingsForSave(params: {
  orgId: string
  estimateId: string
  scopes: V2CeilingScopeSaveRow[]
  roomRows: V2RoomRosterRow[]
  segments: V2CeilingSegmentSaveRow[]
  jobsettings: Unsafe | undefined
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const laborRate = await loadEffectiveLaborRate(params.orgId, params.estimateId, params.jobsettings)
  const crewSize = Math.max(1, Math.floor(asNullableNumber(params.jobsettings?.crew_size) ?? 1))
  const catalogs = await params.ensureCatalogs()
  const conditionSelectionsByRoomId = roomConditionSelectionsById(params.roomRows as unknown as Unsafe[])
  const ceilingCalculations = calculateCeilings({
    scopes: params.scopes.map((scope) => ({
      ...scope,
      condition_factor: resolveCombinedConditionFactor({
        catalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: scope.room_id,
        scope: 'ceiling',
        selections: (scope as unknown as Unsafe).condition_selections,
      }),
    })),
    segments: params.segments,
    settings: { labor_rate_per_hour: laborRate, crew_size: crewSize },
    catalogs: catalogs.ceiling ?? undefined,
  })
  return {
    ceilingCalculations,
    ceilingScopeRows: ceilingCalculations.scopes as V2CeilingScopeSaveRow[],
    ceilingSegmentRows: ceilingCalculations.segments as V2CeilingSegmentSaveRow[],
  }
}

export async function calculateTrimForSave(params: {
  orgId: string
  estimateId: string
  scopes: V2TrimScopeSaveRow[]
  roomRows: V2RoomRosterRow[]
  wallScopeRows: V2WallScopeSaveRow[] | null
  ceilingScopeRows: V2CeilingScopeSaveRow[] | null
  jobsettings: Unsafe | undefined
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const laborRate = await loadEffectiveLaborRate(params.orgId, params.estimateId, params.jobsettings)
  const crewSize = Math.max(1, Math.floor(asNullableNumber(params.jobsettings?.crew_size) ?? 1))
  const trimRoomModeById =
    params.wallScopeRows || params.ceilingScopeRows
      ? resolveEstimateV2RoomModeById({
          rooms: params.roomRows as unknown as Unsafe[],
          wallScopes: (params.wallScopeRows ?? []) as unknown as Unsafe[],
          ceilingScopes: (params.ceilingScopeRows ?? []) as unknown as Unsafe[],
        })
      : await loadEstimateV2RoomModesForTrimFromDb({
          orgId: params.orgId,
          estimateId: params.estimateId,
        })
  const catalogs = await params.ensureCatalogs()
  const conditionSelectionsByRoomId = roomConditionSelectionsById(params.roomRows as unknown as Unsafe[])
  return calculateTrim({
    scopes: params.scopes.map((scope) => ({
      ...scope,
      condition_factor: resolveCombinedConditionFactor({
        catalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: scope.room_id,
        scope: 'trim',
        selections: (scope as unknown as Unsafe).condition_selections,
      }),
    })),
    rooms: params.roomRows.map((room) => ({
      room_id: room.room_id,
      length_in: room.length_in,
      width_in: room.width_in,
      mode: trimRoomModeById.get(room.room_id) ?? 'RECT',
    })),
    settings: { labor_rate_per_hour: laborRate, crew_size: crewSize },
    catalogs: catalogs.trim ?? undefined,
  })
}
