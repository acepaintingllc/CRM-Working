import { supabaseAdmin } from '../org.ts'
import {
  asNullableNumber,
  asText,
  toColorId,
  toYN,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import type { V2RoomRosterRow } from '../estimateV2RoutePayload.ts'

import { nextRoomId } from './shared.ts'

export async function saveV2RoomRoster(params: {
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
      condition_selections: row.condition_selections ?? null,
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

export function buildLegacyEstimateRoomRows(params: {
  orgId: string
  estimateId: string
  jobId: string
  rooms: Unsafe[]
}) {
  const usedRoomIds = new Set<string>()
  return params.rooms
    .map((row, idx) => {
      const wallsInclude = toYN(row.walls_include, 'Y')
      const ceilingInclude = toYN(row.ceiling_include, 'N')
      const doorsInclude = toYN(row.doors_include, 'N')
      const drywallInclude = toYN(row.drywall_include, 'N')
      const mode = asText(row.mode || 'RECT').toUpperCase() === 'SEG' ? 'SEG' : 'RECT'
      const rawRoomId = asText(row.room_id).toUpperCase()
      const roomId =
        rawRoomId && !usedRoomIds.has(rawRoomId) ? rawRoomId : nextRoomId(usedRoomIds, idx + 1)
      usedRoomIds.add(roomId)
      const height = asNullableNumber(row.wallheight_in ?? row.height_in)
      const wallColorId = wallsInclude === 'Y' ? toColorId(row.wall_color_id) || 'A' : null
      const trimInclude = toYN(row.trim_include, 'N')
      const baseboardTypeId = trimInclude === 'Y' ? asText(row.baseboard_type_id) || null : null
      const crownTypeId = asText(row.crown_type_id) || null
      const paintCrown = toYN(row.paint_crown, 'N') === 'Y' || !!crownTypeId ? 'Y' : 'N'
      const windowCasingTypeId =
        trimInclude === 'Y' ? asText(row.window_casing_type_id) || null : null
      const doorCasingTypeId =
        trimInclude === 'Y' ? asText(row.door_casing_type_id) || null : null
      const doorTypeId = trimInclude === 'Y' ? asText(row.door_type_id) || null : null
      const baseboardLf = trimInclude === 'Y' ? asNullableNumber(row.baseboard_lf) : null
      const crownLf = trimInclude === 'Y' ? asNullableNumber(row.crown_lf) : null
      const windowCount = trimInclude === 'Y' ? asNullableNumber(row.window_count) : null
      const doorCasingCount =
        trimInclude === 'Y' ? asNullableNumber(row.door_casing_count) : null
      const doorPaintCount = trimInclude === 'Y' ? asNullableNumber(row.door_paint_count) : null
      const doorSides = trimInclude === 'Y' ? asNullableNumber(row.door_sides) : null
      const doorCount = doorCasingCount ?? doorPaintCount ?? asNullableNumber(row.door_count)
      const baseboardAuto = trimInclude === 'Y' && mode === 'RECT' ? toYN(row.baseboard_auto, 'N') : 'N'
      const crownAuto = trimInclude === 'Y' && mode === 'RECT' ? toYN(row.crown_auto, 'N') : 'N'
      const autoCalcTrimPerimeter = baseboardAuto === 'Y' || crownAuto === 'Y' ? 'Y' : 'N'
      return {
        org_id: params.orgId,
        estimate_id: params.estimateId,
        job_id: params.jobId,
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
          wallsInclude === 'Y' ? asNullableNumber(row.walls_topcoats ?? row.wall_coats) : null,
        wall_primer_coats:
          wallsInclude === 'Y' ? asNullableNumber(row.wall_primer_coats) : null,
        wall_spot_prime_pct:
          wallsInclude === 'Y' ? asNullableNumber(row.wall_spot_prime_pct) : null,
        walls_prep_override: asText(row.walls_prep_override) || null,
        walls_prep_level:
          wallsInclude === 'Y'
            ? asText(row.walls_prep_level || row.walls_prep_override) || null
            : null,
        wall_complexity_id:
          asText(
            row.wall_complexity_id || row.wall_complexity_type_id || row.wallcomplexitytypeid
          ).toUpperCase() || null,
        wall_sqft_override: wallsInclude === 'Y' ? asNullableNumber(row.wall_sqft_override) : null,
        openings_sqft: wallsInclude === 'Y' ? asNullableNumber(row.openings_sqft) : null,
        walls_notes: wallsInclude === 'Y' ? asText(row.walls_notes) || null : null,
        ceiling_include: ceilingInclude,
        ceiling_primer: ceilingInclude === 'Y' ? asText(row.ceiling_primer) || null : null,
        ceiling_topcoats:
          ceilingInclude === 'Y' ? asNullableNumber(row.ceiling_topcoats) : null,
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
}

export async function replaceLegacyEstimateRooms(params: {
  orgId: string
  estimateId: string
  rows: Record<string, unknown>[]
}) {
  const remove = await supabaseAdmin
    .from('estimate_rooms')
    .delete()
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
  if (remove.error) throw new Error(remove.error.message)

  if (!params.rows.length) return

  const insert = await supabaseAdmin.from('estimate_rooms').insert(params.rows)
  if (insert.error) throw new Error(insert.error.message)
}
