import { type UnsafeRecord as Unsafe } from './parsing.ts'
import {
  toCeilingCalculationCatalogs,
  toDoorCalculationCatalogs,
  toDrywallCalculationCatalogs,
  toTrimCalculationCatalogs,
  toWallCalculationCatalogs,
} from './v2CalculationShared.ts'
import { calculateCanonicalEstimateV2Artifacts } from './v2CanonicalArtifacts.ts'
import type {
  EstimateV2Catalogs,
  EstimateV2JobSettingsInput,
  EstimateV2SavePayload,
} from '@/types/estimator/v2'

type PreviewCatalogs = EstimateV2Catalogs & {
  supplies_rates?: Unsafe[]
}

export function calculateEstimateV2Preview(params: {
  payload: EstimateV2SavePayload
  catalogs: EstimateV2Catalogs
  orgDefaults?: EstimateV2JobSettingsInput | null
}) {
  const catalogs = params.catalogs as PreviewCatalogs
  const artifacts = calculateCanonicalEstimateV2Artifacts({
    calculationCatalogs: {
      source: catalogs,
      wall: toWallCalculationCatalogs(catalogs),
      ceiling: toCeilingCalculationCatalogs(catalogs),
      trim: toTrimCalculationCatalogs(catalogs),
      door: toDoorCalculationCatalogs(catalogs),
      drywall: toDrywallCalculationCatalogs(catalogs),
    },
    jobsettings: params.payload.jobsettings,
    rooms: params.payload.rooms,
    roomWallScopes: params.payload.room_wall_scopes as never,
    wallSegments: params.payload.wall_segments as never,
    roomCeilingScopes: params.payload.room_ceiling_scopes as never,
    ceilingScopeSegments: params.payload.ceiling_scope_segments as never,
    roomTrimScopes: params.payload.room_trim_scopes as never,
    roomDoorScopes: (params.payload.room_door_scopes ?? []) as never,
    drywallRepairs: (params.payload.drywall_repairs ?? []) as never,
    accessFees: params.payload.access_fees,
    other: (params.payload.other ?? []) as never,
    orgDefaults: params.orgDefaults ?? null,
  })

  return {
    walls: artifacts.wallCalculations,
    ceilings: artifacts.ceilingCalculations,
    trim: artifacts.trimCalculations,
    doors: artifacts.doorCalculations,
    drywall: artifacts.drywallCalculations,
    other: artifacts.otherCalculations,
    accessFees: artifacts.accessFeeCalculation,
    pricingSummary: artifacts.pricingSummary,
    trimPaint: artifacts.trimPaintInput,
  }
}
