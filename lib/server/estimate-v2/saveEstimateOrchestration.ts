import { supabaseAdmin } from '../org.ts'
import {
  buildV2CeilingScopeRows,
  buildV2CeilingSegmentRows,
  buildV2DoorScopeRows,
  buildV2DrywallRepairRows,
  buildV2RoomRosterRows,
  buildV2TrimScopeRows,
  buildV2WallScopeRows,
  buildV2WallSegmentRows,
  type V2CeilingScopeSaveRow,
  type V2CeilingSegmentSaveRow,
  type V2DoorScopeSaveRow,
  type V2DrywallRepairSaveRow,
  type V2RoomRosterRow,
  type V2TrimScopeSaveRow,
  type V2WallScopeSaveRow,
  type V2WallSegmentSaveRow,
} from '../estimateV2RoutePayload.ts'
import {
  asText,
  UUID_RE as uuid,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import { loadEstimateTemplateSettings, type EstimateTemplateSettingsRow } from '../estimateTemplateSettings.ts'

import {
  calculateEstimateV2ArtifactsForSave,
  createCalculationCatalogsLoader,
} from './calculationOrchestration.ts'
import {
  buildV2CeilingScopePersistenceRows,
  buildV2CeilingScopeSegmentPersistenceRows,
} from './ceilingScopePersistence.ts'
import { buildV2DoorScopePersistenceRows } from './doorScopePersistence.ts'
import { buildV2DrywallRepairPersistenceRows } from './drywallScopePersistence.ts'
import { buildEstimateAccessFeePersistenceRows } from './accessFeePersistence.ts'
import { buildEstimateJobColorPersistenceRows } from './jobColorPersistence.ts'
import { buildEstimateJobSettingsPersistenceRow } from './jobSettingsPersistence.ts'
import { buildEstimateOtherPersistenceRows } from './otherItemPersistence.ts'
import { buildEstimatePrejobPersistenceRows } from './prejobPersistence.ts'
import { buildEstimateRollerPersistenceRows } from './rollerPersistence.ts'
import {
  buildV2RoomPersistenceRow,
} from './roomPersistence.ts'
import { buildEstimateRoomFlagPersistenceRows } from './roomFlagPersistence.ts'
import type {
  EstimateAccessFeePersistenceRow,
  EstimateJobSettingsPersistenceRow,
  EstimateOtherPersistenceRow,
} from './persistenceTypes.ts'
import {
  type EstimateFullPersistencePayload,
  saveEstimateFullPersistenceTransactional,
  isMissingFullEstimateSaveRpc,
} from './scopeRowPersistence.ts'
import { fail, getEstimate } from './shared.ts'
import {
  buildV2WallScopePersistenceRows,
  buildV2WallSegmentPersistenceRows,
} from './wallScopePersistence.ts'
import { buildV2TrimScopePersistenceRows } from './trimScopePersistence.ts'
import { buildEstimateTrimItemPersistenceRows } from './trimItemPersistence.ts'
import { loadEstimateV2Response } from './loadEstimateAssembly.ts'

/*
Estimator V2 saves now rely on the full-save RPC as the only supported persistence path.

Atomicity boundary:
- `saveEstimateFullPersistenceTransactional()` calls the `save_estimate_v2_full_persistence` RPC.
  The SQL function executes inside one PostgreSQL transaction, covers both child rows and the final
  `estimates.updated_at` touch, and avoids the prior hybrid-snapshot failure modes.

Failure policy:
- If the full-save RPC is missing or fails, the request fails. We do not fall back to piecemeal
  TypeScript table writes, because that can commit child rows and still report a later parent-row
  touch as the only visible save signal.
*/
type SavedEstimateMeta = {
  id: string
  org_id: string
  job_id: string
  customer_id: string | null
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  setting_set_id_used: string | null
  created_at: string | null
  updated_at: string | null
}

async function loadSavedEstimateMeta(params: {
  orgId: string
  estimateId: string
}): Promise<SavedEstimateMeta> {
  const res = await supabaseAdmin
    .from('estimates')
    .select(
      'id, org_id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, setting_set_id_used, created_at, updated_at'
    )
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
    .maybeSingle()
  if (res.error) throw new Error(res.error.message)
  if (!res.data) fail('Quote not found', 404)
  return res.data as SavedEstimateMeta
}

async function buildNormalizedEstimateJobSettingsRow(params: {
  orgId: string
  estimateId: string
  jobId: string
  row: Unsafe
}) {
  const existingJobSettingsRes = await supabaseAdmin
    .from('estimate_jobsettings')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .maybeSingle()
  if (existingJobSettingsRes.error) throw new Error(existingJobSettingsRes.error.message)

  const existingRow = (existingJobSettingsRes.data ?? {}) as Partial<EstimateJobSettingsPersistenceRow> &
    Unsafe
  return buildEstimateJobSettingsPersistenceRow({
    orgId: params.orgId,
    estimateId: params.estimateId,
    jobId: params.jobId,
    row: params.row,
    existingRow,
  })
}

function coerceSavedEstimateMeta(value: unknown): SavedEstimateMeta | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Unsafe
  const id = asText(row.id)
  const orgId = asText(row.org_id)
  const jobId = asText(row.job_id)
  if (!id || !orgId || !jobId) return null
  return {
    id,
    org_id: orgId,
    job_id: jobId,
    customer_id: asText(row.customer_id) || null,
    status: asText(row.status) || null,
    version_name: asText(row.version_name) || null,
    version_state: asText(row.version_state) || null,
    version_kind: asText(row.version_kind) || null,
    version_sort_order:
      typeof row.version_sort_order === 'number' ? row.version_sort_order : null,
    setting_set_id_used: asText(row.setting_set_id_used) || null,
    created_at: asText(row.created_at) || null,
    updated_at: asText(row.updated_at) || null,
  }
}

export async function saveEstimateV2Inputs(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
  body: Unsafe
  autosaveOnly: boolean
}) {
  const estimateRes = await getEstimate(params.orgId, params.estimateId)
  if ('error' in estimateRes) {
    const message = asText(estimateRes.error) || 'Failed to load estimate'
    fail(message, message === 'Quote not found' ? 404 : 500)
  }
  const estimate = estimateRes.estimate
  const body = params.body
  if (!body || typeof body !== 'object') fail('Missing body', 400)

  try {
    const useV2WallsSave = Array.isArray(body.room_wall_scopes) || Array.isArray(body.wall_segments)
    const useV2CeilingsSave = Array.isArray(body.room_ceiling_scopes)
    const useV2TrimSave = Array.isArray(body.room_trim_scopes)
    const useV2DoorsSave = Array.isArray(body.room_door_scopes)
    const useV2DrywallSave = Array.isArray(body.drywall_repairs)
    const useV2OtherSave = Array.isArray(body.other)
    const hasScopeCalculationPayload =
      useV2WallsSave || useV2CeilingsSave || useV2TrimSave || useV2DoorsSave || useV2DrywallSave
    const hasCalculationPayload =
      hasScopeCalculationPayload || Array.isArray(body.access_fees) || useV2OtherSave
    const shouldReturnCanonicalPostSave = hasCalculationPayload
    const jobId = asText(estimate.job_id)
    const canUseTransactionalRpc = uuid.test(jobId)

    let v2RoomRows: V2RoomRosterRow[] | null = null
    let v2WallScopeRows: V2WallScopeSaveRow[] | null = null
    let v2WallSegmentRows: V2WallSegmentSaveRow[] | null = null
    let v2CeilingScopeRows: V2CeilingScopeSaveRow[] | null = null
    let v2CeilingSegmentRows: V2CeilingSegmentSaveRow[] | null = null
    let v2TrimScopeRows: V2TrimScopeSaveRow[] | null = null
    let v2DoorScopeRows: V2DoorScopeSaveRow[] | null = null
    let v2DrywallRepairRows: V2DrywallRepairSaveRow[] | null = null
    let accessFeeRows: EstimateAccessFeePersistenceRow[] | null = null
    let otherRows: EstimateOtherPersistenceRow[] | null = null
    let jobSettingsRow: EstimateJobSettingsPersistenceRow | null = null
    const ensureCatalogs = createCalculationCatalogsLoader({
      requestOrigin: params.requestOrigin,
      orgId: params.orgId,
      userId: params.userId,
      estimateId: params.estimateId,
    })
    let orgDefaultsPromise: Promise<EstimateTemplateSettingsRow | null> | null = null
    const ensureOrgDefaults = () => {
      orgDefaultsPromise ??= loadEstimateTemplateSettings({
        orgId: params.orgId,
        estimateId: params.estimateId,
        settingSetId: asText((estimate as Unsafe).setting_set_id_used) || null,
      }).catch(() => null)
      return orgDefaultsPromise
    }

    if (useV2WallsSave) {
      if (!Array.isArray(body.rooms)) throw new Error('V2 walls save requires rooms')
      v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      const nextWallScopes = buildV2WallScopeRows(
        (Array.isArray(body.room_wall_scopes) ? body.room_wall_scopes : []) as Unsafe[],
        new Set(v2RoomRows.map((row) => row.room_id))
      )
      v2WallScopeRows = nextWallScopes.scopeRows
      v2WallSegmentRows = buildV2WallSegmentRows(
        (Array.isArray(body.wall_segments) ? body.wall_segments : []) as Unsafe[],
        nextWallScopes.scopeRows
      )
    }

    if (useV2CeilingsSave) {
      if (!Array.isArray(body.rooms)) throw new Error('V2 ceiling save requires rooms')
      if (!v2RoomRows) v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      const nextCeilingScopes = buildV2CeilingScopeRows(
        body.room_ceiling_scopes as Unsafe[],
        new Set(v2RoomRows.map((row) => row.room_id))
      )
      v2CeilingScopeRows = nextCeilingScopes.scopeRows
      v2CeilingSegmentRows = buildV2CeilingSegmentRows(
        (Array.isArray(body.ceiling_scope_segments) ? body.ceiling_scope_segments : []) as Unsafe[],
        nextCeilingScopes.scopeRows
      )
    }

    if (useV2TrimSave) {
      if (!Array.isArray(body.rooms)) throw new Error('V2 trim save requires rooms')
      if (!v2RoomRows) v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      v2TrimScopeRows = buildV2TrimScopeRows(
        body.room_trim_scopes as Unsafe[],
        new Set(v2RoomRows.map((row) => row.room_id))
      ).scopeRows
    }

    if (useV2DoorsSave) {
      if (!Array.isArray(body.rooms)) throw new Error('V2 door save requires rooms')
      if (!v2RoomRows) v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      v2DoorScopeRows = buildV2DoorScopeRows(
        body.room_door_scopes as Unsafe[],
        new Set(v2RoomRows.map((row) => row.room_id))
      ).scopeRows
    }

    if (useV2DrywallSave) {
      if (!Array.isArray(body.rooms)) throw new Error('V2 drywall save requires rooms')
      if (!v2RoomRows) v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      v2DrywallRepairRows = buildV2DrywallRepairRows(
        body.drywall_repairs as Unsafe[],
        new Set(v2RoomRows.map((row) => row.room_id))
      ).repairRows
    }

    if (Array.isArray(body.access_fees)) {
      accessFeeRows = buildEstimateAccessFeePersistenceRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        rows: body.access_fees as Unsafe[],
      })
    }

    if (Array.isArray(body.other)) {
      otherRows = buildEstimateOtherPersistenceRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        rows: body.other as Unsafe[],
      })
    }

    if (!params.autosaveOnly && hasCalculationPayload) {
      if (hasScopeCalculationPayload && !v2RoomRows) throw new Error('V2 scope save requires rooms')
      const calculated = await calculateEstimateV2ArtifactsForSave({
        orgId: params.orgId,
        estimateId: params.estimateId,
        roomRows: v2RoomRows ?? [],
        wallScopeRows: v2WallScopeRows ?? [],
        wallSegmentRows: v2WallSegmentRows ?? [],
        ceilingScopeRows: v2CeilingScopeRows ?? [],
        ceilingSegmentRows: v2CeilingSegmentRows ?? [],
        trimScopeRows: v2TrimScopeRows ?? [],
        doorScopeRows: v2DoorScopeRows ?? [],
        drywallRepairRows: v2DrywallRepairRows ?? [],
        accessFeeRows: (accessFeeRows ?? []).map((row, index) => ({
          id: row.id ?? `access-fee-${index}`,
          room_id: row.room_id,
          access_fee_id: row.access_fee_id,
          qty: row.qty,
          actual_cost_override: row.actual_cost_override,
          notes: row.notes,
          position: row.position,
          active: row.active,
        })),
        otherRows: otherRows ?? [],
        jobsettings: body.jobsettings as Unsafe | undefined,
        orgDefaults: await ensureOrgDefaults(),
        ensureCatalogs,
      })
      if (useV2WallsSave) {
        v2WallScopeRows = calculated.quoteWallScopes as V2WallScopeSaveRow[]
        v2WallSegmentRows = calculated.wallCalculations.segments as V2WallSegmentSaveRow[]
      }
      if (useV2CeilingsSave) {
        v2CeilingScopeRows = calculated.quoteCeilingScopes as V2CeilingScopeSaveRow[]
        v2CeilingSegmentRows = calculated.ceilingCalculations.segments as V2CeilingSegmentSaveRow[]
      }
      if (useV2TrimSave) {
        v2TrimScopeRows = calculated.quoteTrimScopes as V2TrimScopeSaveRow[]
      }
      if (useV2DoorsSave) {
        v2DoorScopeRows = calculated.quoteDoorScopes as V2DoorScopeSaveRow[]
      }
      if (useV2DrywallSave) {
        v2DrywallRepairRows = calculated.drywallCalculations.scopes as V2DrywallRepairSaveRow[]
      }
    }

    if (body.jobsettings) {
      jobSettingsRow = await buildNormalizedEstimateJobSettingsRow({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        row: body.jobsettings as Unsafe,
      })
    }

    const fullPersistencePayload: EstimateFullPersistencePayload = {}

    if (jobSettingsRow) {
      fullPersistencePayload.jobsettings = jobSettingsRow
    }

    if (Array.isArray(body.rooms)) {
      v2RoomRows ??= buildV2RoomRosterRows(body.rooms as Unsafe[])
      fullPersistencePayload.room_save_mode = 'v2_roster'
      fullPersistencePayload.rooms = v2RoomRows.map((row) =>
        buildV2RoomPersistenceRow({
          id: row.id,
          org_id: params.orgId,
          estimate_id: params.estimateId,
          job_id: jobId,
          position: row.position,
          room_id: row.room_id,
          room_name: row.room_name,
          room_type_id: row.room_type_id,
          wall_complexity_id: row.wall_complexity_id,
          notes: row.notes,
          length_in: row.length_in,
          width_in: row.width_in,
          wallheight_in: row.wallheight_in,
          condition_selections: row.condition_selections ?? null,
        })
      )
    }

    if (useV2WallsSave) {
      fullPersistencePayload.room_wall_scopes = buildV2WallScopePersistenceRows(v2WallScopeRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
      })
      fullPersistencePayload.wall_segments = buildV2WallSegmentPersistenceRows(v2WallSegmentRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
      })
    }

    if (useV2CeilingsSave) {
      fullPersistencePayload.room_ceiling_scopes = buildV2CeilingScopePersistenceRows(
        v2CeilingScopeRows ?? [],
        {
          orgId: params.orgId,
          estimateId: params.estimateId,
          jobId,
        }
      )
      fullPersistencePayload.ceiling_scope_segments = buildV2CeilingScopeSegmentPersistenceRows(
        v2CeilingSegmentRows ?? [],
        {
          orgId: params.orgId,
          estimateId: params.estimateId,
          jobId,
        }
      )
    }

    if (useV2TrimSave) {
      fullPersistencePayload.room_trim_scopes = buildV2TrimScopePersistenceRows(v2TrimScopeRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
      })
    }

    if (useV2DoorsSave) {
      fullPersistencePayload.room_door_scopes = buildV2DoorScopePersistenceRows(v2DoorScopeRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
      })
    }

    if (useV2DrywallSave) {
      fullPersistencePayload.drywall_repairs = buildV2DrywallRepairPersistenceRows(
        v2DrywallRepairRows ?? [],
        {
          orgId: params.orgId,
          estimateId: params.estimateId,
          jobId,
        }
      )
    }

    if (Array.isArray(body.rollers)) {
      fullPersistencePayload.rollers = buildEstimateRollerPersistenceRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        rows: body.rollers as Unsafe[],
      })
    }

    if (Array.isArray(body.job_colors)) {
      fullPersistencePayload.job_colors = buildEstimateJobColorPersistenceRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        rows: body.job_colors as Unsafe[],
      })
    }

    if (Array.isArray(body.room_flags)) {
      const validRoomIds = new Set(
        (Array.isArray(body.rooms) ? body.rooms : []).map((r: Unsafe) => asText(r.room_id).toUpperCase())
      )
      fullPersistencePayload.room_flags = buildEstimateRoomFlagPersistenceRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        rows: body.room_flags as Unsafe[],
        validRoomIds,
      })
    }

    if (Array.isArray(body.access_fees)) {
      fullPersistencePayload.access_fees = accessFeeRows ?? []
    }

    if (Array.isArray(body.prejob)) {
      fullPersistencePayload.prejob = buildEstimatePrejobPersistenceRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        rows: body.prejob as Unsafe[],
      })
    }

    if (Array.isArray(body.trim_items)) {
      fullPersistencePayload.trim_items = buildEstimateTrimItemPersistenceRows({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        rows: body.trim_items as Unsafe[],
      })
    }

    if (Array.isArray(body.other)) {
      fullPersistencePayload.other = otherRows ?? []
    }

    if (Object.keys(fullPersistencePayload).length === 0) {
      const savedEstimate = await loadSavedEstimateMeta({
        orgId: params.orgId,
        estimateId: params.estimateId,
      })
      if (params.autosaveOnly) {
        return { ok: true as const, autosave: true as const, estimate: savedEstimate }
      }
      if (shouldReturnCanonicalPostSave) {
        return {
          ok: true as const,
          ...(await loadEstimateV2Response({
            requestOrigin: params.requestOrigin,
            orgId: params.orgId,
            userId: params.userId,
            estimateId: params.estimateId,
          })),
          estimate: savedEstimate,
        }
      }
      return { ok: true as const, estimate: savedEstimate }
    }

    if (!canUseTransactionalRpc) {
      throw new Error('Estimate save requires a UUID job_id for the full-save RPC')
    }

    let savedEstimate: SavedEstimateMeta
    try {
      const rpcResult = await saveEstimateFullPersistenceTransactional({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId,
        payload: fullPersistencePayload,
      })
      savedEstimate =
        coerceSavedEstimateMeta(rpcResult) ??
        (await loadSavedEstimateMeta({
          orgId: params.orgId,
          estimateId: params.estimateId,
        }))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed saving estimate inputs transactionally'
      if (isMissingFullEstimateSaveRpc(message)) {
        throw new Error('Full estimate save RPC is required for Estimate V2 persistence')
      }
      throw error
    }

    if (params.autosaveOnly) {
      return { ok: true as const, autosave: true as const, estimate: savedEstimate }
    }
    if (shouldReturnCanonicalPostSave) {
      return {
        ok: true as const,
        ...(await loadEstimateV2Response({
          requestOrigin: params.requestOrigin,
          orgId: params.orgId,
          userId: params.userId,
          estimateId: params.estimateId,
        })),
        estimate: savedEstimate,
      }
    }
    return { ok: true as const, estimate: savedEstimate }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed saving estimate inputs'
    fail(message, 400)
  }
}
