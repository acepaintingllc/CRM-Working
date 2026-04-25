import type { EstimateCollectionSearchDbRows, EstimateCollectionVersionRow } from '../server/estimate-collection/types'
import {
  QUOTE_HOME_SEARCH_SOURCE_RANK,
  type QuoteHomeSearchCandidate,
  type QuoteHomeSearchRows,
} from './quoteHomeTypes'

function asTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
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
