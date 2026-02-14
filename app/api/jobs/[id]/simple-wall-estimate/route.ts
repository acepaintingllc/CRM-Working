import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_ROOMS = 10
const prepLevels = new Set(['low', 'med', 'high'])

function normalizePrep(value: Unsafe) {
  const key = String(value ?? '').trim().toLowerCase()
  if (key === 'light') return 'low'
  if (key === 'medium') return 'med'
  if (key === 'heavy') return 'high'
  return key
}
const colorGroups = new Set(['A', 'B', 'C', 'D'])

function normalizeYesNo(value: Unsafe, fallback: boolean) {
  if (typeof value === 'boolean') return value
  const key = String(value ?? '').trim().toLowerCase()
  if (!key) return fallback
  if (key === 'yes' || key === 'true' || key === '1') return true
  if (key === 'no' || key === 'false' || key === '0') return false
  return fallback
}

function parsePositiveNumber(value: Unsafe, fallback?: number | null) {
  if (value === null || value === undefined || value === '') return fallback ?? null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function parseNonNegativeNumber(value: Unsafe, fallback?: number | null) {
  if (value === null || value === undefined || value === '') return fallback ?? null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

async function assertJobExists(orgId: string, jobId: string) {
  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (error) return { error: error.message } as const
  if (!job) return { error: 'Job not found' } as const
  return { ok: true } as const
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
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const exists = await assertJobExists(orgId, id)
  if ('error' in exists) {
    const status = exists.error === 'Job not found' ? 404 : 500
    return NextResponse.json({ error: exists.error }, { status })
  }

  const { data: defaults, error: defaultsErr } = await supabaseAdmin
    .from('job_simple_wall_estimates')
    .select(
      'wall_paint_product, wall_roller_nap, default_coats, default_prep, default_extra_setup_minutes, default_extra_supplies_note, default_extra_supplies_allowance, sheet_file_id, sheet_web_view_link, sheet_edit_url'
    )
    .eq('org_id', orgId)
    .eq('job_id', id)
    .maybeSingle()

  if (defaultsErr) return NextResponse.json({ error: defaultsErr.message }, { status: 500 })

  const { data: rooms, error: roomsErr } = await supabaseAdmin
    .from('job_simple_wall_rooms')
    .select(
      'id, position, room_name, length_ft, width_ft, height_ft, color_group, coats_override, prep_override, extra_setup_minutes, extra_supplies_note, extra_supplies_allowance'
    )
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('position', { ascending: true })

  if (roomsErr) return NextResponse.json({ error: roomsErr.message }, { status: 500 })

  const { data: groupRows, error: groupsErr } = await supabaseAdmin
    .from('job_simple_wall_color_groups')
    .select('color_group, roller_nap, extra_setup_minutes, extra_supplies_allowance')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('color_group', { ascending: true })

  if (groupsErr) return NextResponse.json({ error: groupsErr.message }, { status: 500 })

  const { data: sharedRooms, error: sharedRoomsErr } = await supabaseAdmin
    .from('job_simple_rooms')
    .select('id, position, room_name, length_ft, width_ft, height_ft, include_walls, include_ceilings, include_trim')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('position', { ascending: true })

  if (sharedRoomsErr) return NextResponse.json({ error: sharedRoomsErr.message }, { status: 500 })

  const { data: ceilingDefaults, error: ceilingDefaultsErr } = await supabaseAdmin
    .from('job_simple_ceiling_estimates')
    .select('ceiling_paint_product, roller_cover_size, crown_present, ceilings_only, default_prep')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .maybeSingle()

  if (ceilingDefaultsErr) return NextResponse.json({ error: ceilingDefaultsErr.message }, { status: 500 })

  const { data: ceilingRooms, error: ceilingRoomsErr } = await supabaseAdmin
    .from('job_simple_ceiling_rooms')
    .select('id, position, room_name, ceiling_type, obstructions, length_ft, width_ft, height_ft, coats, prep_override')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('position', { ascending: true })

  if (ceilingRoomsErr) return NextResponse.json({ error: ceilingRoomsErr.message }, { status: 500 })

  const { data: trimDefaults, error: trimDefaultsErr } = await supabaseAdmin
    .from('job_simple_trim_estimates')
    .select('default_prep')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .maybeSingle()

  if (trimDefaultsErr) return NextResponse.json({ error: trimDefaultsErr.message }, { status: 500 })

  const { data: trimItems, error: trimItemsErr } = await supabaseAdmin
    .from('job_simple_trim_items')
    .select('id, position, item_activity, quantity, coats, prep_override')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('position', { ascending: true })

  if (trimItemsErr) return NextResponse.json({ error: trimItemsErr.message }, { status: 500 })

  const { data: trimPaints, error: trimPaintsErr } = await supabaseAdmin
    .from('job_simple_trim_paints')
    .select('id, position, paint_product, gallons_input')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('position', { ascending: true })

  if (trimPaintsErr) return NextResponse.json({ error: trimPaintsErr.message }, { status: 500 })

  return NextResponse.json({
    estimate: {
      defaults: {
        wall_paint_product: (defaults as Unsafe)?.wall_paint_product ?? '',
        wall_roller_nap: (defaults as Unsafe)?.wall_roller_nap ?? '',
        default_coats: Number((defaults as Unsafe)?.default_coats ?? 2),
        default_prep: String((defaults as Unsafe)?.default_prep ?? 'med'),
        default_extra_setup_minutes:
          (defaults as Unsafe)?.default_extra_setup_minutes == null
            ? null
            : Number((defaults as Unsafe).default_extra_setup_minutes),
        default_extra_supplies_note: (defaults as Unsafe)?.default_extra_supplies_note ?? '',
        default_extra_supplies_allowance:
          (defaults as Unsafe)?.default_extra_supplies_allowance == null
            ? null
            : Number((defaults as Unsafe).default_extra_supplies_allowance),
      },
      rooms:
        (rooms ?? []).map((room: Unsafe) => ({
          id: room.id,
          room_name: room.room_name,
          length_ft: Number(room.length_ft),
          width_ft: Number(room.width_ft),
          height_ft: Number(room.height_ft),
          color_group: room.color_group,
          coats_override:
            room.coats_override == null ? null : Number(room.coats_override),
          prep_override: room.prep_override ?? null,
          extra_setup_minutes:
            room.extra_setup_minutes == null ? null : Number(room.extra_setup_minutes),
          extra_supplies_note: room.extra_supplies_note ?? '',
          extra_supplies_allowance:
            room.extra_supplies_allowance == null
              ? null
              : Number(room.extra_supplies_allowance),
        })) ?? [],
      color_groups:
        (groupRows ?? []).map((group: Unsafe) => ({
          color_group: group.color_group,
          roller_nap: group.roller_nap ?? '',
          extra_setup_minutes:
            group.extra_setup_minutes == null ? null : Number(group.extra_setup_minutes),
          extra_supplies_allowance:
            group.extra_supplies_allowance == null ? null : Number(group.extra_supplies_allowance),
        })) ?? [],
      shared_rooms:
        (sharedRooms ?? []).map((room: Unsafe) => ({
          id: room.id,
          room_name: room.room_name,
          length_ft: Number(room.length_ft),
          width_ft: Number(room.width_ft),
          height_ft: Number(room.height_ft),
          include_walls: Boolean(room.include_walls ?? true),
          include_ceilings: Boolean(room.include_ceilings ?? false),
          include_trim: Boolean(room.include_trim ?? false),
        })) ?? [],
      ceilings: {
        defaults: ceilingDefaults
          ? {
              ceiling_paint_product: (ceilingDefaults as Unsafe)?.ceiling_paint_product ?? '',
              roller_cover_size: (ceilingDefaults as Unsafe)?.roller_cover_size ?? '',
              crown_present: Boolean((ceilingDefaults as Unsafe)?.crown_present ?? false),
              ceilings_only: Boolean((ceilingDefaults as Unsafe)?.ceilings_only ?? false),
              default_prep: String((ceilingDefaults as Unsafe)?.default_prep ?? 'med'),
            }
          : null,
        rooms:
          (ceilingRooms ?? []).map((room: Unsafe) => ({
            id: room.id,
            room_name: room.room_name,
            ceiling_type: room.ceiling_type ?? null,
            obstructions: room.obstructions ?? null,
            length_ft: Number(room.length_ft),
            width_ft: Number(room.width_ft),
            height_ft: Number(room.height_ft),
            coats: Number(room.coats),
            prep_override: room.prep_override ?? null,
          })) ?? [],
      },
      trim: {
        defaults: trimDefaults ? { default_prep: String((trimDefaults as Unsafe)?.default_prep ?? 'med') } : null,
        items:
          (trimItems ?? []).map((row: Unsafe) => ({
            id: row.id,
            item_activity: row.item_activity,
            quantity: Number(row.quantity),
            coats: Number(row.coats),
            prep_override: row.prep_override ?? null,
          })) ?? [],
        paints:
          (trimPaints ?? []).map((row: Unsafe) => ({
            id: row.id,
            paint_product: row.paint_product,
            gallons_input: Number(row.gallons_input),
          })) ?? [],
      },
    },
    sheet: (defaults as Unsafe)?.sheet_file_id
      ? {
          id: (defaults as Unsafe).sheet_file_id as string,
          webViewLink: (defaults as Unsafe).sheet_web_view_link ?? null,
          editUrl: (defaults as Unsafe).sheet_edit_url ?? null,
        }
      : null,
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
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const exists = await assertJobExists(orgId, id)
  if ('error' in exists) {
    const status = exists.error === 'Job not found' ? 404 : 500
    return NextResponse.json({ error: exists.error }, { status })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 })

  const rawDefaults = body.defaults ?? {}
  const rawRooms = Array.isArray(body.rooms) ? body.rooms : null
  const rawColorGroups = Array.isArray(body.color_groups) ? body.color_groups : []
  const rawSharedRooms = Array.isArray(body.shared_rooms) ? body.shared_rooms : null
  const rawCeilings = body.ceilings ?? null
  const rawTrim = body.trim ?? null
  if (!rawRooms && !rawSharedRooms) return NextResponse.json({ error: 'Rooms are required' }, { status: 400 })
  const sourceRooms = rawSharedRooms ?? rawRooms ?? []
  if (sourceRooms.length < 1) {
    return NextResponse.json({ error: 'At least one room is required' }, { status: 400 })
  }
  if (sourceRooms.length > MAX_ROOMS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ROOMS} rooms allowed for simple estimate` },
      { status: 400 }
    )
  }

  const defaultCoats = parsePositiveNumber(rawDefaults.default_coats, 2) ?? 2

  const defaultPrep = normalizePrep(rawDefaults.default_prep ?? 'med')
  if (!prepLevels.has(defaultPrep)) {
    return NextResponse.json({ error: 'Default prep must be Light, Medium, or Heavy' }, { status: 400 })
  }

  const defaultExtraSetup = parseNonNegativeNumber(rawDefaults.default_extra_setup_minutes, null)
  if (rawDefaults.default_extra_setup_minutes != null && defaultExtraSetup == null) {
    return NextResponse.json(
      { error: 'Default extra setup minutes must be 0 or greater' },
      { status: 400 }
    )
  }

  const defaultExtraSuppliesAllowance = parseNonNegativeNumber(
    rawDefaults.default_extra_supplies_allowance,
    null
  )
  if (
    rawDefaults.default_extra_supplies_allowance != null &&
    defaultExtraSuppliesAllowance == null
  ) {
    return NextResponse.json(
      { error: 'Default extra supplies allowance must be 0 or greater' },
      { status: 400 }
    )
  }

  const sharedRooms = sourceRooms.map((row: Unsafe, idx: number) => {
    const roomName = String(row?.room_name ?? '').trim()
    if (!roomName) return { error: `Room ${idx + 1}: room name is required` } as const

    const lengthFt = parsePositiveNumber(row?.length_ft)
    if (lengthFt == null) return { error: `Room ${idx + 1}: length must be greater than 0` } as const

    const widthFt = parsePositiveNumber(row?.width_ft)
    if (widthFt == null) return { error: `Room ${idx + 1}: width must be greater than 0` } as const

    const heightFt = parsePositiveNumber(row?.height_ft)
    if (heightFt == null) return { error: `Room ${idx + 1}: height must be greater than 0` } as const

    const includeWalls =
      rawSharedRooms == null
        ? true
        : normalizeYesNo(row?.include_walls, true)
    const includeCeilings =
      rawSharedRooms == null
        ? false
        : normalizeYesNo(row?.include_ceilings, false)
    const includeTrim =
      rawSharedRooms == null
        ? false
        : normalizeYesNo(row?.include_trim, false)

    return {
      position: idx,
      room_name: roomName,
      length_ft: lengthFt,
      width_ft: widthFt,
      height_ft: heightFt,
      include_walls: includeWalls,
      include_ceilings: includeCeilings,
      include_trim: includeTrim,
    } as const
  })

  const invalidShared = sharedRooms.find((row: { error?: string }) => 'error' in row)
  if (invalidShared && 'error' in invalidShared) {
    return NextResponse.json({ error: invalidShared.error }, { status: 400 })
  }

  const normalizedSharedRooms = sharedRooms as {
    position: number
    room_name: string
    length_ft: number
    width_ft: number
    height_ft: number
    include_walls: boolean
    include_ceilings: boolean
    include_trim: boolean
  }[]

  const wallDetailMap = new Map<string, Unsafe>()
  for (const row of rawRooms ?? []) {
    const roomName = String(row?.room_name ?? '').trim()
    if (!roomName) continue
    wallDetailMap.set(roomName.toLowerCase(), row)
  }

  const rooms = normalizedSharedRooms
    .filter((row) => row.include_walls)
    .map((row, idx) => {
      const detail: Unsafe = wallDetailMap.get(row.room_name.toLowerCase()) ?? {}
      const colorGroup = String(detail?.color_group ?? 'A').toUpperCase()
    if (!colorGroups.has(colorGroup)) {
      return { error: `Room ${idx + 1}: color group must be A, B, C, or D` } as const
    }

    const coatsValue = detail?.coats_override ?? detail?.coats ?? 2
    const coatsOverride = parsePositiveNumber(coatsValue, null)
    if (coatsOverride == null) {
      return { error: `Room ${idx + 1}: coats must be greater than 0` } as const
    }

    const prepOverrideRaw = detail?.prep_override
    const prepOverride =
      prepOverrideRaw == null || prepOverrideRaw === ''
        ? null
        : normalizePrep(prepOverrideRaw)
    if (prepOverride && !prepLevels.has(prepOverride)) {
      return { error: `Room ${idx + 1}: prep override must be Light, Medium, or Heavy` } as const
    }

    return {
      position: idx,
      room_name: row.room_name,
      length_ft: row.length_ft,
      width_ft: row.width_ft,
      height_ft: row.height_ft,
      color_group: colorGroup,
      coats_override: coatsOverride,
      prep_override: prepOverride,
      extra_setup_minutes: null,
      extra_supplies_note: null,
      extra_supplies_allowance: null,
    } as const
  })

  const invalid = rooms.find((row: { error?: string }) => 'error' in row)
  if (invalid && 'error' in invalid) {
    return NextResponse.json({ error: invalid.error }, { status: 400 })
  }

  const normalizedRooms = rooms as {
    position: number
    room_name: string
    length_ft: number
    width_ft: number
    height_ft: number
    color_group: string
    coats_override: number | null
    prep_override: string | null
    extra_setup_minutes: number | null
    extra_supplies_note: string | null
    extra_supplies_allowance: number | null
  }[]

  const normalizedGroups = ['A', 'B', 'C', 'D'].map((color) => {
    const match = rawColorGroups.find(
      (row: Unsafe) => String(row?.color_group ?? '').toUpperCase() === color
    )
    const rollerNap = String(match?.roller_nap ?? '').trim()
    const extraSetup = parseNonNegativeNumber(match?.extra_setup_minutes, null)
    if (match?.extra_setup_minutes != null && extraSetup == null) {
      return {
        error: `Color ${color}: extra setup minutes must be 0 or greater`,
      } as const
    }
    const extraSupplies = parseNonNegativeNumber(match?.extra_supplies_allowance, null)
    if (match?.extra_supplies_allowance != null && extraSupplies == null) {
      return {
        error: `Color ${color}: extra supplies allowance must be 0 or greater`,
      } as const
    }
    return {
      color_group: color,
      roller_nap: rollerNap || null,
      extra_setup_minutes: extraSetup,
      extra_supplies_allowance: extraSupplies,
    } as const
  })

  const invalidGroup = normalizedGroups.find((row: { error?: string }) => 'error' in row)
  if (invalidGroup && 'error' in invalidGroup) {
    return NextResponse.json({ error: invalidGroup.error }, { status: 400 })
  }

  // Ceilings (optional)
  let ceilingDefaultsPatch: {
    ceiling_paint_product: string | null
    roller_cover_size: string | null
    crown_present: boolean
    ceilings_only: boolean
    default_prep: string
  } | null = null

  let ceilingRoomsPatch: {
    position: number
    room_name: string
    ceiling_type: string | null
    obstructions: string | null
    length_ft: number
    width_ft: number
    height_ft: number
    coats: number
    prep_override: string | null
  }[] = []

  if (rawCeilings) {
    const cd = rawCeilings?.defaults ?? {}
    const ceilingPrep = normalizePrep(cd?.default_prep ?? 'med')
    if (!prepLevels.has(ceilingPrep)) {
      return NextResponse.json(
        { error: 'Ceiling default prep must be Light, Medium, or Heavy' },
        { status: 400 }
      )
    }

    ceilingDefaultsPatch = {
      ceiling_paint_product: String(cd?.ceiling_paint_product ?? '').trim() || null,
      roller_cover_size: String(cd?.roller_cover_size ?? '').trim() || null,
      crown_present: normalizeYesNo(cd?.crown_present, false),
      ceilings_only: normalizeYesNo(cd?.ceilings_only, false),
      default_prep: ceilingPrep,
    }

    const rawCeilingRooms = Array.isArray(rawCeilings?.rooms) ? rawCeilings.rooms : []
    if (rawCeilingRooms.length > MAX_ROOMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ROOMS} ceiling rooms allowed for simple estimate` },
        { status: 400 }
      )
    }

    const ceilingDetailMap = new Map<string, Unsafe>()
    for (const row of rawCeilingRooms) {
      const roomName = String(row?.room_name ?? '').trim()
      if (!roomName) continue
      ceilingDetailMap.set(roomName.toLowerCase(), row)
    }

    const parsedCeilingRooms = normalizedSharedRooms
      .filter((row) => row.include_ceilings)
      .map((row, idx) => {
        const detail: Unsafe = ceilingDetailMap.get(row.room_name.toLowerCase()) ?? {}
        const coats = parsePositiveNumber(detail?.coats, null)
        if (coats == null) {
          return { error: `Ceiling room ${idx + 1}: coats must be greater than 0` } as const
        }

        const prepOverrideRaw = detail?.prep_override
        const prepOverride =
          prepOverrideRaw == null || prepOverrideRaw === ''
            ? null
            : normalizePrep(prepOverrideRaw)
        if (prepOverride && !prepLevels.has(prepOverride)) {
          return {
            error: `Ceiling room ${idx + 1}: prep override must be Light, Medium, or Heavy`,
          } as const
        }

        const ceilingType = String(detail?.ceiling_type ?? '').trim()
        const obstructions = String(detail?.obstructions ?? '').trim()

        return {
          position: idx,
          room_name: row.room_name,
          ceiling_type: !ceilingType || ceilingType.toLowerCase() === 'n/a' ? null : ceilingType,
          obstructions: !obstructions || obstructions.toLowerCase() === 'n/a' ? null : obstructions,
          length_ft: row.length_ft,
          width_ft: row.width_ft,
          height_ft: row.height_ft,
          coats,
          prep_override: prepOverride,
        } as const
      })

    const badCeilingRoom = parsedCeilingRooms.find((row: Unsafe) => 'error' in row)
    if (badCeilingRoom && 'error' in (badCeilingRoom as Unsafe)) {
      return NextResponse.json({ error: (badCeilingRoom as Unsafe).error }, { status: 400 })
    }

    ceilingRoomsPatch = parsedCeilingRooms as Unsafe
  }

  // Trim (optional)
  let trimDefaultsPatch: { default_prep: string } | null = null
  let trimItemsPatch: {
    position: number
    item_activity: string
    quantity: number
    coats: number
    prep_override: string | null
  }[] = []
  let trimPaintsPatch: {
    position: number
    paint_product: string
    gallons_input: number
  }[] = []

  if (rawTrim) {
    const td = rawTrim?.defaults ?? {}
    const trimPrep = normalizePrep(td?.default_prep ?? 'med')
    if (!prepLevels.has(trimPrep)) {
      return NextResponse.json(
        { error: 'Trim default prep must be Light, Medium, or Heavy' },
        { status: 400 }
      )
    }

    trimDefaultsPatch = { default_prep: trimPrep }

    const rawItems = Array.isArray(rawTrim?.items) ? rawTrim.items : []
    const parsedItems = rawItems
      .filter((row: Unsafe) => {
        const item = String(row?.item_activity ?? '').trim()
        return item && item.toLowerCase() !== 'n/a'
      })
      .map((row: Unsafe, idx: number) => {
        const item = String(row?.item_activity ?? '').trim()
        if (!item) return { error: `Trim item ${idx + 1}: item/activity is required` } as const

        const quantity = parsePositiveNumber(row?.quantity, null)
        if (quantity == null) {
          return { error: `Trim item ${idx + 1}: quantity must be greater than 0` } as const
        }

        const coats = parsePositiveNumber(row?.coats, null)
        if (coats == null) {
          return { error: `Trim item ${idx + 1}: coats must be greater than 0` } as const
        }

        const prepOverrideRaw = row?.prep_override
        const prepOverride =
          prepOverrideRaw == null || prepOverrideRaw === ''
            ? null
            : normalizePrep(prepOverrideRaw)
        if (prepOverride && !prepLevels.has(prepOverride)) {
          return { error: `Trim item ${idx + 1}: prep override must be Light, Medium, or Heavy` } as const
        }

        return {
          position: idx,
          item_activity: item,
          quantity,
          coats,
          prep_override: prepOverride,
        } as const
      })

    const badTrim = parsedItems.find((row: Unsafe) => 'error' in row)
    if (badTrim && 'error' in (badTrim as Unsafe)) {
      return NextResponse.json({ error: (badTrim as Unsafe).error }, { status: 400 })
    }

    trimItemsPatch = parsedItems as Unsafe

    const rawPaints = Array.isArray(rawTrim?.paints) ? rawTrim.paints : []
    const parsedPaints = rawPaints
      .filter((row: Unsafe) => String(row?.paint_product ?? '').trim())
      .map((row: Unsafe, idx: number) => {
        const paint = String(row?.paint_product ?? '').trim()
        if (!paint || paint.toLowerCase() === 'n/a') {
          return { error: `Trim paint row ${idx + 1}: paint is required` } as const
        }
        const gallons = parsePositiveNumber(row?.gallons_input, null)
        if (gallons == null) {
          return { error: `Trim paint row ${idx + 1}: gallons must be greater than 0` } as const
        }
        return {
          position: idx,
          paint_product: paint,
          gallons_input: gallons,
        } as const
      })

    const badTrimPaint = parsedPaints.find((row: Unsafe) => 'error' in row)
    if (badTrimPaint && 'error' in (badTrimPaint as Unsafe)) {
      return NextResponse.json({ error: (badTrimPaint as Unsafe).error }, { status: 400 })
    }
    trimPaintsPatch = parsedPaints as Unsafe
  }

  const { error: defaultsErr } = await supabaseAdmin
    .from('job_simple_wall_estimates')
    .upsert(
      {
        org_id: orgId,
        job_id: id,
        wall_paint_product: String(rawDefaults.wall_paint_product ?? '').trim() || null,
        wall_roller_nap: String(rawDefaults.wall_roller_nap ?? '').trim() || null,
        default_coats: defaultCoats,
        default_prep: defaultPrep,
        default_extra_setup_minutes: defaultExtraSetup,
        default_extra_supplies_note:
          String(rawDefaults.default_extra_supplies_note ?? '').trim() || null,
        default_extra_supplies_allowance: defaultExtraSuppliesAllowance,
      },
      { onConflict: 'org_id,job_id' }
    )

  if (defaultsErr) return NextResponse.json({ error: defaultsErr.message }, { status: 500 })

  const { error: deleteSharedRoomsErr } = await supabaseAdmin
    .from('job_simple_rooms')
    .delete()
    .eq('org_id', orgId)
    .eq('job_id', id)

  if (deleteSharedRoomsErr) return NextResponse.json({ error: deleteSharedRoomsErr.message }, { status: 500 })

  const sharedRoomInserts = normalizedSharedRooms.map((row) => ({
    org_id: orgId,
    job_id: id,
    ...row,
  }))

  if (sharedRoomInserts.length) {
    const { error: insertSharedRoomsErr } = await supabaseAdmin
      .from('job_simple_rooms')
      .insert(sharedRoomInserts)

    if (insertSharedRoomsErr) {
      return NextResponse.json({ error: insertSharedRoomsErr.message }, { status: 500 })
    }
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('job_simple_wall_rooms')
    .delete()
    .eq('org_id', orgId)
    .eq('job_id', id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  const roomInserts = normalizedRooms.map((row) => ({
    org_id: orgId,
    job_id: id,
    ...row,
  }))
  if (roomInserts.length) {
    const { error: insertErr } = await supabaseAdmin
      .from('job_simple_wall_rooms')
      .insert(roomInserts)

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const { error: deleteGroupsErr } = await supabaseAdmin
    .from('job_simple_wall_color_groups')
    .delete()
    .eq('org_id', orgId)
    .eq('job_id', id)

  if (deleteGroupsErr) return NextResponse.json({ error: deleteGroupsErr.message }, { status: 500 })

  const groupInserts = (normalizedGroups as {
    color_group: string
    roller_nap: string | null
    extra_setup_minutes: number | null
    extra_supplies_allowance: number | null
  }[]).map((row) => ({
    org_id: orgId,
    job_id: id,
    ...row,
  }))

  if (groupInserts.length) {
    const { error: groupInsertErr } = await supabaseAdmin
      .from('job_simple_wall_color_groups')
      .insert(groupInserts)

    if (groupInsertErr) return NextResponse.json({ error: groupInsertErr.message }, { status: 500 })
  }

  if (ceilingDefaultsPatch) {
    const { error: ceilingDefaultsUpsertErr } = await supabaseAdmin
      .from('job_simple_ceiling_estimates')
      .upsert(
        { org_id: orgId, job_id: id, ...ceilingDefaultsPatch },
        { onConflict: 'org_id,job_id' }
      )

    if (ceilingDefaultsUpsertErr) {
      return NextResponse.json({ error: ceilingDefaultsUpsertErr.message }, { status: 500 })
    }

    const { error: deleteCeilingRoomsErr } = await supabaseAdmin
      .from('job_simple_ceiling_rooms')
      .delete()
      .eq('org_id', orgId)
      .eq('job_id', id)

    if (deleteCeilingRoomsErr) {
      return NextResponse.json({ error: deleteCeilingRoomsErr.message }, { status: 500 })
    }

    if (ceilingRoomsPatch.length) {
      const { error: insertCeilingRoomsErr } = await supabaseAdmin
        .from('job_simple_ceiling_rooms')
        .insert(ceilingRoomsPatch.map((row) => ({ org_id: orgId, job_id: id, ...row })))

      if (insertCeilingRoomsErr) {
        return NextResponse.json({ error: insertCeilingRoomsErr.message }, { status: 500 })
      }
    }
  }

  if (trimDefaultsPatch) {
    const { error: trimDefaultsUpsertErr } = await supabaseAdmin
      .from('job_simple_trim_estimates')
      .upsert({ org_id: orgId, job_id: id, ...trimDefaultsPatch }, { onConflict: 'org_id,job_id' })

    if (trimDefaultsUpsertErr) {
      return NextResponse.json({ error: trimDefaultsUpsertErr.message }, { status: 500 })
    }

    const { error: deleteTrimItemsErr } = await supabaseAdmin
      .from('job_simple_trim_items')
      .delete()
      .eq('org_id', orgId)
      .eq('job_id', id)

    if (deleteTrimItemsErr) {
      return NextResponse.json({ error: deleteTrimItemsErr.message }, { status: 500 })
    }

    if (trimItemsPatch.length) {
      const { error: insertTrimItemsErr } = await supabaseAdmin
        .from('job_simple_trim_items')
        .insert(trimItemsPatch.map((row) => ({ org_id: orgId, job_id: id, ...row })))

      if (insertTrimItemsErr) {
        return NextResponse.json({ error: insertTrimItemsErr.message }, { status: 500 })
      }
    }

    const { error: deleteTrimPaintsErr } = await supabaseAdmin
      .from('job_simple_trim_paints')
      .delete()
      .eq('org_id', orgId)
      .eq('job_id', id)

    if (deleteTrimPaintsErr) {
      return NextResponse.json({ error: deleteTrimPaintsErr.message }, { status: 500 })
    }

    if (trimPaintsPatch.length) {
      const { error: insertTrimPaintsErr } = await supabaseAdmin
        .from('job_simple_trim_paints')
        .insert(trimPaintsPatch.map((row) => ({ org_id: orgId, job_id: id, ...row })))

      if (insertTrimPaintsErr) {
        return NextResponse.json({ error: insertTrimPaintsErr.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
