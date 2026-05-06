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
  asNullableNumber,
  asText,
  pickValue,
  toColorId,
  toYN,
  UUID_RE as uuid,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import { normalizeWallRollerTargetId } from '../../estimator/rollerIdentity.ts'
import { normalizeTrimPaintGallons } from '../trimPaint.ts'
import { loadEstimateTemplateSettings, type EstimateTemplateSettingsRow } from '../estimateTemplateSettings.ts'

import {
  calculateCeilingsForSave,
  calculateDoorsForSave,
  calculateDrywallForSave,
  calculateTrimForSave,
  calculateWallsForSave,
  createCalculationCatalogsLoader,
} from './calculationOrchestration.ts'
import {
  buildV2CeilingScopePersistenceRows,
  buildV2CeilingScopeSegmentPersistenceRows,
} from './ceilingScopePersistence.ts'
import { buildV2DoorScopePersistenceRows } from './doorScopePersistence.ts'
import { buildV2DrywallRepairPersistenceRows } from './drywallScopePersistence.ts'
import {
  buildLegacyEstimateRoomRows,
  replaceLegacyEstimateRooms,
  saveV2RoomRoster,
} from './roomPersistence.ts'
import type {
  EstimateAccessFeePersistenceRow,
  EstimateJobSettingsPersistenceRow,
  EstimateOtherPersistenceRow,
} from './persistenceTypes.ts'
import {
  isMissingStructuredEstimateSaveRpc,
  isRecoverableStructuredEstimateSaveRpcPkCollision,
  saveEstimateStructuredInputsTransactional,
  softReplaceRows,
  softReplaceWallSegments,
} from './scopeRowPersistence.ts'
import { fail, getEstimate, toOtherRollupScope, toWallsCalcMethod } from './shared.ts'
import {
  buildV2WallScopePersistenceRows,
  buildV2WallSegmentPersistenceRows,
} from './wallScopePersistence.ts'
import { buildV2TrimScopePersistenceRows } from './trimScopePersistence.ts'

/*
Risk map for the estimate save path.

Write order in the fallback TypeScript path:
1. `estimate_jobsettings` upsert.
2. `estimate_rooms` via `saveV2RoomRoster` for V2 scope saves, or `replaceLegacyEstimateRooms`
   for legacy room saves.
3. `estimate_room_wall_scopes`, then wall-linked `estimate_segments`.
4. `estimate_room_ceiling_scopes`, then `estimate_room_ceiling_scope_segments`.
5. `estimate_room_trim_scopes`.
6. `estimate_room_door_scopes`.
7. `estimate_drywall_repairs`.
8. legacy/plain `estimate_segments`.
9. `estimate_ceiling_segments`.
10. `estimate_rollers`.
11. `estimate_job_colors`.
12. `estimate_room_flags`.
13. `estimate_access_fees`.
14. `estimate_prejob`.
15. `estimate_trim_items`.
16. `estimate_other`.
17. `estimates.updated_at` touch.

Atomicity boundaries:
- `saveEstimateStructuredInputsTransactional()` calls the `save_estimate_v2_inputs` RPC. The
  SQL function executes inside one PostgreSQL transaction, so its covered writes either all commit
  or all roll back together.
- Today that RPC only covers a narrow structured subset: `estimate_jobsettings`,
  `estimate_rooms`, legacy/plain `estimate_segments`, `estimate_job_colors`,
  `estimate_room_flags`, and `estimate_access_fees`.
- The `estimates.updated_at` touch happens after the RPC returns, outside that transaction. If
  the touch fails after the RPC commits, the request can fail even though the underlying rows were
  already saved.
- Every fallback write below the RPC seam is non-transactional across tables. Each awaited call
  commits independently, so a later failure leaves earlier tables permanently changed.

Known partial-failure shapes:
- `replaceLegacyEstimateRooms()` is a hard DELETE then INSERT with no transaction wrapper. If the
  INSERT fails, the estimate is left with zero `estimate_rooms` rows while every other table keeps
  its previous data.
- `saveV2RoomRoster()` is also non-atomic. It can delete removed rooms, upsert kept rooms, and
  then fail inserting new rooms, leaving a mixed room roster.
- `softReplaceRows()` / `softReplaceWallSegments()` first mark existing rows `active = 'N'`, then
  upsert rows with ids, then insert rows without ids. If either later step fails, the loader reads
  an empty active set for that table, because load paths filter these tables by `active = 'Y'`.
- If a save fails after rooms commit but before wall scopes commit, the estimate can be read back
  as a hybrid snapshot: new `estimate_rooms`, old active wall scopes, and old wall-linked segments.
  Because load assembly reads each table independently and does not enforce a cross-table version
  check, orphaned scope rows can still be returned/calculated against the new room roster.
- The same hybrid risk applies to every later table in the sequence: earlier tables can be from
  the new save, while later tables remain from the prior save.
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

async function touchEstimateSavedAt(params: {
  orgId: string
  estimateId: string
}): Promise<SavedEstimateMeta> {
  const savedAt = new Date().toISOString()
  const res = await supabaseAdmin
    .from('estimates')
    .update({ updated_at: savedAt })
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
    .select(
      'id, org_id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, setting_set_id_used, created_at, updated_at'
    )
    .maybeSingle()
  if (res.error) throw new Error(res.error.message)
  if (!res.data) fail('Quote not found', 404)
  return res.data as SavedEstimateMeta
}

async function upsertEstimateJobSettings(params: {
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
  const row = params.row
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

  const jobSettingsRow = {
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
      walls_paint_id: has('walls_paint_id') ? asText(row.walls_paint_id) || null : existingRow.walls_paint_id ?? null,
      ceiling_paint_id: has('ceiling_paint_id') ? asText(row.ceiling_paint_id) || null : existingRow.ceiling_paint_id ?? null,
      trim_paint_id: has('trim_paint_id') ? asText(row.trim_paint_id) || null : existingRow.trim_paint_id ?? null,
      primer_id:
        has('primer_id') || has('walls_primer_id') || has('ceiling_primer_id') || has('trim_primer_id')
          ? asText(row.primer_id) ||
            asText(row.walls_primer_id) ||
            asText(row.ceiling_primer_id) ||
            asText(row.trim_primer_id) ||
            null
          : existingRow.primer_id ?? null,
      walls_primer_id: has('walls_primer_id') ? asText(row.walls_primer_id) || null : existingRow.walls_primer_id ?? null,
      ceiling_primer_id: has('ceiling_primer_id') ? asText(row.ceiling_primer_id) || null : existingRow.ceiling_primer_id ?? null,
      trim_primer_id: has('trim_primer_id') ? asText(row.trim_primer_id) || null : existingRow.trim_primer_id ?? null,
      override_labor_rate: has('override_labor_rate') ? asNullableNumber(row.override_labor_rate) : existingRow.override_labor_rate ?? null,
      override_markup: has('override_markup') ? asNullableNumber(row.override_markup) : existingRow.override_markup ?? null,
      rounding_increment_hours: has('rounding_increment_hours') ? asNullableNumber(row.rounding_increment_hours) : existingRow.rounding_increment_hours ?? null,
      dayhours: has('dayhours') ? asNullableNumber(row.dayhours) : existingRow.dayhours ?? null,
      default_walls_prep_level: has('default_walls_prep_level') ? asText(row.default_walls_prep_level) || null : existingRow.default_walls_prep_level ?? null,
      default_ceiling_prep_level: has('default_ceiling_prep_level') ? asText(row.default_ceiling_prep_level) || null : existingRow.default_ceiling_prep_level ?? null,
      default_trim_prep_level: has('default_trim_prep_level') ? asText(row.default_trim_prep_level) || null : existingRow.default_trim_prep_level ?? null,
      notes: has('notes') ? asText(row.notes) || null : existingRow.notes ?? null,
      walls_paint_gal_override: has('walls_paint_gal_override') ? asNullableNumber(row.walls_paint_gal_override) : existingRow.walls_paint_gal_override ?? null,
      ceiling_paint_gal_override: has('ceiling_paint_gal_override') ? asNullableNumber(row.ceiling_paint_gal_override) : existingRow.ceiling_paint_gal_override ?? null,
      primer_gal_override: has('primer_gal_override') ? asNullableNumber(row.primer_gal_override) : existingRow.primer_gal_override ?? null,
      extra_supplies_walls: has('extra_supplies_walls') ? asNullableNumber(row.extra_supplies_walls) : existingRow.extra_supplies_walls ?? null,
      extra_supplies_ceilings: has('extra_supplies_ceilings') ? asNullableNumber(row.extra_supplies_ceilings) : existingRow.extra_supplies_ceilings ?? null,
      extra_supplies_trim: has('extra_supplies_trim') ? asNullableNumber(row.extra_supplies_trim) : existingRow.extra_supplies_trim ?? null,
      trim_paint_gallons:
        has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
          ? normalizedTrimPaintGallons
          : existingRow.trim_paint_gallons ?? null,
      trim_paint_quarts:
        has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
          ? normalizedTrimPaintQuarts
          : existingRow.trim_paint_quarts ?? null,
      trim_paint_qty:
        has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
          ? normalizedTrimPaintGallons
          : existingRow.trim_paint_qty ?? null,
      trim_paint_uom:
        has('trim_paint_gallons') || has('trim_paint_quarts') || has('trim_paint_qty') || has('trim_paint_uom')
          ? normalizedTrimPaintGallons != null ? 'Gallon' : null
          : existingRow.trim_paint_uom ?? null,
      trim_primer_qty: has('trim_primer_qty') ? asNullableNumber(row.trim_primer_qty) : existingRow.trim_primer_qty ?? null,
      trim_primer_uom: has('trim_primer_uom') ? asText(row.trim_primer_uom) || null : existingRow.trim_primer_uom ?? null,
      paint_supplied_by: has('paint_supplied_by') ? asText(row.paint_supplied_by) || null : existingRow.paint_supplied_by ?? null,
      crew_size: has('crew_size') ? asNullableNumber(row.crew_size) : existingRow.crew_size ?? null,
      standard_door_deduction_sf: has('standard_door_deduction_sf')
        ? asNullableNumber(row.standard_door_deduction_sf)
        : existingRow.standard_door_deduction_sf ?? null,
      standard_window_deduction_sf: has('standard_window_deduction_sf')
        ? asNullableNumber(row.standard_window_deduction_sf)
        : existingRow.standard_window_deduction_sf ?? null,
      baseboard_opening_deduction_lf: has('baseboard_opening_deduction_lf')
        ? asNullableNumber(row.baseboard_opening_deduction_lf)
        : existingRow.baseboard_opening_deduction_lf ?? null,
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
       job_minimum_amount: has('job_minimum_amount') ? asNullableNumber(row.job_minimum_amount) : existingRow.job_minimum_amount ?? null,
    } satisfies EstimateJobSettingsPersistenceRow
  const upsert = await supabaseAdmin
    .from('estimate_jobsettings')
    .upsert(jobSettingsRow, { onConflict: 'org_id,estimate_id' })
  if (upsert.error) throw new Error(upsert.error.message)
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
    const useAnyV2ScopeSave = useV2WallsSave || useV2CeilingsSave || useV2TrimSave || useV2DoorsSave || useV2DrywallSave || useV2OtherSave
    const useStructuredTransactionalSave =
      !useAnyV2ScopeSave &&
      (Array.isArray(body.job_colors) || Array.isArray(body.room_flags) || Array.isArray(body.access_fees))

    let v2RoomRows: V2RoomRosterRow[] | null = null
    let v2WallScopeRows: V2WallScopeSaveRow[] | null = null
    let v2WallSegmentRows: V2WallSegmentSaveRow[] | null = null
    let wallCalculations: Awaited<ReturnType<typeof calculateWallsForSave>>['wallCalculations'] | null = null
    let v2CeilingScopeRows: V2CeilingScopeSaveRow[] | null = null
    let v2CeilingSegmentRows: V2CeilingSegmentSaveRow[] | null = null
    let ceilingCalculations: Awaited<ReturnType<typeof calculateCeilingsForSave>>['ceilingCalculations'] | null = null
    let v2TrimScopeRows: V2TrimScopeSaveRow[] | null = null
    let trimCalculations: Awaited<ReturnType<typeof calculateTrimForSave>> | null = null
    let v2DoorScopeRows: V2DoorScopeSaveRow[] | null = null
    let doorCalculations: Awaited<ReturnType<typeof calculateDoorsForSave>> | null = null
    let v2DrywallRepairRows: V2DrywallRepairSaveRow[] | null = null
    let drywallCalculations: Awaited<ReturnType<typeof calculateDrywallForSave>> | null = null
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
      if (!params.autosaveOnly) {
        const calculated = await calculateWallsForSave({
          requestOrigin: params.requestOrigin,
          orgId: params.orgId,
          userId: params.userId,
          estimateId: params.estimateId,
          scopes: v2WallScopeRows ?? [],
          roomRows: v2RoomRows,
          segments: v2WallSegmentRows ?? [],
          jobsettings: body.jobsettings as Unsafe | undefined,
          orgDefaults: await ensureOrgDefaults(),
          ensureCatalogs,
        })
        wallCalculations = calculated.wallCalculations
        v2WallSegmentRows = calculated.wallSegmentRows
      }
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
      if (!params.autosaveOnly) {
        const calculated = await calculateCeilingsForSave({
          orgId: params.orgId,
          estimateId: params.estimateId,
          scopes: v2CeilingScopeRows ?? [],
          roomRows: v2RoomRows,
          segments: v2CeilingSegmentRows ?? [],
          jobsettings: body.jobsettings as Unsafe | undefined,
          orgDefaults: await ensureOrgDefaults(),
          ensureCatalogs,
        })
        ceilingCalculations = calculated.ceilingCalculations
        v2CeilingScopeRows = calculated.ceilingScopeRows
        v2CeilingSegmentRows = calculated.ceilingSegmentRows
      }
    }

    if (useV2TrimSave) {
      if (!Array.isArray(body.rooms)) throw new Error('V2 trim save requires rooms')
      if (!v2RoomRows) v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      v2TrimScopeRows = buildV2TrimScopeRows(
        body.room_trim_scopes as Unsafe[],
        new Set(v2RoomRows.map((row) => row.room_id))
      ).scopeRows
      if (!params.autosaveOnly) {
        trimCalculations = await calculateTrimForSave({
          orgId: params.orgId,
          estimateId: params.estimateId,
          scopes: v2TrimScopeRows ?? [],
          roomRows: v2RoomRows,
          wallScopeRows: v2WallScopeRows,
          ceilingScopeRows: v2CeilingScopeRows,
          jobsettings: body.jobsettings as Unsafe | undefined,
          orgDefaults: await ensureOrgDefaults(),
          ensureCatalogs,
        })
      }
    }

    if (useV2DoorsSave) {
      if (!Array.isArray(body.rooms)) throw new Error('V2 door save requires rooms')
      if (!v2RoomRows) v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      v2DoorScopeRows = buildV2DoorScopeRows(
        body.room_door_scopes as Unsafe[],
        new Set(v2RoomRows.map((row) => row.room_id))
      ).scopeRows
      if (!params.autosaveOnly) {
        doorCalculations = await calculateDoorsForSave({
          orgId: params.orgId,
          estimateId: params.estimateId,
          scopes: v2DoorScopeRows ?? [],
          roomRows: v2RoomRows,
          jobsettings: body.jobsettings as Unsafe | undefined,
          orgDefaults: await ensureOrgDefaults(),
          ensureCatalogs,
        })
        v2DoorScopeRows = doorCalculations.scopes as V2DoorScopeSaveRow[]
      }
    }

    if (useV2DrywallSave) {
      if (!Array.isArray(body.rooms)) throw new Error('V2 drywall save requires rooms')
      if (!v2RoomRows) v2RoomRows = buildV2RoomRosterRows(body.rooms as Unsafe[])
      v2DrywallRepairRows = buildV2DrywallRepairRows(
        body.drywall_repairs as Unsafe[],
        new Set(v2RoomRows.map((row) => row.room_id))
      ).repairRows
      if (!params.autosaveOnly) {
        drywallCalculations = await calculateDrywallForSave({
          repairs: v2DrywallRepairRows ?? [],
          ensureCatalogs,
        })
        v2DrywallRepairRows = drywallCalculations.scopes as V2DrywallRepairSaveRow[]
      }
    }

    if (useStructuredTransactionalSave) {
      const jobId = asText(estimate.job_id)
      if (uuid.test(jobId)) {
        try {
          await saveEstimateStructuredInputsTransactional({
            orgId: params.orgId,
            estimateId: params.estimateId,
            jobId,
            payload: body as Record<string, unknown>,
          })
          const savedEstimate = await touchEstimateSavedAt({
            orgId: params.orgId,
            estimateId: params.estimateId,
          })
          return { ok: true as const, estimate: savedEstimate }
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
      await upsertEstimateJobSettings({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: asText(estimate.job_id),
        row: body.jobsettings as Unsafe,
      })
    }

    if (Array.isArray(body.rooms)) {
      if (useAnyV2ScopeSave) {
        await saveV2RoomRoster({
          orgId: params.orgId,
          estimateId: params.estimateId,
          jobId: asText(estimate.job_id),
          rows: v2RoomRows ?? [],
        })
      } else {
        await replaceLegacyEstimateRooms({
          orgId: params.orgId,
          estimateId: params.estimateId,
          rows: buildLegacyEstimateRoomRows({
            orgId: params.orgId,
            estimateId: params.estimateId,
            jobId: asText(estimate.job_id),
            rooms: body.rooms as Unsafe[],
          }),
        })
      }
    }

    if (useV2WallsSave) {
      const wallScopeRows = buildV2WallScopePersistenceRows(v2WallScopeRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: estimate.job_id,
      })
      await softReplaceRows({
        table: 'estimate_room_wall_scopes',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: wallScopeRows,
      })

      const wallSegmentRows = buildV2WallSegmentPersistenceRows(v2WallSegmentRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: estimate.job_id,
      })
      await softReplaceWallSegments({
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: wallSegmentRows,
      })
    }

    if (useV2CeilingsSave) {
      const ceilingScopeRows = buildV2CeilingScopePersistenceRows(v2CeilingScopeRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: estimate.job_id,
      })
      await softReplaceRows({
        table: 'estimate_room_ceiling_scopes',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: ceilingScopeRows,
      })
      const ceilingSegmentRows = buildV2CeilingScopeSegmentPersistenceRows(
        v2CeilingSegmentRows ?? [],
        {
          orgId: params.orgId,
          estimateId: params.estimateId,
          jobId: estimate.job_id,
        }
      )
      await softReplaceRows({
        table: 'estimate_room_ceiling_scope_segments',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: ceilingSegmentRows,
      })
    }

    if (useV2TrimSave) {
      const trimScopeRows = buildV2TrimScopePersistenceRows(v2TrimScopeRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: estimate.job_id,
      })
      await softReplaceRows({
        table: 'estimate_room_trim_scopes',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: trimScopeRows,
      })
    }

    if (useV2DoorsSave) {
      const doorScopeRows = buildV2DoorScopePersistenceRows(v2DoorScopeRows ?? [], {
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: estimate.job_id,
      })
      await softReplaceRows({
        table: 'estimate_room_door_scopes',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: doorScopeRows,
      })
    }

    if (useV2DrywallSave) {
      const drywallRepairRows = buildV2DrywallRepairPersistenceRows(
        v2DrywallRepairRows ?? [],
        {
          orgId: params.orgId,
          estimateId: params.estimateId,
          jobId: estimate.job_id,
        }
      )
      await softReplaceRows({
        table: 'estimate_drywall_repairs',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: drywallRepairRows,
      })
    }

    if (Array.isArray(body.segments)) {
      const segNoByRoom = new Map<string, number>()
      await softReplaceRows({
        table: 'estimate_segments',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.segments
          .map((row: Unsafe, idx: number) => {
            const roomId = asText(row.room_id) || null
            const existingNo = asNullableNumber(row.seg_no)
            const nextNo = roomId ? (segNoByRoom.get(roomId) ?? 0) + 1 : null
            const segNo = existingNo ?? nextNo
            if (roomId && segNo != null) segNoByRoom.set(roomId, segNo)
            return {
              id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, room_id: roomId, seg_no: segNo, seglen_in: asNullableNumber(row.seglen_in), seg_wallheight_in: asNullableNumber(row.seg_wallheight_in ?? row.segwallheight_in), wall_complexity_type_id: asText(row.wall_complexity_type_id).toUpperCase() || 'STANDARD', walls_calc_method: toWallsCalcMethod(row.walls_calc_method ?? row.wallscalcmethod ?? row.walls_calcmethod), panel_length_in: asNullableNumber(row.panel_length_in), panel_height_bottom_in: asNullableNumber(row.panel_height_bottom_in), panel_height_top_in: asNullableNumber(row.panel_height_top_in), baseexclude_in: asNullableNumber(row.baseexclude_in), notes: asText(row.notes) || null, wall_label: asText(row.wall_label) || null, wall_color_override_id: toColorId(row.wall_color_override_id) || null, active: toYN(row.active, 'Y'),
            }
          })
          .filter((row: { room_id: string | null; seg_no: number | null }) => row.room_id && row.seg_no != null),
      })
    }

    if (Array.isArray(body.ceiling_segments)) {
      const segNoByRoom = new Map<string, number>()
      await softReplaceRows({
        table: 'estimate_ceiling_segments',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.ceiling_segments
          .map((row: Unsafe, idx: number) => {
            const roomId = asText(row.room_id) || null
            const existingNo = asNullableNumber(row.seg_no)
            const nextNo = roomId ? (segNoByRoom.get(roomId) ?? 0) + 1 : null
            const segNo = existingNo ?? nextNo
            if (roomId && segNo != null) segNoByRoom.set(roomId, segNo)
            return {
              id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, room_id: roomId, seg_no: segNo, length_in: asNullableNumber(row.length_in), width_in: asNullableNumber(row.width_in), ceiling_height_in: asNullableNumber(row.ceiling_height_in ?? row.ceilingheight_in ?? row.height_in ?? row.seg_ceiling_height_in), notes: asText(row.notes) || null, active: toYN(row.active, 'Y'),
            }
          })
          .filter((row: { room_id: string | null; seg_no: number | null }) => row.room_id && row.seg_no != null),
      })
    }

    if (Array.isArray(body.rollers)) {
      const normalizeRollerScope = (value: unknown) => {
        const raw = asText(value)
        if (raw === 'Ceiling') return 'Ceiling'
        if (raw === 'Trim') return 'Trim'
        return 'Wall'
      }
      await softReplaceRows({
        table: 'estimate_rollers',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.rollers
          .map((row: Unsafe, idx: number) => ({
            id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, scope: normalizeRollerScope(row.scope), wall_color_id: normalizeWallRollerTargetId(asText(row.wall_color_id)) || null, selected_option_id: asText(row.selected_option_id) || null, roller_size_in: asNullableNumber(row.roller_size_in), covers_qty: asNullableNumber(row.covers_qty), notes: asText(row.notes) || null, active: toYN(row.active, 'Y'),
          }))
          .filter((row) => row.scope === 'Ceiling' || row.scope === 'Trim' || !!row.wall_color_id),
      })
    }

    if (Array.isArray(body.job_colors)) {
      await softReplaceRows({
        table: 'estimate_job_colors',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.job_colors
          .map((row: Unsafe, idx: number) => ({
            id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, color_id: asText(row.color_id || row.wall_color_id).toUpperCase(), color_name: asText(row.color_name) || null, roller_cover_id: asText(row.roller_cover_id).toUpperCase() || null, roller_cover_qty: asNullableNumber(row.roller_cover_qty), active: toYN(row.active, 'Y'),
          }))
          .filter((row: { color_id: string }) => !!row.color_id),
      })
    }

    if (Array.isArray(body.room_flags)) {
      const validRoomIds = new Set((Array.isArray(body.rooms) ? body.rooms : []).map((r: Unsafe) => asText(r.room_id).toUpperCase()))
      await softReplaceRows({
        table: 'estimate_room_flags',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.room_flags
          .map((row: Unsafe, idx: number) => ({
            id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, room_id: asText(row.room_id).toUpperCase() || null, flag_id: asText(row.flag_id).toUpperCase(), active: toYN(row.active, 'Y'),
          }))
          .filter((row: { room_id: string | null; flag_id: string }) => !!(row.room_id && row.flag_id && validRoomIds.has(row.room_id))),
      })
    }

    if (Array.isArray(body.access_fees)) {
      const accessFeeRows: EstimateAccessFeePersistenceRow[] = body.access_fees
        .map((row: Unsafe, idx: number) => ({
          id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, room_id: asText(row.room_id).toUpperCase() || null, segment_num: asNullableNumber(row.segment_num ?? row.segment_id), access_fee_id: asText(row.access_fee_id).toUpperCase(), qty: asNullableNumber(row.qty) ?? 1, active: toYN(row.active, 'Y'), notes: asText(row.notes) || null, actual_cost_override: asNullableNumber(row.actual_cost_override),
        }))
        .filter((row: { access_fee_id: string }) => !!row.access_fee_id)
      await softReplaceRows({
        table: 'estimate_access_fees',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: accessFeeRows,
      })
    }

    if (Array.isArray(body.prejob)) {
      await softReplaceRows({
        table: 'estimate_prejob',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.prejob
          .map((row: Unsafe, idx: number) => {
            const hasTemplateTask = !!asText(row.task_template_id)
            const quantity = asNullableNumber(row.qty ?? row.man_qty)
            return {
              id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, category: asText(row.category || row.rollup_scope) || null, trip_name: asText(row.trip_name || row.manual_task_name || row.man_trip_name) || null, trip_num: asNullableNumber(row.trip_num), rollup_scope: asText(row.rollup_scope || row.category) || null, man_trip_name: hasTemplateTask ? null : asText(row.manual_task_name || row.man_trip_name || row.trip_name) || null, man_qty: hasTemplateTask ? null : quantity, man_hours_each: asNullableNumber(row.man_hours_each ?? row.hours_each), task: asText(row.task_name || row.task_label || row.manual_task_name || row.man_trip_name || row.trip_name || row.task) || null, qty: hasTemplateTask ? quantity : null, hours_each: asNullableNumber(row.hours_each), laborrate: asNullableNumber(row.laborrate ?? row.man_hours_each), markup: asNullableNumber(row.markup), extra_supplies: asNullableNumber(row.extra_supplies), notes: asText(row.notes) || null, active: toYN(row.active, 'Y'),
            }
          })
          .filter((row: { task: string | null; man_trip_name: string | null; trip_name: string | null }) => !!(row.task || row.man_trip_name || row.trip_name)),
      })
    }

    if (Array.isArray(body.trim_items)) {
      await softReplaceRows({
        table: 'estimate_trim_items',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.trim_items
          .map((row: Unsafe, idx: number) => ({
            id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, room_id: asText(row.room_id) || null, trim_menu_id: asText(row.trim_menu_id), qty: asNullableNumber(row.qty), coats: asNullableNumber(row.coats), auto_calc: toYN(row.auto_calc, 'N'), primer_mode: asText(row.primer_mode) || null, spot_prime_pct: asNullableNumber(row.spot_prime_pct), prep_level_override: asText(row.prep_level_override) || null, door_sides: asNullableNumber(row.door_sides), notes: asText(row.notes) || null, active: toYN(row.active, 'Y'), sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : idx,
          }))
          .filter((row: { trim_menu_id: string; qty: number | null }) => row.trim_menu_id && (row.qty ?? 0) > 0),
      })
    }

    if (Array.isArray(body.other)) {
      const otherRows: EstimateOtherPersistenceRow[] = body.other.map((row: Unsafe, idx: number) => {
        const rollupTarget = asText(pickValue(row, ['rollup_target', 'rollupTarget'])).toLowerCase() || 'other'
        const rollupScope =
          toOtherRollupScope(pickValue(row, ['rollup_scope', 'rollupScope', 'RollupScope'])) ??
          (rollupTarget === 'ceilings'
            ? 'Ceilings'
            : rollupTarget === 'trim' || rollupTarget === 'doors'
              ? 'Trim'
              : 'Walls')
        const clientDescription =
          asText(pickValue(row, ['client_description', 'clientDescription', 'ClientDescription'])) ||
          asText(pickValue(row, ['customer_label', 'customerLabel'])) ||
          asText(pickValue(row, ['description']))
        if (!clientDescription) throw new Error(`Other row ${idx + 1}: description or customer label is required`)
        const qtyRaw = pickValue(row, ['qty', 'Qty'])
        const qty = qtyRaw == null || qtyRaw === '' ? 1 : asNullableNumber(qtyRaw)
        if (qty == null || qty <= 0) throw new Error(`Other row ${idx + 1}: Qty must be numeric and greater than 0`)
        const laborHrsEach = asNullableNumber(pickValue(row, ['labor_hrs_each', 'laborHrsEach', 'LaborHrs_Each', 'labor_hours', 'laborHours'])) ?? 0
        if (laborHrsEach == null || laborHrsEach < 0) throw new Error(`Other row ${idx + 1}: LaborHrs_Each must be numeric and >= 0`)
        const materialsEach = asNullableNumber(pickValue(row, ['materials_each', 'materialsEach', 'Materials$_Each', 'material_cost', 'materialCost', 'unit_rate', 'unitRate', 'fixed_amount', 'fixedAmount'])) ?? 0
        if (materialsEach == null || materialsEach < 0) throw new Error(`Other row ${idx + 1}: Materials$_Each must be numeric and >= 0`)
        return {
          id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, rollup_scope: rollupScope, location: asText(pickValue(row, ['location', 'Location', 'room_id', 'roomId'])) || null, client_description: clientDescription, qty, uom: asText(pickValue(row, ['uom', 'UOM'])) || null, labor_hrs_each: laborHrsEach, materials_each: materialsEach, notes: asText(pickValue(row, ['notes', 'Notes', 'internal_notes', 'internalNotes'])) || null, active: toYN(pickValue(row, ['active', 'Active?', 'Active']), 'Y'),
          room_id: asText(pickValue(row, ['room_id', 'roomId'])).toUpperCase() || null,
          description: asText(pickValue(row, ['description'])) || null,
          customer_label: asText(pickValue(row, ['customer_label', 'customerLabel'])) || null,
          pricing_mode: asText(pickValue(row, ['pricing_mode', 'pricingMode'])) || null,
          quantity: asNullableNumber(pickValue(row, ['quantity'])),
          unit_rate: asNullableNumber(pickValue(row, ['unit_rate', 'unitRate'])),
          labor_hours: asNullableNumber(pickValue(row, ['labor_hours', 'laborHours'])),
          labor_rate: asNullableNumber(pickValue(row, ['labor_rate', 'laborRate'])),
          material_cost: asNullableNumber(pickValue(row, ['material_cost', 'materialCost'])),
          supply_cost: asNullableNumber(pickValue(row, ['supply_cost', 'supplyCost'])),
          fixed_amount: asNullableNumber(pickValue(row, ['fixed_amount', 'fixedAmount'])),
          rollup_target: rollupTarget,
          customer_visibility: asText(pickValue(row, ['customer_visibility', 'customerVisibility'])) || 'standalone',
          internal_notes: asText(pickValue(row, ['internal_notes', 'internalNotes'])) || null,
        }
      })
      await softReplaceRows({
        table: 'estimate_other',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: otherRows,
      })
    }

    const savedEstimate = await touchEstimateSavedAt({
      orgId: params.orgId,
      estimateId: params.estimateId,
    })
    if (params.autosaveOnly) {
      return { ok: true as const, autosave: true as const, estimate: savedEstimate }
    }
    if (useAnyV2ScopeSave) {
      const result: {
        ok: true
        estimate: SavedEstimateMeta
        wall_calculations: typeof wallCalculations
        ceiling_calculations: typeof ceilingCalculations
        trim_calculations: typeof trimCalculations
        door_calculations?: typeof doorCalculations
        drywall_calculations?: typeof drywallCalculations
      } = {
        ok: true as const,
        estimate: savedEstimate,
        wall_calculations: wallCalculations,
        ceiling_calculations: ceilingCalculations,
        trim_calculations: trimCalculations,
      }
      if (useV2DoorsSave) result.door_calculations = doorCalculations
      if (useV2DrywallSave) result.drywall_calculations = drywallCalculations
      return result
    }
    return { ok: true as const, estimate: savedEstimate }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed saving estimate inputs'
    fail(message, 400)
  }
}
