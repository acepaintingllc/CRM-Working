import { supabaseAdmin } from '../org.ts'
import { calculateCanonicalEstimateV2Artifacts } from '../../estimator/v2CanonicalArtifacts.ts'
import {
  loadEstimateV2CalculationCatalogs,
  loadEstimateV2RoomModesForTrimFromDb,
} from '../estimateV2Catalogs.ts'
import type { EstimateV2SavePayload } from '@/types/estimator/v2'
import {
  normalizeEstimateV2CalculationRows,
  normalizeEstimateV2JobSettingsInput,
  type EstimateV2AccessFeeCalculationInputRow,
  type EstimateV2CalculationJobSettingsInput,
  type EstimateV2CalculationRoomRow,
  type EstimateV2RawCalculationRows,
  type EstimateV2RawJobSettingsRow,
  type EstimateV2RoomRosterCalculationRow,
  type V2CeilingScopeSaveRow,
  type V2CeilingSegmentSaveRow,
  type V2DoorScopeSaveRow,
  type V2DrywallRepairSaveRow,
  type V2TrimScopeSaveRow,
  type V2WallScopeSaveRow,
  type V2WallSegmentSaveRow,
} from '@/types/estimator/v2Boundary'
import type { OtherCalculationRow } from '@/lib/estimator/other'
import type { EstimateTemplateSettingsRow } from '../estimateTemplateSettings.ts'

export type EstimateV2CalculationCatalogBundle = Awaited<ReturnType<typeof loadEstimateV2CalculationCatalogs>>

type EstimateV2CalculationJobSettings = EstimateV2CalculationJobSettingsInput

export async function loadCalculatedEstimateV2Artifacts(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
  jobsettings: EstimateV2RawJobSettingsRow | null
  rooms: EstimateV2RawCalculationRows['rooms']
  roomWallScopes: EstimateV2RawCalculationRows['roomWallScopes']
  wallSegments: EstimateV2RawCalculationRows['wallSegments']
  roomCeilingScopes: EstimateV2RawCalculationRows['roomCeilingScopes']
  ceilingScopeSegments: EstimateV2RawCalculationRows['ceilingScopeSegments']
  roomTrimScopes: EstimateV2RawCalculationRows['roomTrimScopes']
  roomDoorScopes?: EstimateV2RawCalculationRows['roomDoorScopes']
  drywallRepairs?: EstimateV2RawCalculationRows['drywallRepairs']
  accessFees?: EstimateV2RawCalculationRows['accessFees']
  other?: EstimateV2RawCalculationRows['other']
  orgDefaults: EstimateTemplateSettingsRow | null
}) {
  const calculationCatalogs = await loadEstimateV2CalculationCatalogs({
    requestOrigin: params.requestOrigin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
  })

  const calculationRows = normalizeEstimateV2CalculationRows({
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
  })

  return calculateEstimateV2ArtifactsWithCatalogs({
    calculationCatalogs,
    jobsettings: normalizeEstimateV2JobSettingsInput(params.jobsettings),
    rooms: calculationRows.rooms,
    roomWallScopes: calculationRows.roomWallScopes,
    wallSegments: calculationRows.wallSegments,
    roomCeilingScopes: calculationRows.roomCeilingScopes,
    ceilingScopeSegments: calculationRows.ceilingScopeSegments,
    roomTrimScopes: calculationRows.roomTrimScopes,
    roomDoorScopes: calculationRows.roomDoorScopes,
    drywallRepairs: calculationRows.drywallRepairs,
    accessFees: calculationRows.accessFees,
    other: calculationRows.other,
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
    jobsettings: params.payload.jobsettings,
    rooms: params.payload.rooms,
    roomWallScopes: params.payload.room_wall_scopes,
    wallSegments: params.payload.wall_segments,
    roomCeilingScopes: params.payload.room_ceiling_scopes,
    ceilingScopeSegments: params.payload.ceiling_scope_segments,
    roomTrimScopes: params.payload.room_trim_scopes,
    roomDoorScopes: params.payload.room_door_scopes ?? [],
    drywallRepairs: params.payload.drywall_repairs ?? [],
    accessFees: params.payload.access_fees ?? [],
    other: params.payload.other ?? [],
    orgDefaults: params.orgDefaults,
  })
}

export function calculateEstimateV2ArtifactsWithCatalogs(params: {
  calculationCatalogs: EstimateV2CalculationCatalogBundle
  jobsettings: EstimateV2CalculationJobSettings | null
  rooms: EstimateV2CalculationRoomRow[]
  roomWallScopes: V2WallScopeSaveRow[]
  wallSegments: V2WallSegmentSaveRow[]
  roomCeilingScopes: V2CeilingScopeSaveRow[]
  ceilingScopeSegments: V2CeilingSegmentSaveRow[]
  roomTrimScopes: V2TrimScopeSaveRow[]
  roomDoorScopes?: V2DoorScopeSaveRow[]
  drywallRepairs?: V2DrywallRepairSaveRow[]
  accessFees?: EstimateV2AccessFeeCalculationInputRow[]
  other?: OtherCalculationRow[]
  orgDefaults: EstimateTemplateSettingsRow | null
  roomModeById?: Map<string, 'RECT' | 'SEG'>
}) {
  return calculateCanonicalEstimateV2Artifacts({
    calculationCatalogs: params.calculationCatalogs,
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
    roomModeById: params.roomModeById,
  })
}

export async function loadEffectiveLaborRate(
  orgId: string,
  estimateId: string,
  fromBody: EstimateV2CalculationJobSettingsInput | undefined
) {
  const laborRateFromBody = fromBody?.override_labor_rate ?? null
  if (laborRateFromBody != null) return laborRateFromBody

  const existingJobsettings = await supabaseAdmin
    .from('estimate_jobsettings')
    .select('override_labor_rate')
    .eq('org_id', orgId)
    .eq('estimate_id', estimateId)
    .maybeSingle()
  if (existingJobsettings.error) return null
  return normalizeEstimateV2JobSettingsInput(existingJobsettings.data ?? null)?.override_labor_rate ?? null
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

async function resolveSaveCalculationJobSettings(params: {
  orgId: string
  estimateId: string
  jobsettings: EstimateV2CalculationJobSettingsInput | undefined
}) {
  if (params.jobsettings) return params.jobsettings
  const existingJobsettings = await supabaseAdmin
    .from('estimate_jobsettings')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .maybeSingle()
  if (existingJobsettings.error) return null
  return normalizeEstimateV2JobSettingsInput(existingJobsettings.data ?? null)
}

export async function calculateEstimateV2ArtifactsForSave(params: {
  orgId: string
  estimateId: string
  roomRows: EstimateV2RoomRosterCalculationRow[]
  wallScopeRows: V2WallScopeSaveRow[]
  wallSegmentRows: V2WallSegmentSaveRow[]
  ceilingScopeRows: V2CeilingScopeSaveRow[]
  ceilingSegmentRows: V2CeilingSegmentSaveRow[]
  trimScopeRows: V2TrimScopeSaveRow[]
  doorScopeRows: V2DoorScopeSaveRow[]
  drywallRepairRows: V2DrywallRepairSaveRow[]
  accessFeeRows?: EstimateV2AccessFeeCalculationInputRow[]
  otherRows?: OtherCalculationRow[]
  jobsettings: EstimateV2CalculationJobSettingsInput | undefined
  orgDefaults: EstimateTemplateSettingsRow | null
  ensureCatalogs: ReturnType<typeof createCalculationCatalogsLoader>
}) {
  const [calculationCatalogs, calculationJobSettings, roomModeById] = await Promise.all([
    params.ensureCatalogs(),
    resolveSaveCalculationJobSettings({
      orgId: params.orgId,
      estimateId: params.estimateId,
      jobsettings: params.jobsettings,
    }),
    params.wallScopeRows.length > 0 || params.ceilingScopeRows.length > 0
      ? Promise.resolve(undefined)
      : loadEstimateV2RoomModesForTrimFromDb({
          orgId: params.orgId,
          estimateId: params.estimateId,
        }).catch(() => undefined),
  ])

  return calculateEstimateV2ArtifactsWithCatalogs({
    calculationCatalogs,
    jobsettings: calculationJobSettings,
    rooms: params.roomRows,
    roomWallScopes: params.wallScopeRows,
    wallSegments: params.wallSegmentRows,
    roomCeilingScopes: params.ceilingScopeRows,
    ceilingScopeSegments: params.ceilingSegmentRows,
    roomTrimScopes: params.trimScopeRows,
    roomDoorScopes: params.doorScopeRows,
    drywallRepairs: params.drywallRepairRows,
    accessFees: params.accessFeeRows ?? [],
    other: params.otherRows ?? [],
    orgDefaults: params.orgDefaults,
    roomModeById,
  })
}

export const _test = {
  resolveSaveCalculationJobSettings,
}
