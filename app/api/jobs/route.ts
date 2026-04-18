import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/org'
import { assertSchema, isMissingSchemaErrorMessage } from '@/lib/server/schema'
import {
  buildJobSelect,
  getAvailableOptionalJobColumns,
  withOptionalJobColumns,
} from '@/lib/server/jobSchema'
import { jsonError, readJsonBody, requireSessionUserOrg } from '@/lib/server/apiRoute'

type JobRow = {
  id?: string | null
  customer_id?: string | null
  title?: string | null
  description?: string | null
  status?: string | null
  estimate_date?: string | null
  estimate_sent_at?: string | null
  scheduled_date?: string | null
  scheduled_end_date?: string | null
  completed_at?: string | null
  scheduled_email_sent_at?: string | null
  completed_email_sent_at?: string | null
  closeout_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

type CustomerRow = {
  id: string
  name?: string | null
  address?: string | null
}

type JobScheduleRow = {
  job_id: string
  start_at: string | null
  end_at: string | null
}

type JobSitePhotoRow = {
  job_id: string
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

export async function GET() {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response
  const { orgId } = auth.session

  const optionalJobColumns = await getAvailableOptionalJobColumns()
  const jobSelect = buildJobSelect(
    ['id', 'customer_id', 'title', 'description', 'status', 'estimate_date', 'estimate_sent_at', 'scheduled_date', 'scheduled_end_date', 'completed_at', 'closeout_notes', 'created_at', 'updated_at'],
    optionalJobColumns
  )

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    return jsonError('Unable to load jobs.', 500)
  }

  const rows = (data ?? []) as unknown as JobRow[]
  const jobIds = rows
    .map((r) => asString(r.id))
    .filter((v): v is string => Boolean(v))
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)))

  const customerById = new Map<string, { name: string | null; address: string | null }>()
  if (customerIds.length) {
    const { data: customers, error: cErr } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('org_id', orgId)
      .in('id', customerIds)

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    for (const c of (customers ?? []) as CustomerRow[]) {
      customerById.set(c.id, { name: c.name ?? null, address: c.address ?? null })
    }
  }

  const scheduleByJob = new Map<string, { minStart: string | null; maxEnd: string | null }>()
  if (jobIds.length) {
    const { data: schedules, error: schedErr } = await supabaseAdmin
      .from('job_schedules')
      .select('job_id, start_at, end_at')
      .eq('org_id', orgId)
      .in('job_id', jobIds)

    if (schedErr) {
      if (!isMissingSchemaErrorMessage(schedErr.message)) {
        return NextResponse.json({ error: schedErr.message }, { status: 500 })
      }
    } else {
      for (const row of (schedules ?? []) as JobScheduleRow[]) {
        const current = scheduleByJob.get(row.job_id) ?? { minStart: null, maxEnd: null }
        if (row.start_at && (!current.minStart || row.start_at < current.minStart)) {
          current.minStart = row.start_at
        }
        if (row.end_at && (!current.maxEnd || row.end_at > current.maxEnd)) {
          current.maxEnd = row.end_at
        }
        scheduleByJob.set(row.job_id, current)
      }
    }
  }

  const sitePhotoCountByJob = new Map<string, number>()
  if (jobIds.length) {
    const { data: sitePhotoRows, error: sitePhotoErr } = await supabaseAdmin
      .from('job_site_photos')
      .select('job_id')
      .eq('org_id', orgId)
      .in('job_id', jobIds)

    if (sitePhotoErr) {
      if (!isMissingSchemaErrorMessage(sitePhotoErr.message)) {
        return NextResponse.json({ error: sitePhotoErr.message }, { status: 500 })
      }
    } else {
      for (const row of (sitePhotoRows ?? []) as JobSitePhotoRow[]) {
        const current = sitePhotoCountByJob.get(row.job_id) ?? 0
        sitePhotoCountByJob.set(row.job_id, current + 1)
      }
    }
  }

  const jobs = rows.map((row) => {
    const safeRow = withOptionalJobColumns(row, optionalJobColumns) ?? row
    const customer = row.customer_id ? customerById.get(row.customer_id) : undefined
    const id = asString(row.id)
    const scheduleRange = id ? scheduleByJob.get(id) : undefined
    const rowScheduledDate = asString(row.scheduled_date)
    const rowScheduledEndDate = asString(row.scheduled_end_date)
    const scheduledDate = rowScheduledDate ?? scheduleRange?.minStart ?? null
    const scheduledEndDate = rowScheduledEndDate ?? scheduleRange?.maxEnd ?? null
    const sitePhotoCount = id ? sitePhotoCountByJob.get(id) ?? 0 : 0
    return {
      ...safeRow,
      title: safeRow.title ?? 'Untitled job',
      status: safeRow.status ?? 'estimate_scheduled',
      customer_name: customer?.name ?? null,
      customer_address: customer?.address ?? null,
      scheduled_date: scheduledDate,
      scheduled_end_date: scheduledEndDate,
      site_photo_count: sitePhotoCount,
      has_site_photos: sitePhotoCount > 0,
    }
  })

  return NextResponse.json({ jobs })
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionUserOrg()
    if (!auth.ok) return auth.response
    const { orgId } = auth.session

    const schema = await assertSchema([
      {
        table: 'jobs',
        columns: [
          'org_id',
          'customer_id',
          'title',
          'description',
          'status',
          'estimate_date',
          'estimate_sent_at',
          'scheduled_date',
          'scheduled_end_date',
          'completed_at',
        ],
      },
    ])
    if (!schema.ok) {
      const message = isMissingSchemaErrorMessage(schema.error)
        ? `Missing required schema for ${schema.table}. Run latest SQL migrations.`
        : schema.error
      return jsonError(message, 500)
    }

    const optionalJobColumns = await getAvailableOptionalJobColumns()
    const jobSelect = buildJobSelect(
      [
        'id',
        'customer_id',
        'title',
        'description',
        'status',
        'estimate_date',
        'estimate_sent_at',
        'scheduled_date',
        'scheduled_end_date',
        'completed_at',
        'closeout_notes',
        'created_at',
        'updated_at',
      ],
      optionalJobColumns
    )

    const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 128 * 1024 })
    if (!parsed.ok) return parsed.response
    const body = parsed.value

    const customerId = asString(body.customer_id)
    const title = asString(body.title)
    if (!customerId || !title) {
      return jsonError('Missing customer_id or title', 400)
    }

    const status = asString(body.status) || 'estimate_scheduled'

    const insertPayload: Record<string, unknown> = {
      org_id: orgId,
      customer_id: customerId,
      title,
      description: body.description ? String(body.description) : null,
      status,
    }

    for (const key of [
      'estimate_date',
      'estimate_sent_at',
      'scheduled_date',
      'completed_at',
    ]) {
      if (body[key] !== undefined && body[key] !== null) {
        insertPayload[key] = body[key]
      }
    }

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .insert(insertPayload)
      .select(jobSelect)
      .single()
    if (error) {
      return jsonError('Unable to create job.', 500)
    }

    return NextResponse.json({
      ok: true,
      job: withOptionalJobColumns(
        (data ?? null) as unknown as JobRow | null,
        optionalJobColumns
      ),
    })
  } catch {
    return jsonError('Unable to create job.', 500)
  }
}
