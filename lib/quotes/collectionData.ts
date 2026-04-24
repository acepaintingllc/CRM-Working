import { isJobStatus } from '../jobs/types'
import type {
  EstimateCollectionCustomerRow,
  EstimateCollectionJobContextDbRow,
  EstimateCollectionJobPageDbRow,
  EstimateCollectionJobRow,
  EstimateCollectionRollupRow,
  EstimateCollectionSearchDbRows,
  EstimateCollectionSummaryDbRow,
  EstimateCollectionVersionRow,
} from '../server/estimate-collection/types'

export type EstimateCollectionDecoratedRow = {
  id: string
  estimate_id: string
  job_id: string
  customer_id: string
  status: string | null
  raw_version_name: string | null
  raw_version_state: string | null
  raw_version_kind: string | null
  raw_version_sort_order: number | null
  version_name: string
  version_state: string
  version_kind: string
  version_sort_order: number
  job_title: string
  job_status: string | null
  job_estimate_sent_at: string | null
  customer_name: string
  final_total: number | null
  updated_at: string | null
  created_at: string | null
  is_sent_estimate: boolean
}

export const QUOTE_HOME_FALLBACK_VERSION_NAME = 'Quote Version'
export const QUOTE_HOME_FALLBACK_VERSION_STATE = 'draft'
export const QUOTE_HOME_FALLBACK_VERSION_KIND = 'standard'
export const QUOTE_HOME_FALLBACK_JOB_TITLE = 'Untitled job'
export const QUOTE_HOME_FALLBACK_CUSTOMER_NAME = 'Unknown customer'

export type EstimateCollectionRowRelations = {
  jobs: EstimateCollectionJobRow[]
  customers: EstimateCollectionCustomerRow[]
  rollups: EstimateCollectionRollupRow[]
}

export type QuoteHomeJobsPageRows = {
  query: string
  limit: number
  rows: EstimateCollectionJobPageDbRow[]
}

export type QuoteHomeSearchRows = EstimateCollectionSearchDbRows & {
  limit: number
}

export const QUOTE_HOME_SEARCH_SOURCE_RANK = {
  version: 0,
  job: 1,
  customer: 2,
} as const

export const QUOTE_HOME_SEARCH_SORT_POLICY = [
  'source rank ascending',
  'updated_at descending',
  'id descending',
] as const

export type QuoteHomeSearchSource = keyof typeof QUOTE_HOME_SEARCH_SOURCE_RANK

export type QuoteHomeSearchCandidate = {
  row: EstimateCollectionVersionRow
  source: QuoteHomeSearchSource
  rank: number
}

export const quoteHomeDefaultPageLimit = 25
export const quoteHomeMaxPageLimit = 100

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const quoteHomeCursorSeparator = '::'
const quoteHomeNullCursorTimestamp = 'null'

export type QuoteHomeCursorKey = {
  timestamp: string | null
  id: string
}

export function normalizeQuoteHomeQuery(value: unknown): string {
  return String(value ?? '').trim()
}

export const normalizeQuoteHomeSearchQuery = normalizeQuoteHomeQuery
export const normalizeQuoteHomeJobQuery = normalizeQuoteHomeQuery

export function normalizeQuoteHomePageLimit(
  value: number | null | undefined,
  fallback = quoteHomeDefaultPageLimit,
  maximum = quoteHomeMaxPageLimit
): number {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(1, Math.min(maximum, Math.trunc(next)))
}

export function encodeQuoteHomeCursor(value: {
  timestamp: string | null | undefined
  id: string | null | undefined
}) {
  if (!value.id) return null
  return `${value.timestamp ?? quoteHomeNullCursorTimestamp}${quoteHomeCursorSeparator}${value.id}`
}

export function decodeQuoteHomeCursor(cursor: string | null | undefined) {
  const rawCursor = normalizeQuoteHomeSearchQuery(cursor)
  if (!rawCursor) {
    return { ok: true as const, value: null }
  }

  const parts = rawCursor.split(quoteHomeCursorSeparator)
  if (parts.length !== 2) {
    return { ok: false as const, message: 'Invalid cursor.' }
  }

  const [timestamp, id] = parts
  if (!timestamp || !uuid.test(id)) {
    return { ok: false as const, message: 'Invalid cursor.' }
  }

  if (timestamp === quoteHomeNullCursorTimestamp) {
    return {
      ok: true as const,
      value: {
        timestamp: null,
        id,
      },
    }
  }

  const parsedTimestamp = new Date(timestamp)
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return { ok: false as const, message: 'Invalid cursor.' }
  }

  return {
    ok: true as const,
    value: {
      timestamp: parsedTimestamp.toISOString(),
      id,
    },
  }
}

type EstimateCollectionDecoratedRowInput = Partial<EstimateCollectionDecoratedRow>

export type QuoteListEstimate = {
  id: string
  job_id: string
  customer_id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  updated_at: string | null
  created_at: string | null
  job_title: string
  job_status: string | null
  job_estimate_sent_at: string | null
  is_sent_estimate: boolean
  customer_name: string
}

type QuoteHomeVersionIdentity = {
  estimate_id: string
  job_id: string
  version_name: string
  version_state: string
  version_kind: string
  job_title: string
  customer_name: string
}

export type QuoteHomeRecentActivityItemReadModel = QuoteHomeVersionIdentity & {
  final_total: number | null
  updated_at: string | null
  is_sent_estimate: boolean
}

export type QuoteHomeJobVersionItemReadModel = QuoteHomeVersionIdentity & {
  customer_id: string
  version_sort_order: number
  final_total: number | null
  updated_at: string | null
  created_at: string | null
  is_sent_estimate: boolean
}

export type QuoteHomeSummaryReadModel = {
  total_versions: number
  draft_count: number
  sent_or_awaiting_count: number
  live_count: number
  pipeline_total: number
}

export type QuoteHomeRecentActivityReadModel = {
  items: QuoteHomeRecentActivityItemReadModel[]
}

export type QuoteHomeSearchResultReadModel = {
  estimate_id: string
  job_id: string
  customer_id: string
  version_name: string
  version_state: string
  version_kind: string
  job_title: string
  customer_name: string
  updated_at: string | null
  final_total: number | null
  is_sent_estimate: boolean
}

export type QuoteHomeEligibleJobReadModel = {
  id: string
  customer_id: string
  customer_name: string | null
  customer_address: string | null
  title: string
  description: string | null
  status: string
  created_at: string | null
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  scheduled_email_sent_at: string | null
  completed_at: string | null
  completed_email_sent_at: string | null
  closeout_notes: string | null
  linked_estimate_id: string | null
}

export type QuoteHomeJobListItemReadModel = QuoteHomeEligibleJobReadModel & {
  version_count: number
}

export type QuoteHomeJobsPageReadModel = {
  query: string
  limit: number
  next_cursor: string | null
  items: QuoteHomeJobListItemReadModel[]
}

export type QuoteJobVersionsReadModel = {
  job_id: string
  total_versions: number
  items: QuoteHomeJobVersionItemReadModel[]
}

export type QuoteJobVersionsPageReadModel = QuoteJobVersionsReadModel & {
  limit: number
  next_cursor: string | null
}

export type QuoteHomeBootstrapReadModel = {
  summary: QuoteHomeSummaryReadModel
  jobs: QuoteHomeJobsPageReadModel
  selected_job_id: string | null
  selected_job_versions: QuoteJobVersionsPageReadModel | null
}

export type QuoteHomeSearchResponse = {
  query: string
  items: QuoteHomeSearchResultReadModel[]
}

export type QuoteCreateJobEligibilityReason = 'eligible' | 'missing_customer'

export type QuoteCreateJobReadModel = {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  title: string
  eligibility: {
    eligible: boolean
    reason: QuoteCreateJobEligibilityReason
  }
}

export type QuoteCreateJobContextReadModel = {
  job: QuoteCreateJobReadModel
}

function asRequiredText(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  return text || fallback
}

function asNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function asNumber(value: unknown, fallback: number): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : fallback
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function asPipelineTotal(value: unknown): number {
  const amount = asNullableNumber(value)
  if (amount == null || amount < 0) return 0
  return amount
}

function asMoney(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function asTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function normalizeEstimateCollectionVersionState(value: string | null | undefined) {
  return value?.trim() || QUOTE_HOME_FALLBACK_VERSION_STATE
}

function isSentEstimateCollectionJob(job: EstimateCollectionJobRow | undefined) {
  if (!job) return false
  return job.status === 'estimate_sent' || job.status === 'follow_up'
}

function compareQuoteHomeSearchCandidatesByPolicy(
  left: QuoteHomeSearchCandidate,
  right: QuoteHomeSearchCandidate
) {
  const rankDiff = left.rank - right.rank
  if (rankDiff !== 0) return rankDiff

  const updatedDiff = asTimestamp(right.row.updated_at) - asTimestamp(left.row.updated_at)
  if (updatedDiff !== 0) return updatedDiff

  return right.row.id.localeCompare(left.row.id)
}

export function toQuoteHomeSearchCandidates(
  params: EstimateCollectionSearchDbRows
): QuoteHomeSearchCandidate[] {
  return [
    ...params.versionRows.map((row) => ({
      row,
      source: 'version' as const,
      rank: QUOTE_HOME_SEARCH_SOURCE_RANK.version,
    })),
    ...params.jobRows.map((row) => ({
      row,
      source: 'job' as const,
      rank: QUOTE_HOME_SEARCH_SOURCE_RANK.job,
    })),
    ...params.customerRows.map((row) => ({
      row,
      source: 'customer' as const,
      rank: QUOTE_HOME_SEARCH_SOURCE_RANK.customer,
    })),
  ]
}

function getEstimateId(row: EstimateCollectionDecoratedRowInput): string {
  return asRequiredText(row.estimate_id, asRequiredText(row.id, ''))
}

function getVersionName(row: EstimateCollectionDecoratedRowInput): string {
  return asRequiredText(row.version_name, QUOTE_HOME_FALLBACK_VERSION_NAME)
}

function getVersionState(row: EstimateCollectionDecoratedRowInput): string {
  return asRequiredText(row.version_state, QUOTE_HOME_FALLBACK_VERSION_STATE)
}

function getVersionKind(row: EstimateCollectionDecoratedRowInput): string {
  return asRequiredText(row.version_kind, QUOTE_HOME_FALLBACK_VERSION_KIND)
}

function getJobTitle(row: EstimateCollectionDecoratedRowInput): string {
  return asRequiredText(row.job_title, QUOTE_HOME_FALLBACK_JOB_TITLE)
}

function getCustomerName(row: EstimateCollectionDecoratedRowInput): string {
  return asRequiredText(row.customer_name, QUOTE_HOME_FALLBACK_CUSTOMER_NAME)
}

export function toQuoteListEstimate(row: EstimateCollectionDecoratedRowInput): QuoteListEstimate {
  return {
    id: asRequiredText(row.id, getEstimateId(row)),
    job_id: asRequiredText(row.job_id, ''),
    customer_id: asRequiredText(row.customer_id, ''),
    status: asNullableText(row.status),
    version_name: asNullableText(row.raw_version_name),
    version_state: asNullableText(row.raw_version_state),
    version_kind: asNullableText(row.raw_version_kind),
    version_sort_order: asNullableNumber(row.raw_version_sort_order),
    updated_at: asNullableText(row.updated_at),
    created_at: asNullableText(row.created_at),
    job_title: getJobTitle(row),
    job_status: asNullableText(row.job_status),
    job_estimate_sent_at: asNullableText(row.job_estimate_sent_at),
    is_sent_estimate: asBoolean(row.is_sent_estimate),
    customer_name: getCustomerName(row),
  }
}

export function toQuoteHomeRecentActivityItem(
  row: EstimateCollectionDecoratedRowInput
): QuoteHomeRecentActivityItemReadModel {
  return {
    estimate_id: getEstimateId(row),
    job_id: asRequiredText(row.job_id, ''),
    version_name: getVersionName(row),
    version_state: getVersionState(row),
    version_kind: getVersionKind(row),
    job_title: getJobTitle(row),
    customer_name: getCustomerName(row),
    final_total: asNullableNumber(row.final_total),
    updated_at: asNullableText(row.updated_at),
    is_sent_estimate: asBoolean(row.is_sent_estimate),
  }
}

export function toQuoteHomeJobVersionItem(
  row: EstimateCollectionDecoratedRowInput
): QuoteHomeJobVersionItemReadModel {
  return {
    estimate_id: getEstimateId(row),
    job_id: asRequiredText(row.job_id, ''),
    customer_id: asRequiredText(row.customer_id, ''),
    version_name: getVersionName(row),
    version_state: getVersionState(row),
    version_kind: getVersionKind(row),
    version_sort_order: asNumber(row.version_sort_order, 0),
    job_title: getJobTitle(row),
    customer_name: getCustomerName(row),
    final_total: asNullableNumber(row.final_total),
    updated_at: asNullableText(row.updated_at),
    created_at: asNullableText(row.created_at),
    is_sent_estimate: asBoolean(row.is_sent_estimate),
  }
}

export function toQuoteHomeSearchResultReadModel(
  row: EstimateCollectionDecoratedRowInput
): QuoteHomeSearchResultReadModel {
  return {
    estimate_id: getEstimateId(row),
    job_id: asRequiredText(row.job_id, ''),
    customer_id: asRequiredText(row.customer_id, ''),
    version_name: getVersionName(row),
    version_state: getVersionState(row),
    version_kind: getVersionKind(row),
    job_title: getJobTitle(row),
    customer_name: getCustomerName(row),
    updated_at: asNullableText(row.updated_at),
    final_total: asNullableNumber(row.final_total),
    is_sent_estimate: asBoolean(row.is_sent_estimate),
  }
}

export function buildQuoteHomeSummaryFromRow(
  row: EstimateCollectionSummaryDbRow | null | undefined
): QuoteHomeSummaryReadModel {
  return {
    total_versions: Number(row?.total_versions ?? 0),
    draft_count: Number(row?.draft_count ?? 0),
    sent_or_awaiting_count: Number(row?.sent_or_awaiting_count ?? 0),
    live_count: Number(row?.live_count ?? 0),
    pipeline_total: Number(row?.pipeline_total ?? 0),
  }
}

export function decorateEstimateCollectionRows(
  estimateRows: EstimateCollectionVersionRow[],
  relations: EstimateCollectionRowRelations
): EstimateCollectionDecoratedRow[] {
  const jobsById = new Map(relations.jobs.map((row) => [row.id, row]))
  const customersById = new Map(relations.customers.map((row) => [row.id, row]))
  const totalsByEstimateId = new Map(
    relations.rollups.map((row) => [row.estimate_id, asMoney(row.final_total)])
  )

  return estimateRows.map((row) => {
    const job = jobsById.get(row.job_id)
    const customer = customersById.get(row.customer_id)
    return {
      id: row.id,
      estimate_id: row.id,
      job_id: row.job_id,
      customer_id: row.customer_id,
      status: row.status,
      raw_version_name: row.version_name,
      raw_version_state: row.version_state,
      raw_version_kind: row.version_kind,
      raw_version_sort_order: row.version_sort_order,
      version_name: row.version_name?.trim() || QUOTE_HOME_FALLBACK_VERSION_NAME,
      version_state: normalizeEstimateCollectionVersionState(row.version_state),
      version_kind: row.version_kind?.trim() || QUOTE_HOME_FALLBACK_VERSION_KIND,
      version_sort_order: row.version_sort_order ?? 0,
      job_title: job?.title?.trim() || QUOTE_HOME_FALLBACK_JOB_TITLE,
      job_status: job?.status ?? null,
      job_estimate_sent_at: job?.estimate_sent_at ?? null,
      customer_name: customer?.name?.trim() || QUOTE_HOME_FALLBACK_CUSTOMER_NAME,
      final_total: totalsByEstimateId.get(row.id) ?? null,
      updated_at: row.updated_at,
      created_at: row.created_at,
      is_sent_estimate: isSentEstimateCollectionJob(job),
    }
  })
}

export function toQuoteHomeEligibleJobReadModel(
  row: EstimateCollectionJobPageDbRow
): QuoteHomeJobListItemReadModel | null {
  const customerId = asRequiredText(row.customer_id, '')
  if (!customerId) return null

  return {
    id: asRequiredText(row.id, ''),
    customer_id: customerId,
    customer_name: asRequiredText(row.customer_name, '') || null,
    customer_address: asRequiredText(row.customer_address, '') || null,
    title: asRequiredText(row.title, QUOTE_HOME_FALLBACK_JOB_TITLE),
    description: asNullableText(row.description),
    status: isJobStatus(row.status) ? row.status : 'estimate_scheduled',
    created_at: asNullableText(row.created_at),
    estimate_date: asNullableText(row.estimate_date),
    estimate_sent_at: asNullableText(row.estimate_sent_at),
    scheduled_date: asNullableText(row.scheduled_date),
    scheduled_end_date: asNullableText(row.scheduled_end_date),
    scheduled_email_sent_at: asNullableText(row.scheduled_email_sent_at),
    completed_at: asNullableText(row.completed_at),
    completed_email_sent_at: asNullableText(row.completed_email_sent_at),
    closeout_notes: asNullableText(row.closeout_notes),
    linked_estimate_id: asNullableText(row.linked_estimate_id),
    version_count: asNumber(row.version_count, 0),
  }
}

export function toQuoteCreateJobReadModel(
  row: EstimateCollectionJobContextDbRow
): QuoteCreateJobReadModel {
  const customerId = asRequiredText(row.customer_id, '') || null

  return {
    id: asRequiredText(row.id, ''),
    customer_id: customerId,
    customer_name: asRequiredText(row.customer_name, '') || null,
    customer_address: asRequiredText(row.customer_address, '') || null,
    title: asRequiredText(row.title, QUOTE_HOME_FALLBACK_JOB_TITLE),
    eligibility: {
      eligible: Boolean(customerId),
      reason: customerId ? 'eligible' : 'missing_customer',
    },
  }
}

export function selectQuoteHomeSearchRows(params: QuoteHomeSearchRows): EstimateCollectionVersionRow[] {
  const candidates = toQuoteHomeSearchCandidates(params).sort(
    compareQuoteHomeSearchCandidatesByPolicy
  )

  const selected = new Map<string, EstimateCollectionVersionRow>()
  for (const candidate of candidates) {
    if (!selected.has(candidate.row.id)) {
      selected.set(candidate.row.id, candidate.row)
    }
    if (selected.size >= params.limit) break
  }

  return Array.from(selected.values())
}

export function buildQuoteHomeSummaryReadModel(
  estimates: Array<
    Partial<Pick<QuoteHomeJobVersionItemReadModel, 'version_state' | 'is_sent_estimate'>> & {
      final_total?: unknown
    }
  >
): QuoteHomeSummaryReadModel {
  return estimates.reduce<QuoteHomeSummaryReadModel>(
    (summary, row) => {
      const versionState = asRequiredText(row.version_state, QUOTE_HOME_FALLBACK_VERSION_STATE)

      return {
        total_versions: summary.total_versions + 1,
        draft_count: summary.draft_count + (versionState === 'draft' ? 1 : 0),
        sent_or_awaiting_count:
          summary.sent_or_awaiting_count + (row.is_sent_estimate === true ? 1 : 0),
        live_count: summary.live_count + (versionState === 'live' ? 1 : 0),
        pipeline_total:
          versionState === 'archived'
            ? summary.pipeline_total
            : summary.pipeline_total + asPipelineTotal(row.final_total),
      }
    },
    {
      total_versions: 0,
      draft_count: 0,
      sent_or_awaiting_count: 0,
      live_count: 0,
      pipeline_total: 0,
    }
  )
}

export function buildQuoteHomeBootstrapReadModel(params: {
  summary: QuoteHomeSummaryReadModel
  jobs: QuoteHomeJobsPageReadModel
  selectedJobVersions: QuoteJobVersionsPageReadModel | null
}): QuoteHomeBootstrapReadModel {
  const firstJobId = asRequiredText(params.jobs.items[0]?.id, '')

  return {
    summary: params.summary,
    jobs: params.jobs,
    selected_job_id:
      asRequiredText(params.selectedJobVersions?.job_id, firstJobId) || null,
    selected_job_versions: params.selectedJobVersions,
  }
}

export function buildQuoteHomeRecentActivityReadModel(
  rows: EstimateCollectionDecoratedRowInput[]
): QuoteHomeRecentActivityReadModel {
  return {
    items: rows.map(toQuoteHomeRecentActivityItem).slice(0, 12),
  }
}

export function buildQuoteHomeSearchReadModel(
  rows: EstimateCollectionDecoratedRowInput[],
  query: string
): QuoteHomeSearchResponse {
  return {
    query,
    items: rows.map(toQuoteHomeSearchResultReadModel),
  }
}

export function buildQuoteHomeJobsPageReadModel(params: {
  query: string
  limit: number
  nextCursor: string | null
  items: QuoteHomeJobListItemReadModel[]
}): QuoteHomeJobsPageReadModel {
  return {
    query: params.query,
    limit: params.limit,
    next_cursor: params.nextCursor,
    items: params.items,
  }
}

export function buildQuoteListPayload(rows: EstimateCollectionDecoratedRowInput[]) {
  return {
    estimates: rows.map(toQuoteListEstimate),
  }
}

export function buildQuoteJobVersionsReadModel(
  rows: EstimateCollectionDecoratedRowInput[],
  params: {
    jobId: string
    totalVersions: number
    limit: number
    nextCursor: string | null
  }
): QuoteJobVersionsPageReadModel {
  return {
    job_id: params.jobId,
    total_versions: params.totalVersions,
    limit: params.limit,
    next_cursor: params.nextCursor,
    items: rows
      .map(toQuoteHomeJobVersionItem)
      .filter((estimate) => estimate.job_id === params.jobId),
  }
}

export function buildQuoteCreateJobContextReadModel(
  row: EstimateCollectionJobContextDbRow
): QuoteCreateJobContextReadModel {
  return {
    job: toQuoteCreateJobReadModel(row),
  }
}
