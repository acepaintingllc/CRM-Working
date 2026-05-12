import { supabaseAdmin } from '@/lib/server/org'
import { loadAcceptedEstimateSource as loadCanonicalAcceptedEstimateSource } from '@/lib/server/accepted-estimates/service'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import type { AcceptedEstimateSource } from '@/lib/server/accepted-estimates/types'
import type {
  AcceptedEstimateOperationalCustomer,
  AcceptedEstimateOperationalJob,
  AcceptedEstimateOperationalNote,
  AcceptedEstimateOperationalProduct,
  AcceptedEstimateOperationalScopes,
  AcceptedEstimateOperationalSource,
} from '@/types/job-operations/acceptedEstimateSource'

type Unsafe = Record<string, unknown>

type DbMaybeSingleResponse = Promise<{
  data: Unsafe | null
  error: { message?: string } | null
}>

type DbReadFilterChain = {
  eq(column: string, value: unknown): DbReadFilterChain
  maybeSingle(): DbMaybeSingleResponse
}

type DbReadChain = {
  from(table: string): {
    select(columns: string): DbReadFilterChain
  }
}

type LoadAcceptedEstimateSource = typeof loadCanonicalAcceptedEstimateSource

type AcceptedEstimateOperationalSourceDeps = {
  db?: DbReadChain
  loadAcceptedEstimateSource?: LoadAcceptedEstimateSource
}

type JobRow = {
  id?: string | null
  title?: string | null
  status?: string | null
  customer_id?: string | null
  linked_estimate_id?: string | null
}

type CustomerRow = {
  id?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableText(value: unknown) {
  const text = asText(value)
  return text || null
}

function asRecord(value: unknown): Unsafe | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Unsafe)
    : null
}

function readRowId(row: Unsafe) {
  return asNullableText(row.id) ?? asNullableText(row.scope_id)
}

function readRoomId(row: Unsafe) {
  return asNullableText(row.room_id) ?? asNullableText(row.roomId)
}

function readNoteText(row: Unsafe) {
  return (
    asNullableText(row.notes) ??
    asNullableText(row.scope_notes) ??
    asNullableText(row.override_description)
  )
}

function buildFallbackCustomer(source: AcceptedEstimateSource): AcceptedEstimateOperationalCustomer {
  const snapshot = asRecord(source.snapshot_json)
  const document = asRecord(snapshot?.document)
  const snapshotCustomer = asRecord(document?.customer) ?? {}
  return {
    id: source.customer_id,
    name: asNullableText(snapshotCustomer.name),
    email: asNullableText(snapshotCustomer.email),
    phone: asNullableText(snapshotCustomer.phone),
    address: asNullableText(snapshotCustomer.address),
    street: asNullableText(snapshotCustomer.street),
    city: asNullableText(snapshotCustomer.city),
    state: asNullableText(snapshotCustomer.state),
    zip: asNullableText(snapshotCustomer.zip),
  }
}

async function loadJobRow(
  db: DbReadChain,
  orgId: string,
  jobId: string
): Promise<ServiceResult<JobRow | null>> {
  const result = await db
    .from('jobs')
    .select('id, title, status, customer_id, linked_estimate_id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load job')
  }
  return okResult((result.data as JobRow | null) ?? null)
}

async function loadCustomerRow(
  db: DbReadChain,
  orgId: string,
  customerId: string | null
): Promise<ServiceResult<CustomerRow | null>> {
  if (!customerId) return okResult(null)

  const result = await db
    .from('customers')
    .select('id, name, email, phone, address, street, city, state, zip')
    .eq('org_id', orgId)
    .eq('id', customerId)
    .maybeSingle()

  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load customer')
  }
  return okResult((result.data as CustomerRow | null) ?? null)
}

function buildJob(
  source: AcceptedEstimateSource,
  row: JobRow | null
): AcceptedEstimateOperationalJob {
  return {
    id: source.job_id,
    title: row?.title ?? null,
    status: row?.status ?? null,
    customer_id: row?.customer_id ?? source.customer_id,
    linked_estimate_id: row?.linked_estimate_id ?? source.estimate_id,
  }
}

function buildCustomer(
  source: AcceptedEstimateSource,
  row: CustomerRow | null
): AcceptedEstimateOperationalCustomer {
  const fallback = buildFallbackCustomer(source)
  return {
    id: row?.id ?? fallback.id,
    name: row?.name ?? fallback.name,
    email: row?.email ?? fallback.email,
    phone: row?.phone ?? fallback.phone,
    address: row?.address ?? fallback.address,
    street: row?.street ?? fallback.street,
    city: row?.city ?? fallback.city,
    state: row?.state ?? fallback.state,
    zip: row?.zip ?? fallback.zip,
  }
}

function readProductFromRow(params: {
  row: unknown
  scopeKind: AcceptedEstimateOperationalProduct['scope_kind']
  sourceField: string
  labelField: string
}) {
  const row = asRecord(params.row)
  if (!row) return null

  const id = asNullableText(row[params.sourceField])
  const label = asNullableText(row[params.labelField])
  if (!id && !label) return null

  return {
    id,
    label,
    source: params.sourceField,
    scope_kind: params.scopeKind,
    scope_id: readRowId(row),
    room_id: readRoomId(row),
  } satisfies AcceptedEstimateOperationalProduct
}

function buildProducts(scopes: AcceptedEstimateOperationalScopes) {
  const products: AcceptedEstimateOperationalProduct[] = []
  const productFields = [
    ['paint_product_id', 'paint_product_label'],
    ['primer_product_id', 'primer_product_label'],
    ['product_id', 'product_label'],
  ] as const

  for (const scopeKind of ['walls', 'ceilings', 'trim', 'doors'] as const) {
    for (const row of scopes[scopeKind]) {
      for (const [sourceField, labelField] of productFields) {
        const product = readProductFromRow({
          row,
          scopeKind,
          sourceField,
          labelField,
        })
        if (product) products.push(product)
      }
    }
  }

  return products
}

function buildNotes(
  source: AcceptedEstimateSource,
  scopes: AcceptedEstimateOperationalScopes
) {
  const notes: AcceptedEstimateOperationalNote[] = []

  for (const scopeKind of Object.keys(scopes) as Array<keyof AcceptedEstimateOperationalScopes>) {
    for (const entry of scopes[scopeKind]) {
      const row = asRecord(entry)
      if (!row) continue

      const text = readNoteText(row)
      if (!text) continue

      notes.push({
        source: 'accepted_estimate',
        scope_kind: scopeKind,
        scope_id: readRowId(row),
        room_id: readRoomId(row),
        text,
      })
    }
  }

  const snapshot = asRecord(source.snapshot_json)
  const document = asRecord(snapshot?.document)
  const intro = asNullableText(document?.intro_paragraph)
  if (intro) notes.unshift({ source: 'public_document_intro', text: intro })

  return notes
}

export function buildAcceptedEstimateOperationalSource(
  source: AcceptedEstimateSource,
  params: {
    job?: JobRow | null
    customer?: CustomerRow | null
  } = {}
): AcceptedEstimateOperationalSource {
  const operationalSource = source.operational_source
  const scopes: AcceptedEstimateOperationalScopes = {
    walls: jsonClone(operationalSource.room_wall_scopes),
    ceilings: jsonClone(operationalSource.room_ceiling_scopes),
    trim: jsonClone(operationalSource.room_trim_scopes),
    doors: jsonClone(operationalSource.room_door_scopes),
    drywall: jsonClone(operationalSource.drywall_repairs),
    accessFees: jsonClone(operationalSource.access_fees),
    prejob: jsonClone(operationalSource.prejob),
  }

  const pricingSummary = jsonClone(operationalSource.pricing_summary)

  return {
    job: buildJob(source, params.job ?? null),
    customer: buildCustomer(source, params.customer ?? null),
    acceptance: {
      accepted_at: source.accepted_at,
      accepted_by_legal_name: source.accepted_by_legal_name,
      signature_type: source.signature_type,
      user_agent: source.user_agent,
      ip: source.ip,
      public_version_id: source.accepted_public_version_id,
      public_version_number: source.public_version_number,
      public_token: source.public_token,
    },
    estimate: {
      id: source.estimate_id,
      version_name: source.version_name,
      version_state: source.version_state,
      estimate_snapshot_id: source.estimate_snapshot_id,
    },
    publicDocumentSnapshot: jsonClone(
      source.snapshot_json
    ) as AcceptedEstimateOperationalSource['publicDocumentSnapshot'],
    internalEstimateSnapshot: jsonClone(
      source.source_payload_json.internal_operational_estimate
    ),
    rooms: jsonClone(operationalSource.rooms),
    scopes,
    products: buildProducts(scopes),
    materials: {
      estimated_paint_gallons: source.estimated_paint_gallons,
      estimated_supplies_cost: source.estimated_supplies_cost,
      estimated_access_cost: source.estimated_access_cost,
      estimated_other_cost: source.estimated_other_cost,
      pricing_summary: pricingSummary,
      wall_calculations: jsonClone(operationalSource.wall_calculations),
      ceiling_calculations: jsonClone(operationalSource.ceiling_calculations),
      trim_calculations: jsonClone(operationalSource.trim_calculations),
      door_calculations: jsonClone(operationalSource.door_calculations),
      drywall_calculations: jsonClone(operationalSource.drywall_calculations),
    },
    totals: {
      accepted_total: source.final_total,
      final_total: operationalSource.final_total,
      pricing_summary: pricingSummary,
      estimated_labor_hours: source.estimated_labor_hours,
      estimated_paint_gallons: source.estimated_paint_gallons,
      estimated_supplies_cost: source.estimated_supplies_cost,
      estimated_access_cost: source.estimated_access_cost,
      estimated_other_cost: source.estimated_other_cost,
    },
    notes: buildNotes(source, scopes),
    source: {
      org_id: source.org_id,
      job_id: source.job_id,
      customer_id: source.customer_id,
      estimate_id: source.estimate_id,
      accepted_public_version_id: source.accepted_public_version_id,
      estimate_snapshot_id: source.estimate_snapshot_id,
    },
  }
}

export async function loadAcceptedEstimateOperationalSource(
  input: {
    orgId: string
    jobId: string
  },
  deps: AcceptedEstimateOperationalSourceDeps = {}
): Promise<ServiceResult<AcceptedEstimateOperationalSource>> {
  const db =
    deps.db ??
    (supabaseAdmin as unknown as DbReadChain)
  const loadAcceptedEstimateSource =
    deps.loadAcceptedEstimateSource ?? loadCanonicalAcceptedEstimateSource

  const source = await loadAcceptedEstimateSource(
    db as Parameters<typeof loadCanonicalAcceptedEstimateSource>[0],
    input.orgId,
    input.jobId
  )
  if (!source.ok) return source

  const job = await loadJobRow(db, input.orgId, source.data.job_id)
  if (!job.ok) return job

  const customerId = job.data?.customer_id ?? source.data.customer_id
  const customer = await loadCustomerRow(db, input.orgId, customerId)
  if (!customer.ok) return customer

  return okResult(
    buildAcceptedEstimateOperationalSource(source.data, {
      job: job.data,
      customer: customer.data,
    })
  )
}
