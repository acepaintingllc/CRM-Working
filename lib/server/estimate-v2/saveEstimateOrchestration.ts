import { supabaseAdmin } from '../org.ts'
import {
  buildV2CeilingScopeRows,
  buildV2CeilingSegmentRows,
  buildV2RoomRosterRows,
  buildV2TrimScopeRows,
  buildV2WallScopeRows,
  buildV2WallSegmentRows,
  type V2CeilingScopeSaveRow,
  type V2CeilingSegmentSaveRow,
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

import {
  calculateCeilingsForSave,
  calculateTrimForSave,
  calculateWallsForSave,
  createCalculationCatalogsLoader,
} from './calculationOrchestration.ts'
import {
  buildLegacyEstimateRoomRows,
  replaceLegacyEstimateRooms,
  saveV2RoomRoster,
} from './roomPersistence.ts'
import {
  isMissingStructuredEstimateSaveRpc,
  isRecoverableStructuredEstimateSaveRpcPkCollision,
  saveEstimateStructuredInputsTransactional,
  softReplaceRows,
  softReplaceWallSegments,
} from './scopeRowPersistence.ts'
import { fail, getEstimate, toOtherRollupScope, toWallsCalcMethod } from './shared.ts'

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

  const existingRow = (existingJobSettingsRes.data ?? {}) as Unsafe
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

  const upsert = await supabaseAdmin.from('estimate_jobsettings').upsert(
    {
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
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
    const useStructuredTransactionalSave =
      !useV2WallsSave &&
      !useV2CeilingsSave &&
      !useV2TrimSave &&
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
    const ensureCatalogs = createCalculationCatalogsLoader({
      requestOrigin: params.requestOrigin,
      orgId: params.orgId,
      userId: params.userId,
      estimateId: params.estimateId,
    })

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
          scopes: v2WallScopeRows,
          segments: v2WallSegmentRows,
          jobsettings: body.jobsettings as Unsafe | undefined,
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
          scopes: v2CeilingScopeRows,
          segments: v2CeilingSegmentRows,
          jobsettings: body.jobsettings as Unsafe | undefined,
          ensureCatalogs,
        })
        ceilingCalculations = calculated.ceilingCalculations
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
          scopes: v2TrimScopeRows,
          roomRows: v2RoomRows,
          wallScopeRows: v2WallScopeRows,
          ceilingScopeRows: v2CeilingScopeRows,
          jobsettings: body.jobsettings as Unsafe | undefined,
          ensureCatalogs,
        })
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
      await upsertEstimateJobSettings({
        orgId: params.orgId,
        estimateId: params.estimateId,
        jobId: asText(estimate.job_id),
        row: body.jobsettings as Unsafe,
      })
    }

    if (Array.isArray(body.rooms)) {
      if (useV2WallsSave) {
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
      await softReplaceRows({
        table: 'estimate_room_wall_scopes',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: (v2WallScopeRows ?? []).map((row) => ({
          id: row.id, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, room_id: row.room_id, position: row.position, mode: row.mode, include: row.include, scope_name: row.scope_name, color_id: row.color_id, paint_product_id: row.paint_product_id, primer_product_id: row.primer_product_id, prime_mode: row.prime_mode, height_in: row.height_in, perimeter_in: row.perimeter_in, standard_door_count: row.standard_door_count, standard_window_count: row.standard_window_count, height_factor: row.height_factor, complexity_factor: row.complexity_factor, wall_flag_factor: row.wall_flag_factor, cut_in_top_factor: row.cut_in_top_factor, cut_in_bottom_factor: row.cut_in_bottom_factor, paint_coats: row.paint_coats, primer_coats: row.primer_coats, spot_prime_percent: row.spot_prime_percent, raw_area_sf: row.raw_area_sf, override_area_sf: row.override_area_sf, effective_area_sf: row.effective_area_sf, raw_paint_hours: row.raw_paint_hours, override_paint_hours: row.override_paint_hours, effective_paint_hours: row.effective_paint_hours, raw_primer_hours: row.raw_primer_hours, override_primer_hours: row.override_primer_hours, effective_primer_hours: row.effective_primer_hours, raw_paint_gallons: row.raw_paint_gallons, override_paint_gallons: row.override_paint_gallons, effective_paint_gallons: row.effective_paint_gallons, raw_primer_gallons: row.raw_primer_gallons, override_primer_gallons: row.override_primer_gallons, effective_primer_gallons: row.effective_primer_gallons, raw_supply_cost: row.raw_supply_cost, override_supply_cost: row.override_supply_cost, effective_supply_cost: row.effective_supply_cost, raw_total: row.raw_total, override_total: row.override_total, effective_total: row.effective_total, notes: row.notes,
        })),
      })

      const segNoByScope = new Map<string, number>()
      await softReplaceWallSegments({
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: (v2WallSegmentRows ?? []).map((row) => {
          const nextSegNo = (segNoByScope.get(row.wall_scope_id) ?? 0) + 1
          segNoByScope.set(row.wall_scope_id, nextSegNo)
          return {
            id: row.id, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, wall_scope_id: row.wall_scope_id, room_id: row.room_id, position: row.position, seg_no: nextSegNo, segment_name: row.segment_name, include: row.include, shape_type: row.shape_type, quantity: row.quantity, width_in: row.width_in, height_in: row.height_in, base_in: row.base_in, manual_area_sf: row.manual_area_sf, standard_door_count: row.standard_door_count, standard_window_count: row.standard_window_count, raw_area_sf: row.raw_area_sf, override_area_sf: row.override_area_sf, effective_area_sf: row.effective_area_sf, notes: row.notes,
          }
        }),
      })
    }

    if (useV2CeilingsSave) {
      await softReplaceRows({
        table: 'estimate_room_ceiling_scopes',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: (v2CeilingScopeRows ?? []).map((row) => ({
          id: row.id, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, room_id: row.room_id, position: row.position, mode: row.mode, include: row.include, scope_name: row.scope_name, color_id: row.color_id, paint_product_id: row.paint_product_id, primer_product_id: row.primer_product_id, prime_mode: row.prime_mode, spot_prime_percent: row.spot_prime_percent, ceiling_type_id: row.ceiling_type_id, length_in: row.length_in, width_in: row.width_in, area_sf: row.area_sf, height_factor: row.height_factor, complexity_factor: row.complexity_factor, ceiling_flag_factor: row.ceiling_flag_factor, override_area_sf: row.override_area_sf, override_paint_hours: row.override_paint_hours, override_primer_hours: row.override_primer_hours, override_paint_gallons: row.override_paint_gallons, override_primer_gallons: row.override_primer_gallons, override_supply_cost: row.override_supply_cost, override_total: row.override_total, raw_area_sf: row.raw_area_sf, effective_area_sf: row.effective_area_sf, raw_paint_hours: row.raw_paint_hours, effective_paint_hours: row.effective_paint_hours, raw_primer_hours: row.raw_primer_hours, effective_primer_hours: row.effective_primer_hours, raw_paint_gallons: row.raw_paint_gallons, effective_paint_gallons: row.effective_paint_gallons, raw_primer_gallons: row.raw_primer_gallons, effective_primer_gallons: row.effective_primer_gallons, raw_supply_cost: row.raw_supply_cost, effective_supply_cost: row.effective_supply_cost, raw_total: row.raw_total, effective_total: row.effective_total, paint_coats: row.paint_coats, primer_coats: row.primer_coats, notes: row.notes,
        })),
      })
      await softReplaceRows({
        table: 'estimate_room_ceiling_scope_segments',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: (v2CeilingSegmentRows ?? []).map((row) => ({
          id: row.id, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, ceiling_scope_id: row.ceiling_scope_id, room_id: row.room_id, position: row.position, segment_name: row.segment_name, include: row.include, shape_type: row.shape_type, quantity: row.quantity, width_in: row.width_in, height_in: row.height_in, base_in: row.base_in, manual_area_sf: row.manual_area_sf, raw_area_sf: row.raw_area_sf, override_area_sf: row.override_area_sf, effective_area_sf: row.effective_area_sf, notes: row.notes,
        })),
      })
    }

    if (useV2TrimSave) {
      await softReplaceRows({
        table: 'estimate_room_trim_scopes',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: (v2TrimScopeRows ?? []).map((row) => ({
          id: row.id, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, room_id: row.room_id, position: row.position, include: row.include, scope_name: row.scope_name, trim_type_id: row.trim_type_id, trim_family: row.trim_family, unit_type: row.unit_type, measurement_mode: row.measurement_mode, helper_source: row.helper_source, measurement_value: row.measurement_value, helper_value: row.helper_value, color_id: row.color_id, paint_product_id: row.paint_product_id, primer_product_id: row.primer_product_id, paint_enabled: row.paint_enabled, prime_mode: row.prime_mode, spot_prime_percent: row.spot_prime_percent, production_rate_id: row.production_rate_id, prep_factor: row.prep_factor, height_factor: row.height_factor, profile_factor: row.profile_factor, room_flag_factor: row.room_flag_factor, masking_factor: row.masking_factor, stair_factor: row.stair_factor, difficult_finish_factor: row.difficult_finish_factor, caulk_fill_factor: row.caulk_fill_factor, override_measurement: row.override_measurement, override_hours: row.override_hours, override_gallons: row.override_gallons, override_supply_cost: row.override_supply_cost, override_total: row.override_total, override_description: row.override_description, raw_measurement: row.raw_measurement, effective_measurement: row.effective_measurement, raw_paint_hours: row.raw_paint_hours, effective_paint_hours: row.effective_paint_hours, raw_primer_hours: row.raw_primer_hours, effective_primer_hours: row.effective_primer_hours, raw_paint_gallons: row.raw_paint_gallons, effective_paint_gallons: row.effective_paint_gallons, raw_primer_gallons: row.raw_primer_gallons, effective_primer_gallons: row.effective_primer_gallons, raw_supply_cost: row.raw_supply_cost, effective_supply_cost: row.effective_supply_cost, raw_total: row.raw_total, effective_total: row.effective_total, paint_coats: row.paint_coats, primer_coats: row.primer_coats, paint_prod_rate_units_per_hour: row.paint_prod_rate_units_per_hour, primer_prod_rate_units_per_hour: row.primer_prod_rate_units_per_hour, paint_coverage_units_per_gal_per_coat: row.paint_coverage_units_per_gal_per_coat, primer_coverage_units_per_gal_per_coat: row.primer_coverage_units_per_gal_per_coat, area_supply_cost_per_unit: row.area_supply_cost_per_unit, per_color_supply_cost: row.per_color_supply_cost, labor_rate_per_hour: row.labor_rate_per_hour, paint_price_per_gal: row.paint_price_per_gal, primer_price_per_gal: row.primer_price_per_gal, notes: row.notes,
        })),
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
      await softReplaceRows({
        table: 'estimate_access_fees',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.access_fees
          .map((row: Unsafe, idx: number) => ({
            id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, room_id: asText(row.room_id).toUpperCase() || null, segment_num: asNullableNumber(row.segment_num ?? row.segment_id), access_fee_id: asText(row.access_fee_id).toUpperCase(), qty: asNullableNumber(row.qty) ?? 1, active: toYN(row.active, 'Y'), notes: asText(row.notes) || null, actual_cost_override: asNullableNumber(row.actual_cost_override),
          }))
          .filter((row: { room_id: string | null; access_fee_id: string }) => !!(row.room_id && row.access_fee_id)),
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
      await softReplaceRows({
        table: 'estimate_other',
        orgId: params.orgId,
        estimateId: params.estimateId,
        rows: body.other.map((row: Unsafe, idx: number) => {
          const rollupScope = toOtherRollupScope(pickValue(row, ['rollup_scope', 'rollupScope', 'RollupScope']))
          if (!rollupScope) throw new Error(`Other row ${idx + 1}: RollupScope must be Walls, Ceilings, or Trim`)
          const clientDescription = asText(pickValue(row, ['client_description', 'clientDescription', 'ClientDescription']))
          if (!clientDescription) throw new Error(`Other row ${idx + 1}: ClientDescription is required`)
          const qtyRaw = pickValue(row, ['qty', 'Qty'])
          const qty = qtyRaw == null || qtyRaw === '' ? 1 : asNullableNumber(qtyRaw)
          if (qty == null || qty <= 0) throw new Error(`Other row ${idx + 1}: Qty must be numeric and greater than 0`)
          const laborHrsEach = asNullableNumber(pickValue(row, ['labor_hrs_each', 'laborHrsEach', 'LaborHrs_Each']))
          if (laborHrsEach == null || laborHrsEach < 0) throw new Error(`Other row ${idx + 1}: LaborHrs_Each must be numeric and >= 0`)
          const materialsEach = asNullableNumber(pickValue(row, ['materials_each', 'materialsEach', 'Materials$_Each']))
          if (materialsEach == null || materialsEach < 0) throw new Error(`Other row ${idx + 1}: Materials$_Each must be numeric and >= 0`)
          return {
            id: asText(row.id) || undefined, org_id: params.orgId, estimate_id: params.estimateId, job_id: estimate.job_id, position: idx, rollup_scope: rollupScope, location: asText(pickValue(row, ['location', 'Location'])) || null, client_description: clientDescription, qty, uom: asText(pickValue(row, ['uom', 'UOM'])) || null, labor_hrs_each: laborHrsEach, materials_each: materialsEach, notes: asText(pickValue(row, ['notes', 'Notes'])) || null, active: toYN(pickValue(row, ['active', 'Active?', 'Active']), 'Y'),
          }
        }),
      })
    }

    if (params.autosaveOnly) return { ok: true as const, autosave: true as const }
    if (useV2WallsSave || useV2CeilingsSave || useV2TrimSave) {
      return {
        ok: true as const,
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
