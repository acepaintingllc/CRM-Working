import { isJobStatus } from '../jobs/types'
import type {
  EstimateCollectionJobContextDbRow,
  EstimateCollectionJobPageDbRow,
  EstimateCollectionJobRow,
  EstimateCollectionVersionRow,
} from '../server/estimate-collection/types'
import {
  QUOTE_HOME_FALLBACK_CUSTOMER_NAME,
  QUOTE_HOME_FALLBACK_JOB_TITLE,
  QUOTE_HOME_FALLBACK_VERSION_KIND,
  QUOTE_HOME_FALLBACK_VERSION_NAME,
  QUOTE_HOME_FALLBACK_VERSION_STATE,
  type EstimateCollectionDecoratedRow,
  type EstimateCollectionDecoratedRowInput,
  type EstimateCollectionRowRelations,
  type QuoteCreateJobReadModel,
  type QuoteHomeJobListItemReadModel,
  type QuoteHomeJobVersionItemReadModel,
  type QuoteHomeSearchResultReadModel,
  type QuoteListEstimate,
} from './quoteHomeTypes'

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

function asMoney(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function normalizeEstimateCollectionVersionState(value: string | null | undefined) {
  return value?.trim() || QUOTE_HOME_FALLBACK_VERSION_STATE
}

function isSentEstimateCollectionJob(job: EstimateCollectionJobRow | undefined) {
  if (!job) return false
  return job.status === 'estimate_sent' || job.status === 'follow_up'
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
