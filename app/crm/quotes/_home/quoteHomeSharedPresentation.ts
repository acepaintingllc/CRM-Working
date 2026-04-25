export const QUOTE_META_SEPARATOR = ' \u00B7 '

export const QUOTES_HOME_LOADING_COPY = {
  jobs: 'Loading jobs...',
  jobSearch: 'No jobs match this search.',
  jobRetry: 'Retry jobs',
  jobRetrying: 'Retrying jobs...',
  versionsRetry: 'Retry versions',
  versionsRetrying: 'Retrying versions...',
  versionsLoadMore: 'Load more versions',
  versionsLoadingMore: 'Loading more versions...',
  jobsLoadMore: 'Load more jobs',
  jobsLoadingMore: 'Loading more jobs...',
} as const

export const QUOTES_HOME_PAGE_COPY = {
  header: {
    eyebrow: 'Quotes',
    title: 'Quote Home',
    description:
      'Search jobs, review quote versions, and start a new quote from one place.',
    badge: 'Shared CRM shell',
    createJobAction: 'Create job',
    newQuoteAction: 'New quote',
  },
} as const

export function formatVersionCount(value: number) {
  return `${value} version${value === 1 ? '' : 's'}`
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

export function estimateWorkspaceHref(estimateId: string) {
  return `/crm/quotes/${estimateId}`
}
