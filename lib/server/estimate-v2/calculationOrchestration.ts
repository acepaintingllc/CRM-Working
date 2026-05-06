import { supabaseAdmin } from '../org.ts'
import { calculateWalls } from '../../estimator/walls.ts'
import { calculateCeilings } from '../../estimator/ceilings.ts'
import { calculateTrim } from '../../estimator/trim.ts'
import { calculateDoors } from '../../estimator/doors.ts'
import { calculateDrywallRepairs } from '../../estimator/drywall.ts'
import { calculateOtherItems } from '../../estimator/other.ts'
import { asNullableNumber, asNullableNumberFromKeys, asText, type UnsafeRecord as Unsafe } from '../../estimator/parsing.ts'
import {
  buildEstimatorV2CalculationSettings,
  buildEstimatorV2PricingSummary,
  buildTrimPaintInput,
  calculateEstimatorV2AccessFees,
  productMapFromWallCatalog,
  resolveEstimatorV2EffectiveJobSettings,
} from '../../estimator/v2CalculationShared.ts'
import {
  normalizeConditionSelections,
  resolveConditionFactor,
  type EstimateV2ConditionScope,
} from '../../estimator/conditionModifiers.ts'
import {
  loadEstimateV2CalculationCatalogs,
  loadEstimateV2RoomModesForTrimFromDb,
  resolveEstimateV2RoomModeById,
} from '../estimateV2Catalogs.ts'
import { applyBaseCeilingProductionRates } from './ceilingProductionRates.ts'
import { applySelectedWallProductionRates } from './wallProductionRates.ts'
import type { EstimateV2SavePayload } from '@/types/estimator/v2'
import type {
  V2CeilingScopeSaveRow,
  V2CeilingSegmentSaveRow,
  V2DoorScopeSaveRow,
  V2DrywallRepairSaveRow,
  V2RoomRosterRow,
  V2TrimScopeSaveRow,
  V2WallScopeSaveRow,
  V2WallSegmentSaveRow,
} from '../estimateV2RoutePayload.ts'
import type { EstimateTemplateSettingsRow } from '../estimateTemplateSettings.ts'

export type EstimateV2CalculationCatalogBundle = Awaited<ReturnType<typeof loadEstimateV2CalculationCatalogs>>

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
  roomDoorScopes?: Unsafe[]
  drywallRepairs?: Unsafe[]
  accessFees?: Unsafe[]
  other?: Unsafe[]
  orgDefaults: EstimateTemplateSettingsRow | null
}) {
  const calculationCatalogs = await loadEstimateV2CalculationCatalogs({
    requestOrigin: params.requestOrigin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
  })

  return calculateEstimateV2ArtifactsWithCatalogs({
    calculationCatalogs,
    jobsettings: params.jobsettings,
    rooms: params.rooms,
    roomWallScopes: params.roomWallScopes,
    wallSegments: params.wallSegments,
    roomCeilingScopes: params.roomCeilingScopes,
    ceilingScopeSegments: params.ceilingScopeSegments,
    roomTrimScopes: params.roomTrimScopes,
    roomDoorScopes: params.roomDoorScopes,
    drywallRepairs: params.drywallRepairs,
    accessFees: params.accessFees,
    other: params.other,
    orgDefaults: params.orgDefaults,
  })
}

export function calculateEstimateV2ArtifactsFromPayload(params: {
  payload: EstimateV2SavePayload
  calculationCatalogs: EstimateV2CalculationCatalogBundle
  orgDefaults: EstimateTemplateSettingsRow | null
}) {
  return calculateEstimateV2ArtifactsWithCatalogs({
    calculationCatalogs: params.calculationCatalogs,
    jobsettings: params.payload.jobsettings as unknown as Unsafe,
    rooms: params.payload.rooms as unknown as Unsafe[],
    roomWallScopes: params.payload.room_wall_scopes as unknown as Unsafe[],
    wallSegments: params.payload.wall_segments as unknown as Unsafe[],
    roomCeilingScopes: params.payload.room_ceiling_scopes as unknown as Unsafe[],
    ceilingScopeSegments: params.payload.ceiling_scope_segments as unknown as Unsafe[],
    roomTrimScopes: params.payload.room_trim_scopes as unknown as Unsafe[],
    roomDoorScopes: (params.payload.room_door_scopes ?? []) as unknown as Unsafe[],
    drywallRepairs: (params.payload.drywall_repairs ?? []) as unknown as Unsafe[],
    accessFees: (params.payload.access_fees ?? []) as unknown as Unsafe[],
    other: (params.payload.other ?? []) as unknown as Unsafe[],
    orgDefaults: params.orgDefaults,
  })
}

export function calculateEstimateV2ArtifactsWithCatalogs(params: {
  calculationCatalogs: EstimateV2CalculationCatalogBundle
  jobsettings: Unsafe | null
  rooms: Unsafe[]
  roomWallScopes: Unsafe[]
  wallSegments: Unsafe[]
  roomCeilingScopes: Unsafe[]
  ceilingScopeSegments: Unsafe[]
  roomTrimScopes: Unsafe[]
  roomDoorScopes?: Unsafe[]
  drywallRepairs?: Unsafe[]
  accessFees?: Unsafe[]
  other?: Unsafe[]
  orgDefaults: EstimateTemplateSettingsRow | null
}) {
  const js = params.jobsettings
  const effectiveSettings = resolveEstimatorV2EffectiveJobSettings({
    jobsettings: js,
    orgDefaults: params.orgDefaults as unknown as Unsafe | null,
  })
  const calculationSettings = buildEstimatorV2CalculationSettings(effectiveSettings)

  const calculationCatalogs = params.calculationCatalogs

  const conditionSelectionsByRoomId = roomConditionSelectionsById(params.rooms)
  const wallScopeRowsForSave = params.roomWallScopes as unknown as V2WallScopeSaveRow[]
  const wallScopePaintById = new Map<string, string | null>()
  const wallScopePrimerById = new Map<string, string | null>()
  const wallScopeRowsWithProductionRates = applySelectedWallProductionRates({
    rooms: params.rooms,
    scopes: wallScopeRowsForSave,
    productionRates: Array.isArray(calculationCatalogs.source.production_rates)
      ? calculationCatalogs.source.production_rates
      : [],
  })
  const wallScopeRowsForCalc = wallScopeRowsWithProductionRates.map((row) => {
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
      paint_product_id: paintProductId || effectiveSettings.walls_paint_id,
      primer_product_id: primerProductId || effectiveSettings.walls_primer_id,
      paint_coats: asNullableNumberFromKeys(row as unknown as Unsafe, ['paint_coats', 'wall_coats', 'walls_topcoats']),
      primer_coats: asNullableNumberFromKeys(row as unknown as Unsafe, ['primer_coats', 'wall_primer_coats']),
      spot_prime_percent: asNullableNumberFromKeys(row as unknown as Unsafe, ['spot_prime_percent', 'wall_spot_prime_pct']),
    }
  })
  const wallCalculations = calculateWalls({
    scopes: wallScopeRowsForCalc,
    segments: params.wallSegments as unknown as V2WallSegmentSaveRow[],
    settings: calculationSettings,
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
  const ceilingScopeRowsWithProductionRates = applyBaseCeilingProductionRates({
    scopes: ceilingScopeRowsForSave,
    productionRates: Array.isArray(calculationCatalogs.source.production_rates)
      ? calculationCatalogs.source.production_rates
      : [],
  })
  const ceilingScopeRowsForCalc = ceilingScopeRowsWithProductionRates.map((row) => {
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
      paint_product_id: paintProductId || effectiveSettings.ceiling_paint_id,
      primer_product_id: primerProductId || effectiveSettings.ceiling_primer_id,
    }
  })
  const ceilingCalculations = calculateCeilings({
    scopes: ceilingScopeRowsForCalc,
    segments: params.ceilingScopeSegments as unknown as V2CeilingSegmentSaveRow[],
    settings: calculationSettings,
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
      paint_product_id: paintProductId || effectiveSettings.trim_paint_id,
      primer_product_id: primerProductId || effectiveSettings.trim_primer_id,
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
    settings: calculationSettings,
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

  const trimPaintProductMap = productMapFromWallCatalog(calculationCatalogs.trim)
  const trimPaintInput = buildTrimPaintInput({
    jobsettings: js,
    productId: effectiveSettings.trim_paint_id,
    product: effectiveSettings.trim_paint_id ? trimPaintProductMap.get(effectiveSettings.trim_paint_id) : null,
  })

  const doorScopeRowsForSave = (params.roomDoorScopes ?? []) as unknown as V2DoorScopeSaveRow[]
  const doorScopePaintById = new Map<string, string | null>()
  const doorScopePrimerById = new Map<string, string | null>()
  const doorScopeRowsForCalc = doorScopeRowsForSave.map((row) => {
    const rowId = asText(row.id)
    const paintProductId = asText((row as unknown as Unsafe).paint_product_id) || null
    const primerProductId = asText((row as unknown as Unsafe).primer_product_id) || null
    if (rowId) doorScopePaintById.set(rowId, paintProductId)
    if (rowId) doorScopePrimerById.set(rowId, primerProductId)
    return {
      ...row,
      condition_factor: resolveCombinedConditionFactor({
        catalogs: calculationCatalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: asText((row as unknown as Unsafe).room_id).toUpperCase(),
        scope: 'trim',
        selections: (row as unknown as Unsafe).condition_selections,
      }),
      paint_product_id: paintProductId || effectiveSettings.trim_paint_id,
      primer_product_id: primerProductId || effectiveSettings.trim_primer_id,
    }
  })
  const doorCalculations = calculateDoors({
    scopes: doorScopeRowsForCalc,
    settings: calculationSettings,
    catalogs: calculationCatalogs.door ?? undefined,
  })
  const quoteDoorScopes = ((doorCalculations.scopes ?? []) as Unsafe[]).map((row) => {
    const rowId = asText((row as Unsafe).id)
    const originalPaintProductId = rowId ? doorScopePaintById.get(rowId) : null
    const originalPrimerProductId = rowId ? doorScopePrimerById.get(rowId) : null
    return {
      ...row,
      paint_product_id: originalPaintProductId ?? (asText((row as Unsafe).paint_product_id) || null),
      primer_product_id: originalPrimerProductId ?? (asText((row as Unsafe).primer_product_id) || null),
    }
  })
  const drywallRepairRowsForSave = (params.drywallRepairs ?? []) as unknown as V2DrywallRepairSaveRow[]
  const drywallCalculations = calculateDrywallRepairs({
    repairs: drywallRepairRowsForSave,
    catalogs: calculationCatalogs.drywall ?? undefined,
  })
  const otherCalculations = calculateOtherItems({
    rows: params.other ?? [],
    settings: { labor_rate_per_hour: effectiveSettings.override_labor_rate },
  })
  const accessFeeCalculation = calculateEstimatorV2AccessFees({
    rows: params.accessFees ?? [],
    catalog: (Array.isArray(calculationCatalogs.source.access_fees)
      ? calculationCatalogs.source.access_fees
      : []) as never,
  })
  const pricingSummary = buildEstimatorV2PricingSummary({
    engines: [
      { kind: 'walls', output: wallCalculations },
      { kind: 'ceilings', output: ceilingCalculations },
      { kind: 'trim', output: trimCalculations },
      { kind: 'doors', output: doorCalculations },
      { kind: 'drywall', output: drywallCalculations },
      { kind: 'other', output: otherCalculations },
    ],
    settings: effectiveSettings,
    wallCatalogs: calculationCatalogs.wall,
    accessFeeTotal: accessFeeCalculation.total,
    wallRoomTotals: wallCalculations.room_totals,
    ceilingRoomTotals: ceilingCalculations.room_totals,
    trimRoomTotals: trimCalculations.room_totals,
    wallScopes: wallCalculations.scopes,
    ceilingScopes: ceilingCalculations.scopes,
    trimScopes: trimCalculations.scopes,
    sourceTrimScopes: params.roomTrimScopes ?? [],
    trimPaintInput,
  })

  return {
    calculationCatalogs,
    quoteWallScopes,
    quoteCeilingScopes,
    quoteTrimScopes,
    quoteDoorScopes,
    wallCalculations,
    ceilingCalculations,
    trimCalculations,
    doorCalculations,
    drywallCalculations,
    otherCalculations,
    accessFeeCalculation,
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

async function resolveSaveCalculationContext(params: {
  orgId: string
  estimateId: string
  jobsettings: Unsafe | undefined
  orgDefaults: EstimateTemplateSettingsRow | null
}) {
  let jobsettings = params.jobsettings
  if (!jobsettings) {
    const existingJobsettings = await supabaseAdmin
      .from('estimate_jobsettings')
      .select('*')
      .eq('org_id', params.orgId)
      .eq('estimate_id', params.estimateId)
      .maybeSingle()
    if (!existingJobsettings.error) {
      jobsettings = (existingJobsettings.data as Unsafe | null) ?? undefined
    }
  }
  const effectiveSettings = resolveEstimatorV2EffectiveJobSettings({
    jobsettings,
    orgDefaults: params.orgDefaults as unknown as Unsafe | null,
  })
  return {
    effectiveSettings,
    calculationSettings: buildEstimatorV2CalculationSettings(effectiveSettings),
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
  orgDefaults: EstimateTemplateSettingsRow | null
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const { effectiveSettings, calculationSettings } = await resolveSaveCalculationContext({
    orgId: params.orgId,
    estimateId: params.estimateId,
    jobsettings: params.jobsettings,
    orgDefaults: params.orgDefaults,
  })
  const catalogs = await params.ensureCatalogs()
  const conditionSelectionsByRoomId = roomConditionSelectionsById(params.roomRows as unknown as Unsafe[])
  const scopesWithProductionRates = applySelectedWallProductionRates({
    rooms: params.roomRows,
    scopes: params.scopes,
    productionRates: Array.isArray(catalogs.source.production_rates)
      ? catalogs.source.production_rates
      : [],
  })
  const wallCalculations = calculateWalls({
    scopes: scopesWithProductionRates.map((scope) => ({
      ...scope,
      condition_factor: resolveCombinedConditionFactor({
        catalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: scope.room_id,
        scope: 'wall',
        selections: (scope as unknown as Unsafe).condition_selections,
      }),
      paint_product_id: asText((scope as unknown as Unsafe).paint_product_id) || effectiveSettings.walls_paint_id,
      primer_product_id: asText((scope as unknown as Unsafe).primer_product_id) || effectiveSettings.walls_primer_id,
    })),
    segments: params.segments,
    settings: calculationSettings,
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
  orgDefaults: EstimateTemplateSettingsRow | null
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const { effectiveSettings, calculationSettings } = await resolveSaveCalculationContext({
    orgId: params.orgId,
    estimateId: params.estimateId,
    jobsettings: params.jobsettings,
    orgDefaults: params.orgDefaults,
  })
  const catalogs = await params.ensureCatalogs()
  const conditionSelectionsByRoomId = roomConditionSelectionsById(params.roomRows as unknown as Unsafe[])
  const scopesWithProductionRates = applyBaseCeilingProductionRates({
    scopes: params.scopes,
    productionRates: Array.isArray(catalogs.source.production_rates)
      ? catalogs.source.production_rates
      : [],
  })
  const ceilingCalculations = calculateCeilings({
    scopes: scopesWithProductionRates.map((scope) => ({
      ...scope,
      condition_factor: resolveCombinedConditionFactor({
        catalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: scope.room_id,
        scope: 'ceiling',
        selections: (scope as unknown as Unsafe).condition_selections,
      }),
      paint_product_id: asText((scope as unknown as Unsafe).paint_product_id) || effectiveSettings.ceiling_paint_id,
      primer_product_id:
        asText((scope as unknown as Unsafe).primer_product_id) || effectiveSettings.ceiling_primer_id,
    })),
    segments: params.segments,
    settings: calculationSettings,
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
  orgDefaults: EstimateTemplateSettingsRow | null
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const { effectiveSettings, calculationSettings } = await resolveSaveCalculationContext({
    orgId: params.orgId,
    estimateId: params.estimateId,
    jobsettings: params.jobsettings,
    orgDefaults: params.orgDefaults,
  })
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
      paint_product_id: asText((scope as unknown as Unsafe).paint_product_id) || effectiveSettings.trim_paint_id,
      primer_product_id: asText((scope as unknown as Unsafe).primer_product_id) || effectiveSettings.trim_primer_id,
    })),
    rooms: params.roomRows.map((room) => ({
      room_id: room.room_id,
      length_in: room.length_in,
      width_in: room.width_in,
      mode: trimRoomModeById.get(room.room_id) ?? 'RECT',
    })),
    settings: calculationSettings,
    catalogs: catalogs.trim ?? undefined,
  })
}

export async function calculateDoorsForSave(params: {
  orgId: string
  estimateId: string
  scopes: V2DoorScopeSaveRow[]
  roomRows: V2RoomRosterRow[]
  jobsettings: Unsafe | undefined
  orgDefaults: EstimateTemplateSettingsRow | null
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const { effectiveSettings, calculationSettings } = await resolveSaveCalculationContext({
    orgId: params.orgId,
    estimateId: params.estimateId,
    jobsettings: params.jobsettings,
    orgDefaults: params.orgDefaults,
  })
  const catalogs = await params.ensureCatalogs()
  const conditionSelectionsByRoomId = roomConditionSelectionsById(params.roomRows as unknown as Unsafe[])
  return calculateDoors({
    scopes: params.scopes.map((scope) => ({
      ...scope,
      condition_factor: resolveCombinedConditionFactor({
        catalogs,
        roomSelectionsById: conditionSelectionsByRoomId,
        roomId: scope.room_id,
        scope: 'trim',
        selections: (scope as unknown as Unsafe).condition_selections,
      }),
      paint_product_id: asText((scope as unknown as Unsafe).paint_product_id) || effectiveSettings.trim_paint_id,
      primer_product_id: asText((scope as unknown as Unsafe).primer_product_id) || effectiveSettings.trim_primer_id,
    })),
    settings: calculationSettings,
    catalogs: catalogs.door ?? undefined,
  })
}

export async function calculateDrywallForSave(params: {
  repairs: V2DrywallRepairSaveRow[]
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const catalogs = await params.ensureCatalogs()
  return calculateDrywallRepairs({
    repairs: params.repairs,
    catalogs: catalogs.drywall ?? undefined,
  })
}
