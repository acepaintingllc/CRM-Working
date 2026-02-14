import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { copyDriveFile } from '@/lib/server/googleDrive'
import { writeNamedRanges } from '@/lib/server/googleSheets'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const REQUIRED_NAMED_RANGES = [
  'customer_name',
  'customer_address',
] as const

const OPTIONAL_NAMED_RANGES = [
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
] as const

type JobRow = {
  id: string
  status: string
  title: string
  description: string | null
  estimate_date: string | null
  customer_id: string | null
}

type CustomerRow = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
}

function sanitizeDriveName(value: string) {
  return (
    value
      // Windows/Drive-unfriendly characters
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function streetOnly(address: string | null | undefined) {
  if (!address) return ''
  const first = address.split(',')[0] ?? ''
  return first.trim()
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
  const required = REQUIRED_NAMED_RANGES.join(', ')
  const optional = OPTIONAL_NAMED_RANGES.join(', ')
  return range
    ? `Missing named range '${range}' in the estimate template. Required: ${required}. Optional: ${optional}.`
    : `Missing one or more named ranges in the estimate template. Required: ${required}. Optional: ${optional}.`
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

  const folderId =
    process.env.GOOGLE_DRIVE_ESTIMATE_SHEETS_FOLDER_ID ??
    process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID ??
    null
  if (!folderId) {
    return NextResponse.json(
      {
        error:
          'Missing env var: GOOGLE_DRIVE_ESTIMATE_SHEETS_FOLDER_ID (or GOOGLE_DRIVE_ESTIMATES_FOLDER_ID as fallback)',
      },
      { status: 500 }
    )
  }

  const { data: jobData, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select('id, status, title, description, estimate_date, customer_id')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })
  const job = (jobData as Unsafe as JobRow | null) ?? null
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  if (job.status !== 'estimate_scheduled') {
    return NextResponse.json(
      { error: `Job must be in 'estimate_scheduled' status to create an estimate sheet.` },
      { status: 400 }
    )
  }

  const { data: customerData, error: customerErr } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, phone, address, street, city, state, zip')
    .eq('org_id', orgId)
    .eq('id', job.customer_id)
    .maybeSingle()

  if (customerErr) return NextResponse.json({ error: customerErr.message }, { status: 500 })
  const customer = (customerData as Unsafe as CustomerRow | null) ?? null
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const base = sanitizeDriveName(customer.name ?? job.title ?? 'Estimate')
  const fileName = sanitizeDriveName(`Estimate Sheet - ${base || 'Estimate'} - ${today}`).slice(
    0,
    120
  )

  const copied = await copyDriveFile({
    origin,
    orgId,
    userId,
    templateFileId: templateId,
    folderId,
    name: fileName,
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
          ? 'Reconnect Google to grant Drive + Sheets permissions, then try again.'
          : copied.error,
      },
      { status: 400 }
    )
  }

  const estimateDate = job.estimate_date
    ? new Date(job.estimate_date).toLocaleString()
    : ''

  const requiredUpdates = [
    { range: 'customer_name', value: String(customer.name ?? '') },
    {
      range: 'customer_address',
      value: String(customer.street ?? streetOnly(customer.address) ?? ''),
    },
  ]

  const wroteRequired = await writeNamedRanges({
    origin,
    orgId,
    userId,
    spreadsheetId: copied.file.id,
    updates: requiredUpdates,
  })

  if ('error' in wroteRequired) {
    const status =
      typeof (wroteRequired as { status?: Unsafe }).status === 'number'
        ? (wroteRequired as { status: number }).status
        : undefined
    const msg = String(wroteRequired.error ?? '')
    if (needsReconnect(msg, status)) {
      return NextResponse.json(
        { error: 'Reconnect Google to grant Drive + Sheets permissions, then try again.' },
        { status: 400 }
      )
    }
    if (msg.toLowerCase().includes('unable to parse range')) {
      return NextResponse.json({ error: missingNamedRangeMessage(msg) }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const optionalPairs: { range: string; value: string }[] = [
    { range: 'customer_email', value: String(customer.email ?? '') },
    { range: 'customer_phone', value: String(customer.phone ?? '') },
    { range: 'job_title', value: String(job.title ?? '') },
    { range: 'job_description', value: String(job.description ?? '') },
    { range: 'estimate_date', value: String(estimateDate) },
    { range: 'job_id', value: String(job.id ?? id) },
    { range: 'customer_street', value: String(customer.street ?? '') },
    { range: 'customer_city', value: String(customer.city ?? '') },
    { range: 'customer_state', value: String(customer.state ?? '') },
    { range: 'customer_zip', value: String(customer.zip ?? '') },
  ]

  for (const u of optionalPairs) {
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
        // Optional named ranges may not exist in some templates; ignore.
        continue
      }
      if (needsReconnect(msg, status)) {
        return NextResponse.json(
          { error: 'Reconnect Google to grant Drive + Sheets permissions, then try again.' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 400 })
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
  })
}
