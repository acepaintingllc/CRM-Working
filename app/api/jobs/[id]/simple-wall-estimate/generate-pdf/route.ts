import { NextResponse } from 'next/server'
import { copyDriveFile, getStreetFromAddress, listEstimatePdfFiles, parseEstimateVersionFromName } from '@/lib/server/googleDrive'
import { readNamedRangeValues, writeNamedRanges, writeRangeValues } from '@/lib/server/googleSheets'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { runEstimatePdfScript } from '@/lib/server/googleAppsScript'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_ROOMS = 10
const MAX_TRIM_ITEMS = 10
const MAX_TRIM_PAINTS = 8
const SUMMARY_RANGES = [
  'wall_total_sqft',
  'wall_total_supply_cost',
  'wall_total_paint_gal',
  'wall_total_paint_cost',
  'estimate_total',
] as const

function sanitizeDriveName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function streetOnly(address: string | null | undefined) {
  if (!address) return ''
  return (address.split(',')[0] ?? '').trim()
}

function prettyPrep(value: string | null | undefined) {
  const v = String(value ?? '').toLowerCase()
  if (!v) return ''
  if (v === 'low' || v === 'light') return 'Light'
  if (v === 'med' || v === 'medium') return 'Medium'
  if (v === 'high' || v === 'heavy') return 'Heavy'
  return v.charAt(0).toUpperCase() + v.slice(1)
}

function needsReconnect(message: string, status?: number) {
  const msg = (message ?? '').toLowerCase()
  return (
    status === 401 ||
    msg.includes('insufficient authentication scopes') ||
    msg.includes('insufficient permissions') ||
    msg.includes('request had insufficient authentication scopes')
  )
}

function missingNamedRangeMessage(message: string) {
  const m = /unable to parse range:\s*([^\s]+)/i.exec(message ?? '')
  const range = m?.[1] ? String(m[1]) : null
  const required = [
    'customer_name',
    'customer_address',
    'wall_paint_product',
    'wall_roller_nap',
    'wall_default_prep',
    'wall_rooms',
  ].join(', ')
  const optional = [
    'customer_email',
    'customer_phone',
    'job_title',
    'job_description',
    'estimate_date',
    'job_id',
    'customer_street',
    'customer_city',
    'customer_state',
    'customer_zip',
    'wall_default_extra_setup_minutes',
    'wall_default_extra_supplies_note',
    'wall_default_extra_supplies_allowance',
    'wall_color_a_roller_nap',
    'wall_color_a_extra_setup_minutes',
    'wall_color_a_extra_supplies_allowance',
    'wall_color_b_roller_nap',
    'wall_color_b_extra_setup_minutes',
    'wall_color_b_extra_supplies_allowance',
    'wall_color_c_roller_nap',
    'wall_color_c_extra_setup_minutes',
    'wall_color_c_extra_supplies_allowance',
    'wall_color_d_roller_nap',
    'wall_color_d_extra_setup_minutes',
    'wall_color_d_extra_supplies_allowance',
    'wall_scope',
    'wall_room_names',
    'ceiling_paint_product',
    'ceiling_roller_cover_size',
    'ceiling_crown_present',
    'ceiling_ceilings_only',
    'ceiling_default_prep',
    'ceiling_rooms',
    'ceiling_scope',
    'ceiling_room_names',
    'trim_default_prep',
    'trim_items',
    'trim_paint_inputs',
    'trim_scope',
  ].join(', ')
  return range
    ? `Missing named range '${range}' in the estimate template. Required: ${required}. Optional: ${optional}.`
    : `Missing one or more named ranges in the estimate template. Required: ${required}. Optional: ${optional}.`
}

function firstCell(values: string[][]) {
  const row = Array.isArray(values) ? values[0] : undefined
  const cell = Array.isArray(row) ? row[0] : undefined
  return typeof cell === 'string' ? cell : ''
}

function parseCurrencyLikeNumber(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { origin } = new URL(request.url)
  const { orgId, userId } = session
  const params = await Promise.resolve(context.params)
  const id = (params as { id?: Unsafe } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const templateId = process.env.GOOGLE_SHEETS_ESTIMATE_TEMPLATE_ID
  if (!templateId) {
    return NextResponse.json(
      { error: 'Missing env var: GOOGLE_SHEETS_ESTIMATE_TEMPLATE_ID' },
      { status: 500 }
    )
  }

  const sheetFolderId =
    process.env.GOOGLE_DRIVE_ESTIMATE_SHEETS_FOLDER_ID ??
    process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID ??
    null
  if (!sheetFolderId) {
    return NextResponse.json(
      {
        error:
          'Missing env var: GOOGLE_DRIVE_ESTIMATE_SHEETS_FOLDER_ID (or GOOGLE_DRIVE_ESTIMATES_FOLDER_ID as fallback)',
      },
      { status: 500 }
    )
  }

  const estimatesFolderId = process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID
  if (!estimatesFolderId) {
    return NextResponse.json(
      { error: 'Missing env var: GOOGLE_DRIVE_ESTIMATES_FOLDER_ID' },
      { status: 500 }
    )
  }

  const scriptId = process.env.GOOGLE_APPS_SCRIPT_ESTIMATE_PDF_SCRIPT_ID
  if (!scriptId) {
    return NextResponse.json(
      { error: 'Missing env var: GOOGLE_APPS_SCRIPT_ESTIMATE_PDF_SCRIPT_ID' },
      { status: 500 }
    )
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select('id, status, title, description, estimate_date, customer_id')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if ((job as Unsafe).status !== 'estimate_scheduled') {
    return NextResponse.json(
      { error: `Job must be in 'estimate_scheduled' status to generate a simple estimate PDF.` },
      { status: 400 }
    )
  }

  const { data: customer, error: customerErr } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, phone, address, street, city, state, zip')
    .eq('org_id', orgId)
    .eq('id', (job as Unsafe).customer_id)
    .maybeSingle()

  if (customerErr) return NextResponse.json({ error: customerErr.message }, { status: 500 })
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const { data: defaults, error: defaultsErr } = await supabaseAdmin
    .from('job_simple_wall_estimates')
    .select(
      'wall_paint_product, wall_roller_nap, default_coats, default_prep, default_extra_setup_minutes, default_extra_supplies_note, default_extra_supplies_allowance'
    )
    .eq('org_id', orgId)
    .eq('job_id', id)
    .maybeSingle()

  if (defaultsErr) return NextResponse.json({ error: defaultsErr.message }, { status: 500 })
  if (!defaults) {
    return NextResponse.json(
      { error: 'Simple wall estimate defaults are missing. Save the form first.' },
      { status: 400 }
    )
  }

  const { data: rooms, error: roomsErr } = await supabaseAdmin
    .from('job_simple_wall_rooms')
    .select(
      'position, room_name, length_ft, width_ft, height_ft, color_group, coats_override, prep_override, extra_setup_minutes, extra_supplies_note, extra_supplies_allowance'
    )
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('position', { ascending: true })

  if (roomsErr) return NextResponse.json({ error: roomsErr.message }, { status: 500 })
  if (!rooms || rooms.length < 1) {
    return NextResponse.json({ error: 'Add at least one room before generating a PDF.' }, { status: 400 })
  }
  if (rooms.length > MAX_ROOMS) {
    return NextResponse.json(
      { error: `Simple estimate supports up to ${MAX_ROOMS} rooms.` },
      { status: 400 }
    )
  }

  const { data: colorGroups, error: colorErr } = await supabaseAdmin
    .from('job_simple_wall_color_groups')
    .select('color_group, roller_nap, extra_setup_minutes, extra_supplies_allowance')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('color_group', { ascending: true })

  if (colorErr) return NextResponse.json({ error: colorErr.message }, { status: 500 })

  const { data: ceilingDefaults, error: ceilingDefaultsErr } = await supabaseAdmin
    .from('job_simple_ceiling_estimates')
    .select('ceiling_paint_product, roller_cover_size, crown_present, ceilings_only, default_prep')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .maybeSingle()

  if (ceilingDefaultsErr) return NextResponse.json({ error: ceilingDefaultsErr.message }, { status: 500 })

  const { data: ceilingRooms, error: ceilingRoomsErr } = await supabaseAdmin
    .from('job_simple_ceiling_rooms')
    .select('position, room_name, ceiling_type, obstructions, length_ft, width_ft, height_ft, coats, prep_override')
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
    .select('position, item_activity, quantity, coats, prep_override')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('position', { ascending: true })

  if (trimItemsErr) return NextResponse.json({ error: trimItemsErr.message }, { status: 500 })

  const { data: trimPaints, error: trimPaintsErr } = await supabaseAdmin
    .from('job_simple_trim_paints')
    .select('position, paint_product, gallons_input')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('position', { ascending: true })

  if (trimPaintsErr) return NextResponse.json({ error: trimPaintsErr.message }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)
  const base = sanitizeDriveName((customer as Unsafe).name ?? (job as Unsafe).title ?? 'Estimate')
  const sheetFileName = sanitizeDriveName(
    `Estimate Sheet - ${base || 'Estimate'} - ${today}`
  ).slice(0, 120)

  const copied = await copyDriveFile({
    origin,
    orgId,
    userId,
    templateFileId: templateId,
    folderId: sheetFolderId,
    name: sheetFileName,
  })

  if ('error' in copied) {
    const status =
      typeof (copied as { status?: Unsafe }).status === 'number'
        ? (copied as { status: number }).status
        : undefined
    const reconnect = needsReconnect(String(copied.error ?? ''), status)
    return NextResponse.json(
      {
        error: reconnect
          ? 'Reconnect Google to grant Drive + Sheets + Apps Script permissions, then try again.'
          : copied.error,
      },
      { status: 400 }
    )
  }

  const estimateDate = (job as Unsafe).estimate_date
    ? new Date((job as Unsafe).estimate_date).toLocaleString()
    : ''
  const addressStreet = String((customer as Unsafe).street ?? streetOnly((customer as Unsafe).address) ?? '')
  const requiredUpdates = [
    { range: 'customer_name', value: String((customer as Unsafe).name ?? '') },
    { range: 'customer_address', value: addressStreet },
    { range: 'wall_paint_product', value: String((defaults as Unsafe).wall_paint_product ?? '') },
    { range: 'wall_roller_nap', value: String((defaults as Unsafe).wall_roller_nap ?? '') },
    { range: 'wall_default_prep', value: prettyPrep((defaults as Unsafe).default_prep) },
  ]

  const writeRequired = await writeNamedRanges({
    origin,
    orgId,
    userId,
    spreadsheetId: copied.file.id,
    updates: requiredUpdates,
  })
  if ('error' in writeRequired) {
    const status =
      typeof (writeRequired as { status?: Unsafe }).status === 'number'
        ? (writeRequired as { status: number }).status
        : undefined
    const msg = String(writeRequired.error ?? '')
    if (needsReconnect(msg, status)) {
      return NextResponse.json(
        { error: 'Reconnect Google to grant Drive + Sheets + Apps Script permissions, then try again.' },
        { status: 400 }
      )
    }
    if (msg.toLowerCase().includes('unable to parse range')) {
      return NextResponse.json({ error: missingNamedRangeMessage(msg) }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const defaultPrep = prettyPrep((defaults as Unsafe).default_prep ?? 'med')
  const wallRows = (rooms as Unsafe[]).map((room) => [
    String(room.room_name ?? ''),
    Number(room.length_ft ?? 0),
    Number(room.width_ft ?? 0),
    Number(room.height_ft ?? 0),
    Number(room.coats_override ?? 0),
    `Color ${String(room.color_group ?? 'A').toUpperCase()}`,
    prettyPrep(room.prep_override ?? defaultPrep),
  ])

  while (wallRows.length < MAX_ROOMS) {
    wallRows.push(['', '', '', '', '', '', ''])
  }

  const roomNames = Array.from(
    new Set(
      (rooms as Unsafe[])
        .map((room) => String(room.room_name ?? '').trim())
        .filter(Boolean)
    )
  ).join(', ')

  const writeRooms = await writeRangeValues({
    origin,
    orgId,
    userId,
    spreadsheetId: copied.file.id,
    updates: [{ range: 'wall_rooms', values: wallRows }],
  })
  if ('error' in writeRooms) {
    const status =
      typeof (writeRooms as { status?: Unsafe }).status === 'number'
        ? (writeRooms as { status: number }).status
        : undefined
    const msg = String(writeRooms.error ?? '')
    if (needsReconnect(msg, status)) {
      return NextResponse.json(
        { error: 'Reconnect Google to grant Drive + Sheets + Apps Script permissions, then try again.' },
        { status: 400 }
      )
    }
    if (msg.toLowerCase().includes('unable to parse range')) {
      return NextResponse.json({ error: missingNamedRangeMessage(msg) }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const yesNo = (value: Unsafe) => (value ? 'Yes' : 'No')

  const hasCeilings = Array.isArray(ceilingRooms) && ceilingRooms.length > 0
  const ceilingDefaultPrep = prettyPrep((ceilingDefaults as Unsafe)?.default_prep ?? 'med')
  const ceilingRows = (ceilingRooms as Unsafe[] | null | undefined)?.map((room) => [
    String(room.room_name ?? ''),
    String(room.ceiling_type ?? 'N/A') || 'N/A',
    String(room.obstructions ?? 'N/A') || 'N/A',
    Number(room.length_ft ?? 0),
    Number(room.width_ft ?? 0),
    Number(room.height_ft ?? 0),
    Number(room.coats ?? 0),
    prettyPrep(room.prep_override ?? ceilingDefaultPrep),
  ]) ?? []

  while (ceilingRows.length < MAX_ROOMS) {
    ceilingRows.push(['', '', '', '', '', '', '', ''])
  }

  const ceilingRoomNames = Array.from(
    new Set(
      ((ceilingRooms as Unsafe[]) ?? [])
        .map((room) => String(room.room_name ?? '').trim())
        .filter(Boolean)
    )
  ).join(', ')

  if (hasCeilings) {
    const writeCeilings = await writeRangeValues({
      origin,
      orgId,
      userId,
      spreadsheetId: copied.file.id,
      updates: [{ range: 'ceiling_rooms', values: ceilingRows }],
    })

    if ('error' in writeCeilings) {
      const status =
        typeof (writeCeilings as { status?: Unsafe }).status === 'number'
          ? (writeCeilings as { status: number }).status
          : undefined
      const msg = String(writeCeilings.error ?? '')
      if (needsReconnect(msg, status)) {
        return NextResponse.json(
          { error: 'Reconnect Google to grant Drive + Sheets + Apps Script permissions, then try again.' },
          { status: 400 }
        )
      }
      if (msg.toLowerCase().includes('unable to parse range')) {
        return NextResponse.json({ error: missingNamedRangeMessage(msg) }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  const trimDefaultPrep = prettyPrep((trimDefaults as Unsafe)?.default_prep ?? 'med')
  const activeTrimItems = ((trimItems as Unsafe[]) ?? []).filter((row) => {
    const item = String(row.item_activity ?? '').trim()
    return item && item.toLowerCase() !== 'n/a'
  })
  const hasTrim = activeTrimItems.length > 0
  const trimScope = Array.from(
    new Set(activeTrimItems.map((row) => String(row.item_activity ?? '').trim()).filter(Boolean))
  ).join(', ')

  const trimRows = activeTrimItems.map((row) => [
    String(row.item_activity ?? ''),
    Number(row.quantity ?? 0),
    Number(row.coats ?? 0),
    prettyPrep(row.prep_override ?? trimDefaultPrep),
  ])

  while (trimRows.length < MAX_TRIM_ITEMS) {
    trimRows.push(['', '', '', ''])
  }

  if (hasTrim) {
    const writeTrim = await writeRangeValues({
      origin,
      orgId,
      userId,
      spreadsheetId: copied.file.id,
      updates: [{ range: 'trim_items', values: trimRows }],
    })

    if ('error' in writeTrim) {
      const status =
        typeof (writeTrim as { status?: Unsafe }).status === 'number'
          ? (writeTrim as { status: number }).status
          : undefined
      const msg = String(writeTrim.error ?? '')
      if (needsReconnect(msg, status)) {
        return NextResponse.json(
          { error: 'Reconnect Google to grant Drive + Sheets + Apps Script permissions, then try again.' },
          { status: 400 }
        )
      }
      if (msg.toLowerCase().includes('unable to parse range')) {
        return NextResponse.json({ error: missingNamedRangeMessage(msg) }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  const activeTrimPaints = ((trimPaints as Unsafe[]) ?? []).filter((row) => {
    const paint = String(row.paint_product ?? '').trim()
    return paint && paint.toLowerCase() !== 'n/a'
  })
  const hasTrimPaints = activeTrimPaints.length > 0
  const trimPaintRows = activeTrimPaints.map((row) => [
    String(row.paint_product ?? ''),
    Number(row.gallons_input ?? 0),
  ])
  while (trimPaintRows.length < MAX_TRIM_PAINTS) {
    trimPaintRows.push(['', ''])
  }

  if (hasTrimPaints) {
    const writeTrimPaints = await writeRangeValues({
      origin,
      orgId,
      userId,
      spreadsheetId: copied.file.id,
      updates: [{ range: 'trim_paint_inputs', values: trimPaintRows }],
    })

    if ('error' in writeTrimPaints) {
      const status =
        typeof (writeTrimPaints as { status?: Unsafe }).status === 'number'
          ? (writeTrimPaints as { status: number }).status
          : undefined
      const msg = String(writeTrimPaints.error ?? '')
      if (needsReconnect(msg, status)) {
        return NextResponse.json(
          { error: 'Reconnect Google to grant Drive + Sheets + Apps Script permissions, then try again.' },
          { status: 400 }
        )
      }
      if (msg.toLowerCase().includes('unable to parse range')) {
        return NextResponse.json({ error: missingNamedRangeMessage(msg) }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  const groupMap = new Map<string, {
    roller_nap: string
    extra_setup_minutes: number | null
    extra_supplies_allowance: number | null
  }>()
  for (const row of colorGroups ?? []) {
    const key = String((row as Unsafe)?.color_group ?? '').toUpperCase()
    if (!key) continue
    groupMap.set(key, {
      roller_nap: String((row as Unsafe)?.roller_nap ?? ''),
      extra_setup_minutes:
        (row as Unsafe)?.extra_setup_minutes == null ? null : Number((row as Unsafe).extra_setup_minutes),
      extra_supplies_allowance:
        (row as Unsafe)?.extra_supplies_allowance == null
          ? null
          : Number((row as Unsafe).extra_supplies_allowance),
    })
  }
  const usedColors = new Set(
    (rooms as Unsafe[]).map((room) => String(room?.color_group ?? '').toUpperCase())
  )
  const colorRows = ['A', 'B', 'C', 'D'].map((color) => {
    const raw = groupMap.get(color) ?? {
      roller_nap: '',
      extra_setup_minutes: null,
      extra_supplies_allowance: null,
    }
    const isUsed = usedColors.has(color)
    const rollerNap = String(raw.roller_nap ?? '').trim()
    return {
      color,
      data: isUsed
        ? {
            roller_nap: rollerNap || 'N/A',
            extra_setup_minutes: raw.extra_setup_minutes,
            extra_supplies_allowance: raw.extra_supplies_allowance,
          }
        : {
            roller_nap: 'N/A',
            extra_setup_minutes: 0,
            extra_supplies_allowance: 0,
          },
    }
  })

  const optionalUpdates = [
    { range: 'customer_email', value: String((customer as Unsafe).email ?? '') },
    { range: 'customer_phone', value: String((customer as Unsafe).phone ?? '') },
    { range: 'job_title', value: String((job as Unsafe).title ?? '') },
    { range: 'job_description', value: String((job as Unsafe).description ?? '') },
    { range: 'estimate_date', value: String(estimateDate) },
    { range: 'job_id', value: String((job as Unsafe).id ?? id) },
    { range: 'customer_street', value: String((customer as Unsafe).street ?? '') },
    { range: 'customer_city', value: String((customer as Unsafe).city ?? '') },
    { range: 'customer_state', value: String((customer as Unsafe).state ?? '') },
    { range: 'customer_zip', value: String((customer as Unsafe).zip ?? '') },
    {
      range: 'wall_default_extra_setup_minutes',
      value: String((defaults as Unsafe).default_extra_setup_minutes ?? ''),
    },
    {
      range: 'wall_default_extra_supplies_note',
      value: String((defaults as Unsafe).default_extra_supplies_note ?? ''),
    },
    {
      range: 'wall_default_extra_supplies_allowance',
      value: String((defaults as Unsafe).default_extra_supplies_allowance ?? ''),
    },
    ...colorRows.flatMap((row) => [
      { range: `wall_color_${row.color.toLowerCase()}_roller_nap`, value: String(row.data.roller_nap ?? '') },
      {
        range: `wall_color_${row.color.toLowerCase()}_extra_setup_minutes`,
        value: String(row.data.extra_setup_minutes ?? ''),
      },
      {
        range: `wall_color_${row.color.toLowerCase()}_extra_supplies_allowance`,
        value: String(row.data.extra_supplies_allowance ?? ''),
      },
    ]),
    { range: 'wall_scope', value: roomNames },
    { range: 'wall_room_names', value: roomNames },
    { range: 'ceiling_paint_product', value: String((ceilingDefaults as Unsafe)?.ceiling_paint_product ?? '') },
    { range: 'ceiling_roller_cover_size', value: String((ceilingDefaults as Unsafe)?.roller_cover_size ?? 'N/A') || 'N/A' },
    { range: 'ceiling_crown_present', value: yesNo((ceilingDefaults as Unsafe)?.crown_present ?? false) },
    { range: 'ceiling_ceilings_only', value: yesNo((ceilingDefaults as Unsafe)?.ceilings_only ?? false) },
    { range: 'ceiling_default_prep', value: ceilingDefaultPrep },
    { range: 'ceiling_scope', value: ceilingRoomNames },
    { range: 'ceiling_room_names', value: ceilingRoomNames },
    { range: 'trim_default_prep', value: trimDefaultPrep },
    { range: 'trim_scope', value: trimScope },
  ]

  for (const u of optionalUpdates) {
    const res = await writeNamedRanges({
      origin,
      orgId,
      userId,
      spreadsheetId: copied.file.id,
      updates: [u],
    })
    if ('error' in res) {
      const status =
        typeof (res as { status?: Unsafe }).status === 'number'
          ? (res as { status: number }).status
          : undefined
      const msg = String(res.error ?? '')
      if (msg.toLowerCase().includes('unable to parse range')) {
        continue
      }
      if (needsReconnect(msg, status)) {
        return NextResponse.json(
          { error: 'Reconnect Google to grant Drive + Sheets + Apps Script permissions, then try again.' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  const streetForVersion =
    getStreetFromAddress(String((customer as Unsafe).street ?? '')) ||
    getStreetFromAddress((customer as Unsafe).address)
  if (!streetForVersion) {
    return NextResponse.json({ error: 'Customer street is required to version the PDF name.' }, { status: 400 })
  }

  const listed = await listEstimatePdfFiles({ origin, orgId, userId })
  if ('error' in listed) {
    return NextResponse.json({ error: listed.error }, { status: 400 })
  }

  let maxVersion = 0
  for (const file of listed.files) {
    const parsed = parseEstimateVersionFromName(file.name)
    if (!parsed) continue
    if (parsed.street !== streetForVersion) continue
    maxVersion = Math.max(maxVersion, parsed.version)
  }
  const nextVersion = maxVersion + 1
  const displayStreet = sanitizeDriveName(
    addressStreet || streetOnly((customer as Unsafe).address) || 'Unknown'
  )
  const pdfFileName = `Estimate-${displayStreet}-v${nextVersion}.pdf`

  const script = await runEstimatePdfScript({
    origin,
    orgId,
    userId,
    scriptId,
    spreadsheetId: copied.file.id,
    outputFolderId: estimatesFolderId,
    pdfFileName,
  })

  if ('error' in script) {
    return NextResponse.json({ error: script.error }, { status: 400 })
  }

  const summaryResults = await Promise.all(
    SUMMARY_RANGES.map(async (range) => {
      const res = await readNamedRangeValues({
        origin,
        orgId,
        userId,
        spreadsheetId: copied.file.id,
        range,
      })
      if ('error' in res) {
        const msg = String(res.error ?? '').toLowerCase()
        const missing = msg.includes('unable to parse range')
        return { range, value: '', missing }
      }
      return { range, value: firstCell(res.values), missing: false }
    })
  )

  const summary = {
    wall_total_sqft: '',
    wall_total_supply_cost: '',
    wall_total_paint_gal: '',
    wall_total_paint_cost: '',
    estimate_total: '',
    missingRanges: [] as string[],
  }

  for (const row of summaryResults) {
    if (row.range === 'wall_total_sqft') summary.wall_total_sqft = row.value
    if (row.range === 'wall_total_supply_cost') summary.wall_total_supply_cost = row.value
    if (row.range === 'wall_total_paint_gal') summary.wall_total_paint_gal = row.value
    if (row.range === 'wall_total_paint_cost') summary.wall_total_paint_cost = row.value
    if (row.range === 'estimate_total') summary.estimate_total = row.value
    if (row.missing) summary.missingRanges.push(row.range)
  }

  const estimateTotalAmount = parseCurrencyLikeNumber(summary.estimate_total)
  if (estimateTotalAmount != null) {
    const { error: updateJobErr } = await supabaseAdmin
      .from('jobs')
      .update({ estimate_total_amount: estimateTotalAmount })
      .eq('org_id', orgId)
      .eq('id', id)
    if (updateJobErr && !String(updateJobErr.message ?? '').includes('estimate_total_amount')) {
      return NextResponse.json({ error: updateJobErr.message }, { status: 500 })
    }
  }

  const editUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(copied.file.id)}/edit`
  return NextResponse.json({
    ok: true,
    sheet: {
      id: copied.file.id,
      name: copied.file.name,
      webViewLink: copied.file.webViewLink,
      editUrl,
    },
    pdf: script.pdf,
    summary,
  })
}
