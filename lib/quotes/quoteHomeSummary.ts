import type { EstimateCollectionSummaryDbRow } from '../server/estimate-collection/types'
import {
  QUOTE_HOME_FALLBACK_VERSION_STATE,
  type EstimateCollectionDecoratedRowInput,
  type QuoteCreateJobContextReadModel,
  type QuoteHomeBootstrapReadModel,
  type QuoteHomeJobListItemReadModel,
  type QuoteHomeJobVersionItemReadModel,
  type QuoteHomeJobsPageReadModel,
  type QuoteHomeSearchResponse,
  type QuoteHomeSummaryReadModel,
  type QuoteJobVersionsPageReadModel,
} from './quoteHomeTypes'
import {
  toQuoteCreateJobReadModel,
  toQuoteHomeJobVersionItem,
  toQuoteHomeSearchResultReadModel,
  toQuoteListEstimate,
} from './quoteHomeMappers'
import type { EstimateCollectionJobContextDbRow } from '../server/estimate-collection/types'

function asRequiredText(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  return text || fallback
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function asPipelineTotal(value: unknown): number {
  const amount = asNullableNumber(value)
  if (amount == null || amount < 0) return 0
  return amount
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
  latestVersion: QuoteHomeJobVersionItemReadModel | null
}): QuoteHomeBootstrapReadModel {
  const firstJobId = asRequiredText(params.jobs.items[0]?.id, '')

  return {
    summary: params.summary,
    jobs: params.jobs,
    selected_job_id:
      asRequiredText(params.selectedJobVersions?.job_id, firstJobId) || null,
    selected_job_versions: params.selectedJobVersions,
    latest_version: params.latestVersion,
  }
}

export function buildQuoteHomeLatestVersionReadModel(
  rows: EstimateCollectionDecoratedRowInput[]
): QuoteHomeJobVersionItemReadModel | null {
  return rows.map(toQuoteHomeJobVersionItem)[0] ?? null
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
