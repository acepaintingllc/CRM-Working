import type { QuoteHomeJobVersionItemReadModel } from './quoteHomeTypes'
import type { EstimateV2EstimateMeta, EstimateV2JobMeta } from '@/types/estimator/v2'

export const lastOpenedQuoteStorageKey = 'acecrm.quotes.lastOpened'

export type LastOpenedQuoteRecord = QuoteHomeJobVersionItemReadModel & {
  opened_at: string
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function buildLastOpenedQuoteRecord(params: {
  estimate: EstimateV2EstimateMeta | null | undefined
  job: EstimateV2JobMeta | null | undefined
  openedAt?: string
}): LastOpenedQuoteRecord | null {
  const estimateId = asText(params.estimate?.id)
  const jobId = asText(params.estimate?.job_id) ?? asText(params.job?.id)
  if (!estimateId || !jobId) return null

  return {
    estimate_id: estimateId,
    job_id: jobId,
    customer_id: asText(params.job?.customer_id) ?? '',
    version_name: asText(params.estimate?.version_name) ?? 'Quote Version',
    version_state: asText(params.estimate?.version_state) ?? 'draft',
    version_kind: asText(params.estimate?.version_kind) ?? 'standard',
    version_sort_order: 0,
    job_title: asText(params.job?.title) ?? 'Untitled job',
    customer_name: asText(params.job?.customer_name) ?? 'Unknown customer',
    final_total: null,
    updated_at: params.estimate?.updated_at ?? null,
    created_at: null,
    is_sent_estimate: false,
    opened_at: params.openedAt ?? new Date().toISOString(),
  }
}

export function readLastOpenedQuote(storage: Pick<Storage, 'getItem'>): LastOpenedQuoteRecord | null {
  try {
    const parsed = JSON.parse(storage.getItem(lastOpenedQuoteStorageKey) ?? 'null') as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Partial<LastOpenedQuoteRecord>
    const estimateId = asText(record.estimate_id)
    const jobId = asText(record.job_id)
    if (!estimateId || !jobId) return null

    return {
      estimate_id: estimateId,
      job_id: jobId,
      customer_id: asText(record.customer_id) ?? '',
      version_name: asText(record.version_name) ?? 'Quote Version',
      version_state: asText(record.version_state) ?? 'draft',
      version_kind: asText(record.version_kind) ?? 'standard',
      version_sort_order: Number.isFinite(Number(record.version_sort_order))
        ? Number(record.version_sort_order)
        : 0,
      job_title: asText(record.job_title) ?? 'Untitled job',
      customer_name: asText(record.customer_name) ?? 'Unknown customer',
      final_total:
        record.final_total == null
          ? null
          : Number.isFinite(Number(record.final_total))
            ? Number(record.final_total)
            : null,
      updated_at: asText(record.updated_at),
      created_at: asText(record.created_at),
      is_sent_estimate: record.is_sent_estimate === true,
      opened_at: asText(record.opened_at) ?? new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function writeLastOpenedQuote(
  storage: Pick<Storage, 'setItem'>,
  record: LastOpenedQuoteRecord
) {
  storage.setItem(lastOpenedQuoteStorageKey, JSON.stringify(record))
}
