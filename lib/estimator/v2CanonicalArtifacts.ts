import { calculateCeilings } from './ceilings.ts'
import { calculateDoors } from './doors.ts'
import { calculateDrywallRepairs } from './drywall.ts'
import { calculateOtherItems, type OtherCalculationRow } from './other.ts'
import { calculatePrejobTrips, type PrejobTripCalculationRow } from './prejobTrips.ts'
import { calculateTrim } from './trim.ts'
import { calculateWalls } from './walls.ts'
import {
  buildEstimatorV2CalculationSettings,
  buildEstimatorV2PricingSummary,
  buildTrimPaintInput,
  calculateEstimatorV2AccessFees,
  productMapFromWallCatalog,
  resolveEstimatorV2EffectiveJobSettings,
  resolveEstimatorV2RoomModeById,
} from './v2CalculationShared.ts'
import {
  prepareEstimateV2CalculationInputs,
  type EstimateV2CalculationPreparationCatalogs,
} from './v2CalculationPreparation.ts'
import type { DrywallCalculationInput } from '@/types/estimator/drywall'
import type { EstimateV2AccessFeeOption, EstimateV2JobSettingsInput } from '@/types/estimator/v2'
import type {
  EstimateV2AccessFeeCalculationInputRow,
  EstimateV2CalculationJobSettingsInput,
  EstimateV2CalculationRoomRow,
  V2CeilingScopeSaveRow,
  V2CeilingSegmentSaveRow,
  V2DoorScopeSaveRow,
  V2DrywallRepairSaveRow,
  V2TrimScopeSaveRow,
  V2WallScopeSaveRow,
  V2WallSegmentSaveRow,
} from '@/types/estimator/v2Boundary'

export type EstimateV2CanonicalCalculationCatalogs = EstimateV2CalculationPreparationCatalogs & {
  source: EstimateV2CalculationPreparationCatalogs['source'] & {
    access_fees?: EstimateV2AccessFeeOption[] | null
  }
  drywall?: DrywallCalculationInput['catalogs'] | null
}

export function calculateCanonicalEstimateV2Artifacts(params: {
  calculationCatalogs: EstimateV2CanonicalCalculationCatalogs
  jobsettings: EstimateV2CalculationJobSettingsInput | null
  rooms: EstimateV2CalculationRoomRow[]
  roomWallScopes: V2WallScopeSaveRow[]
  wallSegments: V2WallSegmentSaveRow[]
  roomCeilingScopes: V2CeilingScopeSaveRow[]
  ceilingScopeSegments: V2CeilingSegmentSaveRow[]
  roomTrimScopes: V2TrimScopeSaveRow[]
  roomDoorScopes?: V2DoorScopeSaveRow[]
  drywallRepairs?: V2DrywallRepairSaveRow[]
  accessFees?: EstimateV2AccessFeeCalculationInputRow[]
  prejob?: PrejobTripCalculationRow[]
  other?: OtherCalculationRow[]
  orgDefaults: EstimateV2JobSettingsInput | null
  roomModeById?: Map<string, 'RECT' | 'SEG'>
}) {
  const jobsettings = params.jobsettings
  const effectiveSettings = resolveEstimatorV2EffectiveJobSettings({
    jobsettings,
    orgDefaults: params.orgDefaults,
  })
  const calculationSettings = buildEstimatorV2CalculationSettings(effectiveSettings)
  const calculationCatalogs = params.calculationCatalogs

  const roomModeById =
    params.roomModeById ??
    resolveEstimatorV2RoomModeById({
      rooms: params.rooms,
      wallScopes: params.roomWallScopes,
      ceilingScopes: params.roomCeilingScopes,
    })
  const preparedInputs = prepareEstimateV2CalculationInputs({
    rooms: params.rooms,
    roomWallScopes: params.roomWallScopes,
    wallSegments: params.wallSegments,
    roomCeilingScopes: params.roomCeilingScopes,
    ceilingScopeSegments: params.ceilingScopeSegments,
    roomTrimScopes: params.roomTrimScopes,
    roomDoorScopes: params.roomDoorScopes ?? [],
    roomModeById,
    catalogs: calculationCatalogs,
    defaults: {
      wallPaintProductId: effectiveSettings.walls_paint_id,
      wallPrimerProductId: effectiveSettings.walls_primer_id,
      ceilingPaintProductId: effectiveSettings.ceiling_paint_id,
      ceilingPrimerProductId: effectiveSettings.ceiling_primer_id,
      trimPaintProductId: effectiveSettings.trim_paint_id,
      trimPrimerProductId: effectiveSettings.trim_primer_id,
    },
  })

  const wallCalculations = calculateWalls({
    scopes: preparedInputs.walls.rows,
    segments: preparedInputs.walls.segments,
    settings: calculationSettings,
    catalogs: calculationCatalogs.wall,
  })
  const quoteWallScopes = preparedInputs.walls.productDefaults.restorePersistedProductIds(wallCalculations.scopes)

  const ceilingCalculations = calculateCeilings({
    scopes: preparedInputs.ceilings.rows,
    segments: preparedInputs.ceilings.segments,
    settings: calculationSettings,
    catalogs: calculationCatalogs.ceiling ?? undefined,
  })
  const quoteCeilingScopes = preparedInputs.ceilings.productDefaults.restorePersistedProductIds(
    ceilingCalculations.scopes
  )

  const trimCalculations = calculateTrim({
    scopes: preparedInputs.trim.rows,
    rooms: preparedInputs.trim.rooms,
    settings: calculationSettings,
    catalogs: calculationCatalogs.trim ?? undefined,
  })
  const quoteTrimScopes = preparedInputs.trim.productDefaults.restorePersistedProductIds(trimCalculations.scopes)

  const trimPaintProductMap = productMapFromWallCatalog(calculationCatalogs.trim)
  const trimPaintInput = buildTrimPaintInput({
    jobsettings,
    productId: effectiveSettings.trim_paint_id,
    product: effectiveSettings.trim_paint_id ? trimPaintProductMap.get(effectiveSettings.trim_paint_id) : null,
  })

  const doorCalculations = calculateDoors({
    scopes: preparedInputs.doors.rows,
    settings: calculationSettings,
    catalogs: calculationCatalogs.door ?? undefined,
  })
  const quoteDoorScopes = preparedInputs.doors.productDefaults.restorePersistedProductIds(doorCalculations.scopes)

  const drywallCalculations = calculateDrywallRepairs({
    repairs: params.drywallRepairs ?? [],
    catalogs: calculationCatalogs.drywall ?? undefined,
  })
  const otherCalculations = calculateOtherItems({
    rows: params.other ?? [],
    settings: { labor_rate_per_hour: effectiveSettings.override_labor_rate },
  })
  const prejobCalculations = calculatePrejobTrips({
    rows: params.prejob ?? [],
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
      { kind: 'prejob', output: prejobCalculations },
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
    prejobCalculations,
    accessFeeCalculation,
    trimPaintInput,
    pricingSummary,
  }
}
