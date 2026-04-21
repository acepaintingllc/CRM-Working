import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/org'
import { assertSchema, isMissingSchemaErrorMessage } from '@/lib/server/schema'
import {
  buildJobSelect,
  filterOptionalJobColumnPayload,
  getAvailableOptionalJobColumns,
  withOptionalJobColumns,
} from '@/lib/server/jobSchema'
import {
  jsonError,
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { deriveJobScheduleRange } from '@/lib/server/jobScheduleSync'
import { resolveImpliedJobStatusFromPatch } from '@/lib/jobs/types'

type JobPatch = {
  completed_at?: string | null
  scheduled_date?: string | null
  estimate_sent_at?: string | null
  estimate_date?: string | null
}

type JobRecord = {
  id: string
  status: string
  scheduled_date?: string | null
  scheduled_end_date?: string | null
  customer_id?: string | null
  [key: string]: unknown
}

type ScheduleRecord = { start_at: string | null; end_at: string | null }
type CustomerRecord = { name: string | null; address: string | null; email?: string | null; phone?: string | null }
type LinkedEstimateRecord = {
  id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  updated_at: string | null
  created_at: string | null
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response
  const { orgId } = auth.session

  const params = await resolveParams(context)
  const idParam = readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
  if (!idParam.ok) return idParam.response
  const id = idParam.value

  const schema = await assertSchema([
    {
      table: 'jobs',
      columns: [
        'id',
        'org_id',
        'status',
        'title',
        'description',
        'estimate_date',
        'estimate_sent_at',
        'scheduled_date',
        'scheduled_end_date',
        'completed_at',
        'closeout_notes',
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

  const allowed: Record<string, unknown> = {}
  for (const key of [
    'title',
    'description',
    'status',
    'estimate_date',
    'estimate_sent_at',
    'scheduled_date',
    'scheduled_end_date',
    'completed_at',
    'closeout_notes',
  ]) {
    if (key in body) allowed[key] = body[key]
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('jobs')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (existingErr) return jsonError(existingErr.message, 500)
  if (!existing) return jsonError('Job not found', 404)

  // Auto-move if dates/flags are set, unless caller explicitly sets status.
  if (!('status' in allowed)) {
    allowed.status = resolveImpliedJobStatusFromPatch(allowed as JobPatch) ?? existing.status
  }

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .update(filterOptionalJobColumnPayload(allowed, optionalJobColumns))
    .eq('org_id', orgId)
    .eq('id', id)
    .select(jobSelect)
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({
    ok: true,
    job: withOptionalJobColumns(
      (data ?? null) as unknown as Record<string, unknown> | null,
      optionalJobColumns
    ),
  })
}

export async function GET(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response
  const { orgId } = auth.session

  const params = await resolveParams(context)
  const idParam = readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
  if (!idParam.ok) return idParam.response
  const id = idParam.value

  const optionalJobColumns = await getAvailableOptionalJobColumns()
  const jobSelect = buildJobSelect(
    [
      'id',
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
      'closeout_notes',
      'created_at',
      'updated_at',
    ],
    optionalJobColumns
  )

  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!job) return jsonError('Job not found', 404)

  const mutableJob = withOptionalJobColumns(
    (job ?? null) as unknown as Record<string, unknown> | null,
    optionalJobColumns
  ) as JobRecord
  if (!mutableJob.scheduled_date || !mutableJob.scheduled_end_date) {
    const { data: schedules } = await supabaseAdmin
      .from('job_schedules')
      .select('start_at, end_at')
      .eq('org_id', orgId)
      .eq('job_id', id)
      .order('start_at', { ascending: true })

    if (schedules && schedules.length > 0) {
      const range = deriveJobScheduleRange(schedules as ScheduleRecord[])
      mutableJob.scheduled_date = range.scheduled_date
      mutableJob.scheduled_end_date = range.scheduled_end_date
    }
  }

  let customer: { name: string | null; address: string | null; email?: string | null; phone?: string | null } | null = null
  if (mutableJob.customer_id) {
    const { data: customerRow } = await supabaseAdmin
      .from('customers')
      .select('id, name, address, email, phone')
      .eq('org_id', orgId)
      .eq('id', mutableJob.customer_id)
      .maybeSingle()
    if (customerRow) {
      customer = {
        name: (customerRow as CustomerRecord).name ?? null,
        address: (customerRow as CustomerRecord).address ?? null,
        email: (customerRow as CustomerRecord).email ?? null,
        phone: (customerRow as CustomerRecord).phone ?? null,
      }
    }
  }

  const { data: linkedEstimateRows, error: linkedEstimatesErr } = await supabaseAdmin
    .from('estimates')
    .select(
      'id, status, version_name, version_state, version_kind, version_sort_order, updated_at, created_at'
    )
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('version_sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (linkedEstimatesErr) {
    return jsonError(linkedEstimatesErr.message, 500)
  }

  const linkedEstimates = (linkedEstimateRows ?? []) as LinkedEstimateRecord[]

  return NextResponse.json({
    job: {
      ...mutableJob,
      customer_name: customer?.name ?? null,
      customer_address: customer?.address ?? null,
      customer_email: customer?.email ?? null,
      customer_phone: customer?.phone ?? null,
      linked_estimates: linkedEstimates,
      linked_estimate_id: linkedEstimates[0]?.id ?? null,
    },
  })
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response
  const { orgId } = auth.session

  const params = await resolveParams(context)
  const idParam = readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
  if (!idParam.ok) return idParam.response
  const id = idParam.value

  const { error } = await supabaseAdmin
    .from('jobs')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}
