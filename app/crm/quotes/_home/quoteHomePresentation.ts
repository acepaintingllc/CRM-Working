import type { HomeData, HomeEstimate, NavItem, SummaryCardVm } from './quoteHomeTypes'

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

export function formatCurrency(value: number | null | undefined) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatVersionState(value: string | null | undefined) {
  return String(value ?? 'draft')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function buildSearchHaystack(estimate: HomeEstimate) {
  return `${estimate.version_name} ${estimate.job_title} ${estimate.customer_name} ${estimate.version_kind} ${estimate.version_state}`.toLowerCase()
}

export function estimateWorkspaceHref(estimateId: string) {
  return `/crm/quotes/${estimateId}`
}

export function buildSummaryCards(data: HomeData | null): SummaryCardVm[] {
  const summary = data?.summary ?? {
    draft_count: 0,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 0,
  }

  return [
    {
      label: 'Drafts',
      value: String(summary.draft_count),
      subtext: summary.draft_count === 1 ? '1 draft version' : `${summary.draft_count} draft versions`,
    },
    {
      label: 'Sent / Awaiting',
      value: String(summary.sent_or_awaiting_count),
      subtext:
        summary.sent_or_awaiting_count === 1
          ? '1 version attached to sent jobs'
          : `${summary.sent_or_awaiting_count} versions attached to sent jobs`,
    },
    {
      label: 'Live Versions',
      value: String(summary.live_count),
      subtext: summary.live_count === 1 ? '1 live version' : `${summary.live_count} live versions`,
      valueColor: 'var(--v2-green-2)',
      subtextColor: 'var(--v2-green-2)',
    },
    {
      label: 'Pipeline',
      value: formatCurrency(summary.pipeline_total),
      subtext: 'Rollup-backed total',
      valueColor: '#f9e2b7',
      subtextColor: 'var(--v2-ink-3)',
    },
  ]
}
