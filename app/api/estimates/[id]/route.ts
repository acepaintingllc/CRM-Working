import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toYN(value: unknown, fallback: 'Y' | 'N' = 'N') {
  const raw = asText(value).toUpperCase()
  if (raw === 'Y' || raw === 'N') return raw
  return fallback
}

function toColorId(value: unknown) {
  return asText(value)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

function toWallsCalcMethod(value: unknown): 'REGULAR' | 'PANEL' {
  return asText(value).toUpperCase() === 'PANEL' ? 'PANEL' : 'REGULAR'
}

function nextRoomId(used: Set<string>, startAt: number) {
  let n = Math.max(1, startAt)
  while (used.has(`R${String(n).padStart(3, '0')}`)) {
    n += 1
  }
  return `R${String(n).padStart(3, '0')}`
}

async function getEstimate(orgId: string, estimateId: string) {
  const res = await supabaseAdmin
    .from('estimates')
    .select('id, org_id, job_id, customer_id, status, sheet_schema_version, sheet_file_path, latest_output_json, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('id', estimateId)
    .maybeSingle()
  if (res.error) return { error: res.error.message } as const
  if (!res.data) return { error: 'Estimate not found' } as const
  return { estimate: res.data } as const
}

async function softReplaceRows(params: {
  table:
    | 'estimate_segments'
    | 'estimate_ceiling_segments'
    | 'estimate_rollers'
    | 'estimate_prejob'
    | 'estimate_trim_items'
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
  for (const row of params.rows) {
    const id = asText(row.id)
    if (id && uuid.test(id)) {
      const update = await supabaseAdmin
        .from(params.table)
        .update({ ...row, active: 'Y' })
        .eq('org_id', params.orgId)
        .eq('estimate_id', params.estimateId)
        .eq('id', id)
      if (update.error) throw new Error(update.error.message)
      continue
    }
    const insert = await supabaseAdmin.from(params.table).insert({ ...row, active: 'Y' })
    if (insert.error) throw new Error(insert.error.message)
  }
}

export async function GET(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }
  const { orgId } = session

  const params = await Promise.resolve(context.params)
  const id = (params as { id?: Unsafe } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  const estimateRes = await getEstimate(orgId, id)
  if ('error' in estimateRes) {
    const status = estimateRes.error === 'Estimate not found' ? 404 : 500
    return NextResponse.json({ error: estimateRes.error }, { status })
  }

  const [jobsettings, rooms, segments, ceilingSegments, rollers, prejob, trimItems] = await Promise.all([
    supabaseAdmin
      .from('estimate_jobsettings')
      .select('*')
      .eq('org_id', orgId)
      .eq('estimate_id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('estimate_rooms')
      .select('*')
      .eq('org_id', orgId)
      .eq('estimate_id', id)
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_segments')
      .select('*')
      .eq('org_id', orgId)
      .eq('estimate_id', id)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_ceiling_segments')
      .select('*')
      .eq('org_id', orgId)
      .eq('estimate_id', id)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_rollers')
      .select('*')
      .eq('org_id', orgId)
      .eq('estimate_id', id)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_prejob')
      .select('*')
      .eq('org_id', orgId)
      .eq('estimate_id', id)
      .eq('active', 'Y')
      .order('position', { ascending: true }),
    supabaseAdmin
      .from('estimate_trim_items')
      .select('*')
      .eq('org_id', orgId)
      .eq('estimate_id', id)
      .eq('active', 'Y')
      .order('sort_order', { ascending: true }),
  ])

  if (jobsettings.error) return NextResponse.json({ error: jobsettings.error.message }, { status: 500 })
  if (rooms.error) return NextResponse.json({ error: rooms.error.message }, { status: 500 })
  if (segments.error) return NextResponse.json({ error: segments.error.message }, { status: 500 })
  if (ceilingSegments.error) return NextResponse.json({ error: ceilingSegments.error.message }, { status: 500 })
  if (rollers.error) return NextResponse.json({ error: rollers.error.message }, { status: 500 })
  if (prejob.error) return NextResponse.json({ error: prejob.error.message }, { status: 500 })
  if (trimItems.error) return NextResponse.json({ error: trimItems.error.message }, { status: 500 })

  return NextResponse.json({
    estimate: estimateRes.estimate,
    inputs: {
      jobsettings: jobsettings.data,
      rooms: rooms.data ?? [],
      segments: segments.data ?? [],
      ceiling_segments: ceilingSegments.data ?? [],
      rollers: rollers.data ?? [],
      prejob: prejob.data ?? [],
      trim_items: trimItems.data ?? [],
    },
  })
}

export async function PUT(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }
  const { orgId } = session

  const params = await Promise.resolve(context.params)
  const id = (params as { id?: Unsafe } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  const estimateRes = await getEstimate(orgId, id)
  if ('error' in estimateRes) {
    const status = estimateRes.error === 'Estimate not found' ? 404 : 500
    return NextResponse.json({ error: estimateRes.error }, { status })
  }
  const estimate = estimateRes.estimate

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 })

  try {
    if (body.jobsettings) {
      const row = body.jobsettings
      const upsert = await supabaseAdmin.from('estimate_jobsettings').upsert(
        {
          org_id: orgId,
          estimate_id: id,
          job_id: estimate.job_id,
          walls_paint_id: asText(row.walls_paint_id) || null,
          ceiling_paint_id: asText(row.ceiling_paint_id) || null,
          trim_paint_id: asText(row.trim_paint_id) || null,
          primer_id:
            asText(row.primer_id) ||
            asText(row.walls_primer_id) ||
            asText(row.ceiling_primer_id) ||
            asText(row.trim_primer_id) ||
            null,
          walls_primer_id: asText(row.walls_primer_id) || null,
          ceiling_primer_id: asText(row.ceiling_primer_id) || null,
          trim_primer_id: asText(row.trim_primer_id) || null,
          override_labor_rate: asNullableNumber(row.override_labor_rate),
          override_markup: asNullableNumber(row.override_markup),
          rounding_increment_hours: asNullableNumber(row.rounding_increment_hours),
          dayhours: asNullableNumber(row.dayhours),
          default_walls_prep_level: asText(row.default_walls_prep_level) || null,
          default_ceiling_prep_level: asText(row.default_ceiling_prep_level) || null,
          default_trim_prep_level: asText(row.default_trim_prep_level) || null,
          notes: asText(row.notes) || null,
          walls_paint_gal_override: asNullableNumber(row.walls_paint_gal_override),
          ceiling_paint_gal_override: asNullableNumber(row.ceiling_paint_gal_override),
          primer_gal_override: asNullableNumber(row.primer_gal_override),
          extra_supplies_walls: asNullableNumber(row.extra_supplies_walls),
          extra_supplies_ceilings: asNullableNumber(row.extra_supplies_ceilings),
          extra_supplies_trim: asNullableNumber(row.extra_supplies_trim),
          trim_paint_qty: asNullableNumber(row.trim_paint_qty),
          trim_paint_uom: asText(row.trim_paint_uom) || null,
          trim_primer_qty: asNullableNumber(row.trim_primer_qty),
          trim_primer_uom: asText(row.trim_primer_uom) || null,
        },
        { onConflict: 'org_id,estimate_id' }
      )
      if (upsert.error) throw new Error(upsert.error.message)
    }

    if (Array.isArray(body.rooms)) {
      const remove = await supabaseAdmin
        .from('estimate_rooms')
        .delete()
        .eq('org_id', orgId)
        .eq('estimate_id', id)
      if (remove.error) throw new Error(remove.error.message)

      const usedRoomIds = new Set<string>()
      const rows = body.rooms
        .map((row: Unsafe, idx: number) => {
          const wallsInclude = toYN(row.walls_include, 'N')
          const ceilingInclude = toYN(row.ceiling_include, 'N')
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
            walls_primer: asText(row.walls_primer) || null,
            walls_topcoats: wallsInclude === 'Y' ? asNullableNumber(row.walls_topcoats) : null,
            walls_prep_override: asText(row.walls_prep_override) || null,
            walls_prep_level:
              wallsInclude === 'Y'
                ? asText(row.walls_prep_level || row.walls_prep_override) || null
                : null,
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
            trim_primer: asText(row.trim_primer) || null,
            trim_topcoats: asNullableNumber(row.trim_topcoats),
            trim_prep_override: asText(row.trim_prep_override) || null,
            doors_prep_override: asText(row.doors_prep_override) || null,
            paint_base: baseboardTypeId ? 'Y' : 'N',
            paint_crown: paintCrown,
            paint_window_casing: windowCasingTypeId ? 'Y' : 'N',
            paint_door_casing: doorCasingTypeId ? 'Y' : 'N',
            paint_doors: doorTypeId ? 'Y' : 'N',
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
          }
        })
        .filter((row: { room_name: string }) => row.room_name)

      if (rows.length) {
        const insert = await supabaseAdmin.from('estimate_rooms').insert(rows)
        if (insert.error) throw new Error(insert.error.message)
      }
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
        .filter(
          (row: { scope: 'Wall' | 'Ceiling'; wall_color_id: string | null }) =>
            row.scope === 'Ceiling' || row.wall_color_id
        )
      await softReplaceRows({ table: 'estimate_rollers', orgId, estimateId: id, rows })
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
      console.log(
        '[estimates PUT] trim_items payload',
        JSON.stringify({
          estimateId: id,
          count: rows.length,
          roomIds: Array.from(new Set(rows.map((row) => row.room_id).filter(Boolean))),
          preview: rows.slice(0, 12).map((row) => ({
            room_id: row.room_id,
            trim_menu_id: row.trim_menu_id,
            qty: row.qty,
            sort_order: row.sort_order,
          })),
        })
      )
      await softReplaceRows({ table: 'estimate_trim_items', orgId, estimateId: id, rows })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed saving estimate inputs'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }
  const { orgId } = session

  const params = await Promise.resolve(context.params)
  const id = (params as { id?: Unsafe } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  const estimateRes = await getEstimate(orgId, id)
  if ('error' in estimateRes) {
    const status = estimateRes.error === 'Estimate not found' ? 404 : 500
    return NextResponse.json({ error: estimateRes.error }, { status })
  }

  const remove = await supabaseAdmin.from('estimates').delete().eq('org_id', orgId).eq('id', id)
  if (remove.error) {
    return NextResponse.json({ error: remove.error.message }, { status: 500 })
  }

  const workbookPath = asText(estimateRes.estimate.sheet_file_path)
  if (workbookPath) {
    const storageRemove = await supabaseAdmin.storage.from('estimate-workbooks').remove([workbookPath])
    if (storageRemove.error) {
      return NextResponse.json(
        {
          ok: true,
          warning: `Estimate deleted but workbook cleanup failed: ${storageRemove.error.message}`,
        },
        { status: 200 }
      )
    }
  }

  return NextResponse.json({ ok: true })
}

