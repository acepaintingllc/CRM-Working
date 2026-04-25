import { normalizeQuoteHomeSearchQuery } from '@/lib/quotes/quoteHomeCursors'
import type { QuoteHomeSummaryReadModel } from '@/lib/quotes/quoteHomeTypes'
import type {
  NavItem,
  QuoteHomeSearchResult,
  QuotesHomeSearchStatusVm,
  SearchResultVm,
} from './quoteHomeTypes'
import {
  estimateWorkspaceHref,
  formatVersionState,
  QUOTE_META_SEPARATOR,
} from './quoteHomeSharedPresentation'

export const SETTINGS_LINKS: NavItem[] = [
  { label: 'Defaults', href: '/crm/quotes/defaults' },
  { label: 'Products', href: '/crm/quotes/products' },
  { label: 'Rates & Flags', href: '/crm/quotes/rates' },
  { label: 'Settings', href: '/crm/settings' },
]

export function formatToday() {
  const now = new Date()
  return now
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .replace(',', ' /')
    .toUpperCase()
}

export function buildSearchResultVm(
  estimate: QuoteHomeSearchResult,
): SearchResultVm {
  return {
    id: estimate.estimate_id,
    href: estimateWorkspaceHref(estimate.estimate_id),
    title: estimate.version_name,
    meta: `${estimate.job_title}\n${estimate.customer_name} / ${formatVersionState(estimate.version_state)}`,
  }
}

export function buildQuotesHomeSearchEmptyMessage(params: {
  query: string
  loading: boolean
  error: string | null
  resultCount: number
}) {
  if (!params.query || params.loading || params.error || params.resultCount > 0) {
    return null
  }

  return `No quote versions match "${params.query}".`
}

export function buildQuotesHomeSearchCanRetry(params: {
  query: string
  loading: boolean
}) {
  return Boolean(params.query) && !params.loading
}

export function buildQuotesHomeSearchStatus(params: {
  query: string
  loading: boolean
  error: string | null
  resultCount: number
}): QuotesHomeSearchStatusVm {
  const query = normalizeQuoteHomeSearchQuery(params.query)
  if (!query) return { kind: 'idle' }

  if (params.loading) {
    return {
      kind: 'loading',
      title: 'Searching quote versions',
      message: `Looking up versions that match "${query}".`,
    }
  }

  if (params.error) {
    return {
      kind: 'error',
      title: 'Search results failed to load',
      message: params.error,
      canRetry: buildQuotesHomeSearchCanRetry({
        query,
        loading: params.loading,
      }),
    }
  }

  if (params.resultCount === 0) {
    return {
      kind: 'empty',
      title: 'No matching quote versions',
      message: `No quote versions match "${query}".`,
    }
  }

  return { kind: 'results' }
}

export function buildQuotesHomeHeaderSearchStatus(params: {
  query: string
  loading: boolean
  errorMessage: string | null
  emptyMessage: string | null
  resultCount: number
  canRetry: boolean
}): QuotesHomeSearchStatusVm {
  const query = normalizeQuoteHomeSearchQuery(params.query)
  if (!query) return { kind: 'idle' }
  if (params.loading) {
    return {
      kind: 'loading',
      title: 'Searching quote versions',
      message: `Looking up versions that match "${query}".`,
    }
  }
  if (params.errorMessage) {
    return {
      kind: 'error',
      title: 'Search results failed to load',
      message: params.errorMessage,
      canRetry: params.canRetry,
    }
  }
  if (params.emptyMessage) {
    return {
      kind: 'empty',
      title: 'No matching quote versions',
      message: params.emptyMessage,
    }
  }
  return params.resultCount > 0 ? { kind: 'results' } : { kind: 'idle' }
}

export function buildHeroSummaryText(
  summary: QuoteHomeSummaryReadModel | null,
) {
  return summary
    ? `${summary.total_versions} total versions${QUOTE_META_SEPARATOR}${summary.draft_count} drafts${QUOTE_META_SEPARATOR}${summary.sent_or_awaiting_count} sent/awaiting${QUOTE_META_SEPARATOR}${summary.live_count} live`
    : 'Build and track quote versions with live status, totals, and search.'
}
