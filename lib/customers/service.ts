import { supabaseAdmin } from '@/lib/customers/api'
import { parseLegacyCustomerAddress } from '@/lib/customers/forms'
import {
  exposeServerErrorMessage,
  hasUniqueConstraintConflict,
} from '@/lib/server/dbErrors'
import { serverLog } from '@/lib/server/log'
import {
  buildCreateCustomerWritePayload,
  buildUpdateCustomerWritePayload,
  mapCustomerDetail,
  mapCustomerSummary,
  mapCustomerTimelineEvent,
  type NormalizedUpdateCustomerInput,
} from '@/lib/customers/normalizers'
import { buildEstimatePublicTimelineEvents } from '@/lib/customer-estimates/publicTimeline'
import type { EstimatePublicTimelineEvent } from '@/types/customer-estimates/publicTimeline'
import {
  customerError,
  customerOk,
  type CreateCustomerInput,
  type CustomerListPage,
  type CustomerListQuery,
  type CreateCustomerTimelineNoteInput,
  type CustomerServiceResult,
  type CustomerTimelineEvent,
} from '@/lib/customers/types'

type CustomerDb = typeof supabaseAdmin

type CustomerServiceDeps = {
  db?: CustomerDb
  isProduction?: boolean
}

type JobRow = {
  id: string
  title: string | null
  status: string | null
  created_at: string | null
  estimate_date: string | null
  scheduled_date: string | null
  completed_at: string | null
}

type JobScheduleRow = {
  job_id: string
  start_at: string | null
  end_at: string | null
}

type EstimateRow = {
  id: string
  job_id: string | null
}

type EstimatePublicVersionRow = {
  id: string
  estimate_id: string | null
  version_number: number | null
  public_token: string | null
  status?: string | null
  accepted_at?: string | null
  declined_at?: string | null
}

type EstimatePublicEventRow = {
  id: string
  estimate_public_version_id: string | null
  event_type: string | null
  actor_type: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  created_by: string | null
}

type CustomerIdentityRow = {
  id: string | null
  name: string | null
  email: string | null
  phone: string | null
}

const customerSummarySelect = 'id, name, email, phone, address'
const customerDetailSelect = 'id, name, email, phone, address, street, city, state, zip, notes, created_at'
const customerTimelineSelect = 'id, type, title, body, created_at, created_by'

function getDb(deps?: CustomerServiceDeps) {
  return deps?.db ?? supabaseAdmin
}

function logCustomerWarning(event: string, details: Record<string, unknown>) {
  serverLog.warn('[customers]', { event, ...details })
}

function logCustomerError(event: string, details: Record<string, unknown>) {
  serverLog.error('[customers]', { event, ...details })
}

function warnOnMalformedLegacyAddress(orgId: string, customer: ReturnType<typeof mapCustomerDetail>) {
  if (customer.street || customer.city || customer.state || customer.zip || !customer.address) return
  const parsed = parseLegacyCustomerAddress(customer.address)
  if (parsed.ok) return

  logCustomerWarning('customers.legacy_address_cleanup_required', {
    orgId,
    customerId: customer.id,
    legacyAddress: customer.address,
  })
}

function fmt(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function normalizeNameIdentity(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null
}

function normalizeEmailIdentity(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null
}

function normalizePhoneIdentity(value: string | null | undefined) {
  return value?.trim() || null
}

async function findCustomerIdentityConflict(
  db: CustomerDb,
  orgId: string,
  payload: { name: string | null; email: string | null; phone: string | null },
  excludeCustomerId?: string
) {
  const { data, error } = await db
    .from('customers')
    .select('id, name, email, phone')
    .eq('org_id', orgId)

  if (error) {
    logCustomerError('customers.identity_lookup_failed', { orgId, error: error.message })
    return customerError('server_error', error.message)
  }

  const normalizedName = normalizeNameIdentity(payload.name)
  const normalizedEmail = normalizeEmailIdentity(payload.email)
  const normalizedPhone = normalizePhoneIdentity(payload.phone)

  const conflict = ((data ?? []) as CustomerIdentityRow[]).find((row) => {
    if (!row.id || row.id === excludeCustomerId) return false

    const matchesName =
      normalizedName !== null && normalizeNameIdentity(row.name) === normalizedName
    const matchesEmail =
      normalizedEmail !== null && normalizeEmailIdentity(row.email) === normalizedEmail
    const matchesPhone =
      normalizedPhone !== null && normalizePhoneIdentity(row.phone) === normalizedPhone

    return matchesName || matchesEmail || matchesPhone
  })

  return customerOk(conflict ?? null)
}

function addJobEvent(
  out: CustomerTimelineEvent[],
  job: JobRow,
  type: string,
  createdAt: string | null | undefined,
  title: string,
  body: string,
  linkPath: string | null = null,
  linkLabel: string | null = null
) {
  if (!createdAt) return
  out.push({
    id: `job-${job.id}-${type}-${createdAt}`,
    type,
    title,
    body,
    created_at: createdAt,
    created_by: null,
    link_path: linkPath,
    link_label: linkLabel,
  })
}

async function ensureCustomerExists(db: CustomerDb, orgId: string, customerId: string) {
  const { data, error } = await db
    .from('customers')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', customerId)
    .maybeSingle()

  if (error) {
    logCustomerError('customers.exists_check_failed', { orgId, customerId, error: error.message })
    return customerError('server_error', error.message)
  }

  if (!data) {
    return customerError('not_found', 'Customer not found')
  }

  return customerOk(null)
}

async function loadPublicQuoteTimelineEventsForJobs(
  db: CustomerDb,
  orgId: string,
  jobs: JobRow[]
): Promise<CustomerServiceResult<CustomerTimelineEvent[]>> {
  const jobIds = jobs.map((job) => job.id).filter((id): id is string => Boolean(id))
  if (jobIds.length === 0) return customerOk([])

  const jobTitleById = new Map(
    jobs.map((job) => [job.id, job.title?.trim() || 'Job']).filter(([id]) => Boolean(id)) as Array<[string, string]>
  )

  const { data: estimateRows, error: estimateError } = await db
    .from('estimates')
    .select('id, job_id')
    .eq('org_id', orgId)
    .in('job_id', jobIds)

  if (estimateError) {
    logCustomerError('customers.timeline_estimates_failed', { orgId, jobIds, error: estimateError.message })
    return customerError('server_error', estimateError.message)
  }

  const estimates = (estimateRows ?? []) as EstimateRow[]
  const estimateIds = estimates.map((estimate) => estimate.id).filter(Boolean)
  if (estimateIds.length === 0) return customerOk([])

  const jobTitleByEstimateId = new Map<string, string>()
  for (const estimate of estimates) {
    if (estimate.id && estimate.job_id) {
      jobTitleByEstimateId.set(estimate.id, jobTitleById.get(estimate.job_id) ?? 'Job')
    }
  }

  const { data: publicVersionsData, error: publicVersionsError } = await db
    .from('estimate_public_versions')
    .select('id, estimate_id, version_number, public_token, status, accepted_at, declined_at')
    .eq('org_id', orgId)
    .in('estimate_id', estimateIds)

  if (publicVersionsError) {
    logCustomerError('customers.timeline_public_versions_failed', {
      orgId,
      jobIds,
      error: publicVersionsError.message,
    })
    return customerError('server_error', publicVersionsError.message)
  }

  const publicVersions = (publicVersionsData ?? []) as EstimatePublicVersionRow[]
  const publicVersionIds = publicVersions.map((version) => version.id).filter(Boolean)
  if (publicVersionIds.length === 0) return customerOk([])

  const { data: publicEventsData, error: publicEventsError } = await db
    .from('estimate_public_events')
    .select('id, estimate_public_version_id, event_type, actor_type, metadata, created_at, created_by')
    .eq('org_id', orgId)
    .in('estimate_public_version_id', publicVersionIds)

  if (publicEventsError) {
    logCustomerError('customers.timeline_public_events_failed', {
      orgId,
      jobIds,
      error: publicEventsError.message,
    })
    return customerError('server_error', publicEventsError.message)
  }

  const estimateIdByPublicVersionId = new Map(
    publicVersions.map((version) => [version.id, version.estimate_id ?? null])
  )

  return customerOk(
    buildEstimatePublicTimelineEvents({
      versions: publicVersions,
      publicEvents: (publicEventsData ?? []) as EstimatePublicEventRow[],
    }).map((event: EstimatePublicTimelineEvent) => {
      const rawVersionId = event.id.replace(/^quote-event-/, '')
      const eventRow = ((publicEventsData ?? []) as EstimatePublicEventRow[]).find((row) => row.id === rawVersionId)
      const estimateId =
        event.source_estimate_id ??
        estimateIdByPublicVersionId.get(event.source_public_version_id ?? eventRow?.estimate_public_version_id ?? '') ??
        null
      const jobTitle = estimateId ? jobTitleByEstimateId.get(estimateId) : null
      return {
        ...event,
        body: jobTitle ? `${jobTitle}\n${event.body}` : event.body,
      }
    })
  )
}

export async function listCustomers(
  orgId: string,
  query: CustomerListQuery = {},
  deps?: CustomerServiceDeps
): Promise<CustomerServiceResult<CustomerListPage>> {
  const db = getDb(deps)
  const pageSize = Math.max(1, Math.min(50, Math.trunc(query.pageSize ?? 50) || 50))
  const page = Math.max(1, Math.trunc(query.page ?? 1) || 1)
  const offset = (page - 1) * pageSize
  const search = query.search?.trim() ?? ''

  let customerQuery = db
    .from('customers')
    .select(customerSummarySelect, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (search) {
    const escaped = search.replace(/,/g, ' ').replace(/\./g, ' ')
    customerQuery = customerQuery.or(
      `name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`
    )
  }

  const { data, error, count } = await customerQuery

  if (error) {
    logCustomerError('customers.list_failed', { orgId, error: error.message })
    return customerError('server_error', error.message)
  }

  return customerOk({
    data: (data ?? []).map(mapCustomerSummary),
    total: count ?? 0,
    page,
    pageSize,
  })
}

export async function getCustomerDetail(
  orgId: string,
  customerId: string,
  deps?: CustomerServiceDeps
): Promise<CustomerServiceResult<ReturnType<typeof mapCustomerDetail>>> {
  const db = getDb(deps)
  const { data, error } = await db
    .from('customers')
    .select(customerDetailSelect)
    .eq('org_id', orgId)
    .eq('id', customerId)
    .maybeSingle()

  if (error) {
    logCustomerError('customers.detail_failed', { orgId, customerId, error: error.message })
    return customerError('server_error', error.message)
  }

  if (!data) {
    return customerError('not_found', 'Customer not found')
  }

  const customer = mapCustomerDetail(data)
  warnOnMalformedLegacyAddress(orgId, customer)
  return customerOk(customer)
}

export async function createCustomer(
  orgId: string,
  input: CreateCustomerInput,
  deps?: CustomerServiceDeps
): Promise<CustomerServiceResult<ReturnType<typeof mapCustomerDetail>>> {
  const db = getDb(deps)
  const payload = buildCreateCustomerWritePayload(input)
  const identityConflict = await findCustomerIdentityConflict(db, orgId, payload)
  if (!identityConflict.ok) return identityConflict
  if (identityConflict.data) {
    logCustomerWarning('customers.duplicate_blocked', {
      operation: 'create',
      orgId,
      duplicateCustomerId: identityConflict.data.id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
    })
    return customerError('conflict', 'A customer with the same name, email, or phone already exists.')
  }

  const { data, error } = await db
    .from('customers')
    .insert({ org_id: orgId, ...payload })
    .select(customerDetailSelect)
    .single()

  if (error) {
    if (hasUniqueConstraintConflict(error)) {
      logCustomerWarning('customers.duplicate_conflict', {
        operation: 'create',
        orgId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        error: error.message,
      })
      return customerError('conflict', 'A customer with the same name, email, or phone already exists.')
    }
    logCustomerError('customers.create_failed', { orgId, error: error.message })
    return customerError('server_error', error.message)
  }

  return customerOk(mapCustomerDetail(data))
}

export async function updateCustomer(
  orgId: string,
  customerId: string,
  input: NormalizedUpdateCustomerInput,
  deps?: CustomerServiceDeps
): Promise<CustomerServiceResult<ReturnType<typeof mapCustomerDetail>>> {
  const db = getDb(deps)
  const payload = buildUpdateCustomerWritePayload(input)
  const identityConflict = await findCustomerIdentityConflict(db, orgId, payload, customerId)
  if (!identityConflict.ok) return identityConflict
  if (identityConflict.data) {
    logCustomerWarning('customers.duplicate_blocked', {
      operation: 'update',
      orgId,
      customerId,
      duplicateCustomerId: identityConflict.data.id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
    })
    return customerError('conflict', 'A customer with the same name, email, or phone already exists.')
  }

  const { data, error } = await db
    .from('customers')
    .update(payload)
    .eq('org_id', orgId)
    .eq('id', customerId)
    .select(customerDetailSelect)
    .maybeSingle()

  if (error) {
    if (hasUniqueConstraintConflict(error)) {
      logCustomerWarning('customers.duplicate_conflict', {
        operation: 'update',
        orgId,
        customerId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        error: error.message,
      })
      return customerError('conflict', 'A customer with the same name, email, or phone already exists.')
    }
    logCustomerError('customers.update_failed', { orgId, customerId, error: error.message })
    return customerError('server_error', error.message)
  }

  if (!data) {
    return customerError('not_found', 'Customer not found')
  }

  const customer = mapCustomerDetail(data)
  warnOnMalformedLegacyAddress(orgId, customer)
  return customerOk(customer)
}

export async function deleteCustomer(
  orgId: string,
  customerId: string,
  deps?: CustomerServiceDeps
): Promise<CustomerServiceResult<null>> {
  const db = getDb(deps)
  const { data, error } = await db
    .from('customers')
    .delete()
    .eq('org_id', orgId)
    .eq('id', customerId)
    .select('id')
    .maybeSingle()

  if (error) {
    logCustomerError('customers.delete_failed', { orgId, customerId, error: error.message })
    return customerError(
      'server_error',
      exposeServerErrorMessage(
        error.message,
        deps?.isProduction ?? process.env.NODE_ENV === 'production',
        'Unable to delete customer'
      )
    )
  }

  if (!data) {
    return customerError('not_found', 'Customer not found')
  }

  return customerOk(null)
}

export async function listCustomerTimeline(
  orgId: string,
  customerId: string,
  deps?: CustomerServiceDeps
): Promise<CustomerServiceResult<CustomerTimelineEvent[]>> {
  const db = getDb(deps)
  const exists = await ensureCustomerExists(db, orgId, customerId)
  if (!exists.ok) return exists

  const { data, error } = await db
    .from('customer_timeline')
    .select(customerTimelineSelect)
    .eq('org_id', orgId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    logCustomerError('customers.timeline_notes_failed', { orgId, customerId, error: error.message })
    return customerError('server_error', error.message)
  }

  const { data: jobData, error: jobError } = await db
    .from('jobs')
    .select('id, title, status, created_at, estimate_date, scheduled_date, completed_at')
    .eq('org_id', orgId)
    .eq('customer_id', customerId)

  if (jobError) {
    logCustomerError('customers.timeline_jobs_failed', { orgId, customerId, error: jobError.message })
    return customerError('server_error', jobError.message)
  }

  const jobIds = ((jobData ?? []) as JobRow[]).map((job) => job.id)
  const scheduleByJob = new Map<string, { minStart: string | null; maxEnd: string | null }>()

  if (jobIds.length > 0) {
    const { data: scheduleRows, error: scheduleError } = await db
      .from('job_schedules')
      .select('job_id, start_at, end_at')
      .eq('org_id', orgId)
      .in('job_id', jobIds)

    if (scheduleError) {
      logCustomerError('customers.timeline_job_schedules_failed', {
        orgId,
        customerId,
        jobIds,
        error: scheduleError.message,
      })
      return customerError('server_error', scheduleError.message)
    }

    for (const row of (scheduleRows ?? []) as JobScheduleRow[]) {
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

  const quoteEventsResult = await loadPublicQuoteTimelineEventsForJobs(
    db,
    orgId,
    (jobData ?? []) as JobRow[]
  )
  if (!quoteEventsResult.ok) return quoteEventsResult

  const jobEvents: CustomerTimelineEvent[] = []
  for (const row of (jobData ?? []) as JobRow[]) {
    const jobLabel = row.title?.trim() || 'Job'
    const scheduleRange = scheduleByJob.get(row.id)
    const scheduledStart = scheduleRange?.minStart ?? row.scheduled_date
    const scheduledEnd = scheduleRange?.maxEnd ?? null

    addJobEvent(
      jobEvents,
      row,
      'job_created',
      row.created_at,
      'Job created',
      `${jobLabel}\nStatus: ${(row.status ?? 'unknown').replaceAll('_', ' ')}`,
      `/crm/jobs/${row.id}`,
      'Open job'
    )
    addJobEvent(
      jobEvents,
      row,
      'estimate_scheduled',
      row.estimate_date,
      'Quote scheduled',
      `${jobLabel}\nQuote date: ${fmt(row.estimate_date) ?? row.estimate_date ?? ''}`,
      `/api/jobs/${row.id}/estimate-file?redirect=1`,
      'View estimate'
    )
    addJobEvent(
      jobEvents,
      row,
      'job_scheduled',
      scheduledStart,
      'Job scheduled',
      `${jobLabel}\nScheduled: ${fmt(scheduledStart) ?? scheduledStart ?? ''}${
        scheduledEnd ? ` - ${fmt(scheduledEnd) ?? scheduledEnd}` : ''
      }`,
      `/crm/jobs/${row.id}`,
      'Open job'
    )
    addJobEvent(
      jobEvents,
      row,
      'job_completed',
      row.completed_at,
      'Job completed',
      `${jobLabel}\nCompleted: ${fmt(row.completed_at) ?? row.completed_at ?? ''}`,
      `/crm/jobs/${row.id}`,
      'Open job'
    )
  }

  const noteEvents = (data ?? []).map((row) =>
    mapCustomerTimelineEvent({ ...row, link_path: null, link_label: null })
  )

  return customerOk(
    [...noteEvents, ...jobEvents, ...quoteEventsResult.data].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? '')
    )
  )
}

export async function createCustomerTimelineNote(
  orgId: string,
  userId: string,
  customerId: string,
  input: CreateCustomerTimelineNoteInput,
  deps?: CustomerServiceDeps
): Promise<CustomerServiceResult<CustomerTimelineEvent>> {
  const db = getDb(deps)
  const exists = await ensureCustomerExists(db, orgId, customerId)
  if (!exists.ok) return exists

  const { data, error } = await db
    .from('customer_timeline')
    .insert({
      org_id: orgId,
      customer_id: customerId,
      created_by: userId,
      type: input.type,
      title: input.title,
      body: input.body,
    })
    .select(customerTimelineSelect)
    .single()

  if (error) {
    logCustomerError('customers.timeline_note_create_failed', {
      orgId,
      customerId,
      userId,
      error: error.message,
    })
    return customerError('server_error', error.message)
  }

  return customerOk(mapCustomerTimelineEvent({ ...data, link_path: null, link_label: null }))
}
