import type { QuoteHomeSummaryReadModel } from '@/lib/quotes/quoteHomeTypes'
import type { SummaryCardVm } from './quoteHomeTypes'
import { formatCurrency } from './quoteHomeSharedPresentation'

export const QUOTES_HOME_SUMMARY_LOADING_VALUE = '...'
export const QUOTES_HOME_SUMMARY_DEFAULT_VALUE_COLOR = 'var(--v2-ink)'
export const QUOTES_HOME_SUMMARY_DEFAULT_SUBTEXT_COLOR = 'var(--v2-ink-3)'

export function buildSummaryCards(
  summary: QuoteHomeSummaryReadModel | null,
): SummaryCardVm[] {
  const nextSummary = summary ?? {
    draft_count: 0,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 0,
  }

  return [
    {
      label: 'Drafts',
      value: String(nextSummary.draft_count),
      displayValue: String(nextSummary.draft_count),
      subtext:
        nextSummary.draft_count === 1
          ? '1 draft version'
          : `${nextSummary.draft_count} draft versions`,
      valueColor: QUOTES_HOME_SUMMARY_DEFAULT_VALUE_COLOR,
      subtextColor: QUOTES_HOME_SUMMARY_DEFAULT_SUBTEXT_COLOR,
    },
    {
      label: 'Sent / Awaiting',
      value: String(nextSummary.sent_or_awaiting_count),
      displayValue: String(nextSummary.sent_or_awaiting_count),
      subtext:
        nextSummary.sent_or_awaiting_count === 1
          ? '1 version attached to sent jobs'
          : `${nextSummary.sent_or_awaiting_count} versions attached to sent jobs`,
      valueColor: QUOTES_HOME_SUMMARY_DEFAULT_VALUE_COLOR,
      subtextColor: QUOTES_HOME_SUMMARY_DEFAULT_SUBTEXT_COLOR,
    },
    {
      label: 'Live Versions',
      value: String(nextSummary.live_count),
      displayValue: String(nextSummary.live_count),
      subtext:
        nextSummary.live_count === 1
          ? '1 live version'
          : `${nextSummary.live_count} live versions`,
      valueColor: 'var(--v2-green-2)',
      subtextColor: 'var(--v2-green-2)',
    },
    {
      label: 'Pipeline',
      value: formatCurrency(nextSummary.pipeline_total),
      displayValue: formatCurrency(nextSummary.pipeline_total),
      subtext: 'Rollup-backed total',
      valueColor: 'var(--v2-amber)',
      subtextColor: 'var(--v2-ink-3)',
    },
  ]
}
