import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type { AcceptedEstimateOperationalSource } from '@/types/job-operations/acceptedEstimateSource'
import type {
  JobInvoiceChangeOrderDelta,
  JobInvoiceDocument,
  JobInvoiceGenerateInput,
  JobInvoiceMoneyInput,
  JobInvoicePatchInput,
  JobInvoiceReadModel,
  JobInvoiceRow,
  JobInvoiceSourceSummary,
  JobInvoiceStatus,
} from '@/types/job-operations/invoices'

type DbError = { code?: string | null; message?: string | null }
type QueryResponse<T> = { data: T | null; error: DbError | null }
type QueryListResponse<T> = { data: T[] | null; error: DbError | null }
type QueryBuilder = {
  select(columns: string): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  in(column: string, values: unknown[]): QueryBuilder
  order(column: string, options?: { ascending?: boolean }): QueryBuilder
  limit(count: number): QueryBuilder
  insert(payload: Record<string, unknown>): QueryBuilder
  update(payload: Record<string, unknown>): QueryBuilder
  maybeSingle<T = unknown>(): Promise<QueryResponse<T>>
  single<T = unknown>(): Promise<QueryResponse<T>>
  then<TResult1 = QueryListResponse<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryListResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>
}
type DbClient = { from(table: string): QueryBuilder }

type InvoiceDeps = {
  db?: DbClient
  now?: () => Date
  loadAcceptedEstimateOperationalSource?: LoadAcceptedEstimateOperationalSource
}

type LoadAcceptedEstimateOperationalSource =
  typeof import('./acceptedEstimateSource.ts').loadAcceptedEstimateOperationalSource

type ChangeOrderRow = {
  id: string
  change_order_number: string | null
  title: string | null
  description: string | null
  delta_total: number | string | null
  accepted_at: string | null
}

const invoiceSelect = [
  'id',
  'org_id',
  'job_id',
  'estimate_id',
  'estimate_snapshot_id',
  'invoice_number',
  'revision_number',
  'status',
  'title',
  'accepted_estimate_display_name',
  'customer_display_name',
  'job_display_name',
  'accepted_quote_total',
  'accepted_change_order_total',
  'taxable_subtotal',
  'tax_rate',
  'tax_total',
  'payment_total',
  'deposit_total',
  'credit_total',
  'invoice_total',
  'balance_due',
  'payment_terms',
  'due_date',
  'document_json',
  'generated_snapshot_json',
  'source_summary_json',
  'generated_at',
  'sent_at',
  'paid_at',
  'voided_at',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
].join(', ')

async function getDb(deps?: InvoiceDeps): Promise<DbClient> {
  if (deps?.db) return deps.db
  return (await import('../org.ts')).supabaseAdmin as unknown as DbClient
}

async function getAcceptedEstimateOperationalSourceLoader(deps?: InvoiceDeps) {
  if (deps?.loadAcceptedEstimateOperationalSource) {
    return deps.loadAcceptedEstimateOperationalSource
  }
  return (await import('./acceptedEstimateSource.ts')).loadAcceptedEstimateOperationalSource
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBodyField(body: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return body[snakeKey] ?? body[camelKey]
}

function normalizeOptionalText(value: unknown, label: string, maxLength = 8_000): ServiceResult<string | null> {
  if (value == null) return okResult(null)
  if (typeof value !== 'string') return errorResult('invalid_input', `${label} must be text.`)
  const trimmed = value.trim()
  if (!trimmed) return okResult(null)
  if (trimmed.length > maxLength) {
    return errorResult('invalid_input', `${label} must be ${maxLength} characters or fewer.`)
  }
  return okResult(trimmed)
}

function normalizeOptionalMoney(value: unknown, label: string): ServiceResult<number | null> {
  if (value == null || value === '') return okResult(null)
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return errorResult('invalid_input', `${label} must be a number.`)
  if (numeric < 0) return errorResult('invalid_input', `${label} must be 0 or greater.`)
  return okResult(Math.round(numeric * 100) / 100)
}

function normalizeOptionalNonnegativeNumber(value: unknown, label: string): ServiceResult<number | null> {
  if (value == null || value === '') return okResult(null)
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return errorResult('invalid_input', `${label} must be a number.`)
  if (numeric < 0) return errorResult('invalid_input', `${label} must be 0 or greater.`)
  return okResult(numeric)
}

function normalizeOptionalDate(value: unknown, label: string): ServiceResult<string | null> {
  if (value == null || value === '') return okResult(null)
  if (typeof value !== 'string') return errorResult('invalid_input', `${label} must be a date string.`)
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return errorResult('invalid_input', `${label} must use YYYY-MM-DD.`)
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    return errorResult('invalid_input', `${label} must be a valid date.`)
  }
  return okResult(trimmed)
}

function asMoney(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function readMoneyInput(record: Record<string, unknown>, defaults?: Partial<JobInvoiceMoneyInput>) {
  const creditTotal = normalizeOptionalMoney(readBodyField(record, 'credit_total', 'creditTotal'), 'credit_total')
  if (!creditTotal.ok) return creditTotal
  const paymentTotal = normalizeOptionalMoney(readBodyField(record, 'payment_total', 'paymentTotal'), 'payment_total')
  if (!paymentTotal.ok) return paymentTotal
  const depositTotal = normalizeOptionalMoney(readBodyField(record, 'deposit_total', 'depositTotal'), 'deposit_total')
  if (!depositTotal.ok) return depositTotal
  const taxRate = normalizeOptionalNonnegativeNumber(readBodyField(record, 'tax_rate', 'taxRate'), 'tax_rate')
  if (!taxRate.ok) return taxRate
  const taxTotal = normalizeOptionalMoney(readBodyField(record, 'tax_total', 'taxTotal'), 'tax_total')
  if (!taxTotal.ok) return taxTotal

  return okResult({
    credit_total: creditTotal.data ?? defaults?.credit_total ?? 0,
    payment_total: paymentTotal.data ?? defaults?.payment_total ?? 0,
    deposit_total: depositTotal.data ?? defaults?.deposit_total ?? 0,
    tax_rate: taxRate.data ?? defaults?.tax_rate ?? 0,
    tax_total: taxTotal.data ?? defaults?.tax_total ?? null,
  })
}

export function normalizeInvoiceGenerateInput(body: unknown): ServiceResult<JobInvoiceGenerateInput> {
  const record = isRecord(body) ? body : {}
  const money = readMoneyInput(record)
  if (!money.ok) return money
  const invoiceNumber = normalizeOptionalText(readBodyField(record, 'invoice_number', 'invoiceNumber'), 'invoice_number', 120)
  if (!invoiceNumber.ok) return invoiceNumber
  const paymentTerms = normalizeOptionalText(readBodyField(record, 'payment_terms', 'paymentTerms'), 'payment_terms', 1_000)
  if (!paymentTerms.ok) return paymentTerms
  const dueDate = normalizeOptionalDate(readBodyField(record, 'due_date', 'dueDate'), 'due_date')
  if (!dueDate.ok) return dueDate
  const memo = normalizeOptionalText(readBodyField(record, 'memo', 'memo'), 'memo')
  if (!memo.ok) return memo

  return okResult({
    ...money.data,
    invoice_number: invoiceNumber.data,
    payment_terms: paymentTerms.data,
    due_date: dueDate.data,
    memo: memo.data,
  })
}

export function normalizeInvoicePatchInput(body: unknown): ServiceResult<JobInvoicePatchInput> {
  if (!isRecord(body)) return errorResult('invalid_input', 'Request body must be an object.')
  const input: JobInvoicePatchInput = {}

  for (const [snakeKey, camelKey, label, maxLength] of [
    ['invoice_number', 'invoiceNumber', 'invoice_number', 120],
    ['payment_terms', 'paymentTerms', 'payment_terms', 1_000],
    ['memo', 'memo', 'memo', 8_000],
  ] as const) {
    if (snakeKey in body || camelKey in body) {
      const value = normalizeOptionalText(readBodyField(body, snakeKey, camelKey), label, maxLength)
      if (!value.ok) return value
      input[snakeKey] = value.data
    }
  }

  if ('due_date' in body || 'dueDate' in body) {
    const dueDate = normalizeOptionalDate(readBodyField(body, 'due_date', 'dueDate'), 'due_date')
    if (!dueDate.ok) return dueDate
    input.due_date = dueDate.data
  }

  for (const [snakeKey, camelKey, label] of [
    ['credit_total', 'creditTotal', 'credit_total'],
    ['payment_total', 'paymentTotal', 'payment_total'],
    ['deposit_total', 'depositTotal', 'deposit_total'],
    ['tax_rate', 'taxRate', 'tax_rate'],
    ['tax_total', 'taxTotal', 'tax_total'],
  ] as const) {
    if (snakeKey in body || camelKey in body) {
      const value = snakeKey === 'tax_rate'
        ? normalizeOptionalNonnegativeNumber(readBodyField(body, snakeKey, camelKey), label)
        : normalizeOptionalMoney(readBodyField(body, snakeKey, camelKey), label)
      if (!value.ok) return value
      if (snakeKey === 'tax_total') {
        input.tax_total = value.data
      } else {
        input[snakeKey] = value.data ?? 0
      }
    }
  }

  if ('status' in body) {
    if (body.status == null) {
      input.status = null
    } else if (body.status === 'paid') {
      input.status = body.status
    } else {
      return errorResult('invalid_input', 'status must be paid.')
    }
  }

  if (Object.keys(input).length === 0) {
    return errorResult('invalid_input', 'At least one invoice field is required.')
  }
  return okResult(input)
}

function customerName(source: AcceptedEstimateOperationalSource) {
  return source.customer.name ?? source.customer.email ?? source.customer.phone ?? null
}

function normalizeChangeOrder(row: ChangeOrderRow): JobInvoiceChangeOrderDelta {
  return {
    id: row.id,
    change_order_number: row.change_order_number,
    title: row.title,
    description: row.description,
    delta_total: asMoney(row.delta_total),
    accepted_at: row.accepted_at,
  }
}

async function loadAcceptedChangeOrderDeltas(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId: string
): Promise<ServiceResult<JobInvoiceChangeOrderDelta[]>> {
  const result = (await db
    .from('job_change_orders')
    .select('id, change_order_number, title, description, delta_total, accepted_at')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('estimate_snapshot_id', estimateSnapshotId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: true })) as QueryListResponse<ChangeOrderRow>

  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load accepted change orders.')
  }
  return okResult((result.data ?? []).map(normalizeChangeOrder))
}

function buildSourceSummary(params: {
  source: AcceptedEstimateOperationalSource
  changeOrders: JobInvoiceChangeOrderDelta[]
  generatedAt: string
}): JobInvoiceSourceSummary {
  return {
    source_kind: 'accepted_estimate_invoice',
    source_version: 1,
    org_id: params.source.source.org_id,
    job_id: params.source.source.job_id,
    estimate_id: params.source.source.estimate_id,
    estimate_snapshot_id: params.source.source.estimate_snapshot_id ?? '',
    accepted_public_version_id: params.source.source.accepted_public_version_id,
    accepted_change_order_ids: params.changeOrders.map((row) => row.id),
    accepted_change_order_total: params.changeOrders.reduce((sum, row) => sum + row.delta_total, 0),
    generated_at: params.generatedAt,
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function calculateInvoiceTotals(params: {
  acceptedTotal: number
  changeOrderTotal: number
  money: JobInvoiceMoneyInput
}) {
  const taxableSubtotal = roundMoney(params.acceptedTotal + params.changeOrderTotal)
  const taxTotal = roundMoney(params.money.tax_total ?? taxableSubtotal * params.money.tax_rate)
  const invoiceTotal = roundMoney(taxableSubtotal + taxTotal)
  const balanceDue = roundMoney(
    Math.max(0, invoiceTotal - params.money.credit_total - params.money.payment_total - params.money.deposit_total)
  )
  return {
    taxable_subtotal: taxableSubtotal,
    tax_total: taxTotal,
    invoice_total: invoiceTotal,
    balance_due: balanceDue,
  }
}

export function buildInvoiceDocument(params: {
  source: AcceptedEstimateOperationalSource
  changeOrders: JobInvoiceChangeOrderDelta[]
  input: JobInvoiceGenerateInput
  revisionNumber: number
  status: JobInvoiceStatus
  generatedAt: string
}): JobInvoiceDocument {
  const sourceSummary = buildSourceSummary({
    source: params.source,
    changeOrders: params.changeOrders,
    generatedAt: params.generatedAt,
  })
  const totals = calculateInvoiceTotals({
    acceptedTotal: params.source.totals.accepted_total,
    changeOrderTotal: sourceSummary.accepted_change_order_total,
    money: params.input,
  })

  return {
    kind: 'job_invoice',
    version: 1,
    generated_at: params.generatedAt,
    title: 'Invoice',
    revision_number: params.revisionNumber,
    status: params.status,
    invoice_number: params.input.invoice_number,
    payment_terms: params.input.payment_terms,
    due_date: params.input.due_date,
    source: sourceSummary,
    customer: jsonClone(params.source.customer),
    job: jsonClone(params.source.job),
    estimate: jsonClone(params.source.estimate),
    acceptance: jsonClone(params.source.acceptance),
    totals: {
      accepted_quote_total: params.source.totals.accepted_total,
      accepted_change_order_total: sourceSummary.accepted_change_order_total,
      taxable_subtotal: totals.taxable_subtotal,
      tax_rate: params.input.tax_rate,
      tax_total: totals.tax_total,
      invoice_total: totals.invoice_total,
      credit_total: params.input.credit_total,
      payment_total: params.input.payment_total,
      deposit_total: params.input.deposit_total,
      balance_due: totals.balance_due,
    },
    notes: {
      memo: params.input.memo,
      accepted_estimate_notes: jsonClone(params.source.notes),
    },
    change_order_deltas: jsonClone(params.changeOrders),
  }
}

async function loadLatestInvoice(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId?: string | null
) {
  let query = db
    .from('job_invoices')
    .select(invoiceSelect)
    .eq('org_id', orgId)
    .eq('job_id', jobId)
  if (estimateSnapshotId) query = query.eq('estimate_snapshot_id', estimateSnapshotId)
  return query
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle<JobInvoiceRow>()
}

export async function loadJobInvoice(
  orgId: string,
  jobId: string,
  deps?: InvoiceDeps
): Promise<ServiceResult<JobInvoiceReadModel>> {
  const loadAcceptedSource = await getAcceptedEstimateOperationalSourceLoader(deps)
  const source = await loadAcceptedSource(
    { orgId, jobId },
    deps as Parameters<LoadAcceptedEstimateOperationalSource>[1]
  )
  if (!source.ok) return source

  const db = await getDb(deps)
  const latest = await loadLatestInvoice(
    db,
    orgId,
    jobId,
    source.data.source.estimate_snapshot_id
  )
  if (latest.error) {
    return errorResult('server_error', latest.error.message ?? 'Unable to load invoice.')
  }
  return okResult({ current: latest.data ?? null })
}

function canReplaceInvoice(row: JobInvoiceRow | null) {
  return row?.status === 'draft'
}

function nextRevision(row: JobInvoiceRow | null) {
  return row ? row.revision_number + 1 : 1
}

function isUniqueConflict(error: DbError | null) {
  const message = (error?.message ?? '').toLowerCase()
  return error?.code === '23505' || message.includes('duplicate') || message.includes('unique')
}

function defaultInvoiceNumber(jobId: string, revisionNumber: number, generatedAt: string) {
  return `INV-${generatedAt.slice(0, 10).replace(/-/g, '')}-${jobId.slice(0, 8)}-${revisionNumber}`
}

function rowPayloadFromDocument(params: {
  source: AcceptedEstimateOperationalSource
  document: JobInvoiceDocument
  userId: string
}) {
  const document = params.document
  return {
    invoice_number: document.invoice_number,
    status: document.status,
    title: document.title,
    accepted_estimate_display_name: params.source.estimate.version_name,
    customer_display_name: customerName(params.source),
    job_display_name: params.source.job.title,
    accepted_quote_total: document.totals.accepted_quote_total,
    accepted_change_order_total: document.totals.accepted_change_order_total,
    taxable_subtotal: document.totals.taxable_subtotal,
    tax_rate: document.totals.tax_rate,
    tax_total: document.totals.tax_total,
    payment_total: document.totals.payment_total,
    deposit_total: document.totals.deposit_total,
    credit_total: document.totals.credit_total,
    invoice_total: document.totals.invoice_total,
    balance_due: document.totals.balance_due,
    payment_terms: document.payment_terms,
    due_date: document.due_date,
    document_json: document,
    generated_snapshot_json: document,
    source_summary_json: document.source,
    generated_at: document.generated_at,
    updated_by: params.userId,
  }
}

export async function generateJobInvoice(
  params: {
    orgId: string
    jobId: string
    userId: string
    input: JobInvoiceGenerateInput
  },
  deps?: InvoiceDeps
): Promise<ServiceResult<JobInvoiceRow>> {
  const loadAcceptedSource = await getAcceptedEstimateOperationalSourceLoader(deps)
  const source = await loadAcceptedSource(
    { orgId: params.orgId, jobId: params.jobId },
    deps as Parameters<LoadAcceptedEstimateOperationalSource>[1]
  )
  if (!source.ok) return source
  if (!source.data.source.estimate_snapshot_id) {
    return errorResult('not_found', 'Accepted estimate snapshot is missing.')
  }

  const db = await getDb(deps)
  const changeOrders = await loadAcceptedChangeOrderDeltas(
    db,
    params.orgId,
    params.jobId,
    source.data.source.estimate_snapshot_id
  )
  if (!changeOrders.ok) return changeOrders

  const latest = await loadLatestInvoice(
    db,
    params.orgId,
    params.jobId,
    source.data.source.estimate_snapshot_id
  )
  if (latest.error) {
    return errorResult('server_error', latest.error.message ?? 'Unable to inspect invoice.')
  }

  const replacing = canReplaceInvoice(latest.data ?? null)
  const revisionNumber = replacing ? latest.data!.revision_number : nextRevision(latest.data ?? null)
  const generatedAt = (deps?.now?.() ?? new Date()).toISOString()
  const input = {
    ...params.input,
    invoice_number:
      params.input.invoice_number ?? defaultInvoiceNumber(params.jobId, revisionNumber, generatedAt),
  }
  const document = buildInvoiceDocument({
    source: source.data,
    changeOrders: changeOrders.data,
    input,
    revisionNumber,
    status: 'draft',
    generatedAt,
  })
  const payload = rowPayloadFromDocument({ source: source.data, document, userId: params.userId })

  if (replacing && latest.data) {
    const updated = await db
      .from('job_invoices')
      .update({
        ...payload,
        sent_at: null,
        paid_at: null,
        voided_at: null,
      })
      .eq('org_id', params.orgId)
      .eq('job_id', params.jobId)
      .eq('id', latest.data.id)
      .eq('status', 'draft')
      .select(invoiceSelect)
      .single<JobInvoiceRow>()
    if (updated.error || !updated.data) {
      return errorResult('server_error', updated.error?.message ?? 'Unable to regenerate invoice.')
    }
    return okResult(updated.data)
  }

  const created = await db
    .from('job_invoices')
    .insert({
      org_id: params.orgId,
      job_id: params.jobId,
      estimate_id: source.data.source.estimate_id,
      estimate_snapshot_id: source.data.source.estimate_snapshot_id,
      revision_number: revisionNumber,
      ...payload,
      sent_at: null,
      paid_at: null,
      voided_at: null,
      created_by: params.userId,
    })
    .select(invoiceSelect)
    .single<JobInvoiceRow>()
  if (created.error || !created.data) {
    if (isUniqueConflict(created.error)) {
      return errorResult('conflict', 'An invoice revision already exists for this accepted estimate.')
    }
    return errorResult('server_error', created.error?.message ?? 'Unable to generate invoice.')
  }

  return okResult(created.data)
}

function documentToGenerateInput(row: JobInvoiceRow): JobInvoiceGenerateInput {
  return {
    invoice_number: row.invoice_number,
    payment_terms: row.payment_terms,
    due_date: row.due_date,
    memo: row.document_json.notes?.memo ?? null,
    credit_total: row.credit_total,
    payment_total: row.payment_total,
    deposit_total: row.deposit_total,
    tax_rate: row.tax_rate,
    tax_total: row.tax_total,
  }
}

function applyPatchToDocument(row: JobInvoiceRow, patch: JobInvoicePatchInput): JobInvoiceDocument {
  const input = {
    ...documentToGenerateInput(row),
    ...patch,
  }
  const totals = calculateInvoiceTotals({
    acceptedTotal: row.accepted_quote_total,
    changeOrderTotal: row.accepted_change_order_total,
    money: input,
  })
  const status = patch.status === 'paid' || (row.status === 'paid' && totals.balance_due === 0)
    ? 'paid'
    : row.status === 'paid'
      ? 'sent'
      : row.status

  return {
    ...row.document_json,
    status,
    invoice_number: input.invoice_number ?? null,
    payment_terms: input.payment_terms ?? null,
    due_date: input.due_date ?? null,
    totals: {
      ...row.document_json.totals,
      tax_rate: input.tax_rate,
      tax_total: totals.tax_total,
      taxable_subtotal: totals.taxable_subtotal,
      invoice_total: totals.invoice_total,
      credit_total: input.credit_total,
      payment_total: input.payment_total,
      deposit_total: input.deposit_total,
      balance_due: totals.balance_due,
    },
    notes: {
      ...row.document_json.notes,
      memo: input.memo ?? null,
    },
  }
}

export async function patchJobInvoice(
  params: {
    orgId: string
    jobId: string
    userId: string
    input: JobInvoicePatchInput
  },
  deps?: InvoiceDeps
): Promise<ServiceResult<JobInvoiceRow>> {
  const loadAcceptedSource = await getAcceptedEstimateOperationalSourceLoader(deps)
  const source = await loadAcceptedSource(
    { orgId: params.orgId, jobId: params.jobId },
    deps as Parameters<LoadAcceptedEstimateOperationalSource>[1]
  )
  if (!source.ok) return source

  const db = await getDb(deps)
  const latest = await loadLatestInvoice(
    db,
    params.orgId,
    params.jobId,
    source.data.source.estimate_snapshot_id
  )
  if (latest.error) {
    return errorResult('server_error', latest.error.message ?? 'Unable to inspect invoice.')
  }
  if (!latest.data) return errorResult('not_found', 'Invoice not found.')
  if (latest.data.status === 'void') return errorResult('conflict', 'Voided invoices cannot be edited.')

  const document = applyPatchToDocument(latest.data, params.input)
  if (params.input.status === 'paid' && document.totals.balance_due > 0) {
    return errorResult('invalid_input', 'Invoice cannot be marked paid while a balance is due.')
  }
  const now = (deps?.now?.() ?? new Date()).toISOString()
  const paidAt = document.status === 'paid' ? latest.data.paid_at ?? now : null

  const updated = await db
    .from('job_invoices')
    .update({
      invoice_number: document.invoice_number,
      status: document.status,
      taxable_subtotal: document.totals.taxable_subtotal,
      tax_rate: document.totals.tax_rate,
      tax_total: document.totals.tax_total,
      payment_total: document.totals.payment_total,
      deposit_total: document.totals.deposit_total,
      credit_total: document.totals.credit_total,
      invoice_total: document.totals.invoice_total,
      balance_due: document.totals.balance_due,
      payment_terms: document.payment_terms,
      due_date: document.due_date,
      document_json: document,
      generated_snapshot_json: document,
      paid_at: paidAt,
      updated_by: params.userId,
    })
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('id', latest.data.id)
    .select(invoiceSelect)
    .single<JobInvoiceRow>()
  if (updated.error || !updated.data) {
    return errorResult('server_error', updated.error?.message ?? 'Unable to update invoice.')
  }
  return okResult(updated.data)
}

async function setLatestInvoiceStatus(params: {
  orgId: string
  jobId: string
  userId: string
  status: Extract<JobInvoiceStatus, 'sent' | 'void'>
}, deps?: InvoiceDeps): Promise<ServiceResult<JobInvoiceRow>> {
  const loadAcceptedSource = await getAcceptedEstimateOperationalSourceLoader(deps)
  const source = await loadAcceptedSource(
    { orgId: params.orgId, jobId: params.jobId },
    deps as Parameters<LoadAcceptedEstimateOperationalSource>[1]
  )
  if (!source.ok) return source

  const db = await getDb(deps)
  const latest = await loadLatestInvoice(
    db,
    params.orgId,
    params.jobId,
    source.data.source.estimate_snapshot_id
  )
  if (latest.error) {
    return errorResult('server_error', latest.error.message ?? 'Unable to inspect invoice.')
  }
  if (!latest.data) return errorResult('not_found', 'Invoice not found.')

  if (params.status === 'sent' && latest.data.status !== 'draft') {
    return errorResult('conflict', 'Only draft invoices can be sent.')
  }
  if (params.status === 'void' && latest.data.status === 'paid') {
    return errorResult('conflict', 'Paid invoices cannot be voided.')
  }
  if (params.status === 'void' && latest.data.status === 'void') {
    return errorResult('conflict', 'Invoice is already void.')
  }

  const now = (deps?.now?.() ?? new Date()).toISOString()
  const document = {
    ...latest.data.document_json,
    status: params.status,
  }
  const patch =
    params.status === 'sent'
      ? { status: 'sent', sent_at: now }
      : { status: 'void', voided_at: now }

  const updated = await db
    .from('job_invoices')
    .update({
      ...patch,
      document_json: document,
      generated_snapshot_json: document,
      updated_by: params.userId,
    })
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('id', latest.data.id)
    .select(invoiceSelect)
    .single<JobInvoiceRow>()
  if (updated.error || !updated.data) {
    return errorResult('server_error', updated.error?.message ?? 'Unable to update invoice.')
  }
  return okResult(updated.data)
}

export function sendJobInvoice(
  params: { orgId: string; jobId: string; userId: string },
  deps?: InvoiceDeps
) {
  return setLatestInvoiceStatus({ ...params, status: 'sent' }, deps)
}

export function voidJobInvoice(
  params: { orgId: string; jobId: string; userId: string },
  deps?: InvoiceDeps
) {
  return setLatestInvoiceStatus({ ...params, status: 'void' }, deps)
}
