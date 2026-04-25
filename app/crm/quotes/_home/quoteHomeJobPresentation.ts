import type {
  QuoteHomeJob,
  QuoteHomeJobListItemVm,
  QuotesHomeJobListVm,
  QuotesHomeSelectedJobVm,
} from './quoteHomeTypes'
import {
  formatVersionState,
  QUOTE_META_SEPARATOR,
  QUOTES_HOME_LOADING_COPY,
} from './quoteHomeSharedPresentation'

export const QUOTES_HOME_JOB_LIST_NO_JOBS_BODY =
  'Quote creation starts from a job with a linked customer. Add the contact first, then create the job in the normal CRM flow.'

export function buildQuoteHomeJobListItemVm(
  job: QuoteHomeJob,
  versionCount: number,
  options?: { selectedJobId?: string },
): QuoteHomeJobListItemVm {
  return {
    id: job.id,
    title: job.title,
    customerName: job.customer_name ?? 'Unknown customer',
    versionCountLabel: `${versionCount} version${versionCount === 1 ? '' : 's'}`,
    isSelected: options?.selectedJobId === job.id,
  }
}

export function buildQuotesHomeJobListEmptyState(params: {
  hasLoadError: boolean
  totalJobCount: number
  visibleJobCount: number
}): 'none' | 'no_jobs' | 'no_matches' {
  if (params.hasLoadError) return 'none'
  if (params.totalJobCount === 0) return 'no_jobs'
  if (params.visibleJobCount === 0) return 'no_matches'
  return 'none'
}

export function buildQuotesHomeJobListEmptyStateBody(
  emptyState: 'none' | 'no_jobs' | 'no_matches',
) {
  return emptyState === 'no_jobs' ? QUOTES_HOME_JOB_LIST_NO_JOBS_BODY : null
}

export function buildQuotesHomeJobListStatus(params: {
  loading: boolean
  errorMessage: string | null
  canRetry: boolean
  emptyState: QuotesHomeJobListVm['emptyState']
  emptyStateBody: string | null
}): NonNullable<QuotesHomeJobListVm['status']> {
  if (params.loading) {
    return {
      kind: 'loading',
      message: QUOTES_HOME_LOADING_COPY.jobs,
    }
  }

  if (params.errorMessage) {
    return {
      kind: 'error',
      title: 'Jobs failed to load',
      message: params.errorMessage,
      canRetry: params.canRetry,
      retryLabel: QUOTES_HOME_LOADING_COPY.jobRetry,
      retryingLabel: QUOTES_HOME_LOADING_COPY.jobRetrying,
    }
  }

  if (params.emptyState === 'no_jobs') {
    return {
      kind: 'empty',
      emptyState: 'no_jobs',
      title: 'No eligible jobs yet',
      body: params.emptyStateBody,
    }
  }

  if (params.emptyState === 'no_matches') {
    return {
      kind: 'empty',
      emptyState: 'no_matches',
      title: QUOTES_HOME_LOADING_COPY.jobSearch,
      body: null,
    }
  }

  return { kind: 'ready' }
}

export function buildQuotesHomeJobListStatusFromVm(
  vm: QuotesHomeJobListVm,
): NonNullable<QuotesHomeJobListVm['status']> {
  return buildQuotesHomeJobListStatus({
    loading: vm.loading,
    errorMessage: vm.errorMessage,
    canRetry: vm.canRetry,
    emptyState: vm.emptyState,
    emptyStateBody: vm.emptyStateBody,
  })
}

export function buildQuotesHomeSelectedJobVm(
  selectedJob: QuoteHomeJob | null,
  selectedJobVersionsCount: number,
  loading: boolean,
): QuotesHomeSelectedJobVm {
  if (!selectedJob) {
    return {
      loading,
      state: loading ? 'loading' : 'empty',
      emptyMessage: loading
        ? null
        : 'Select a job from the left to view versions and create the next one.',
      title: null,
      customerLine: null,
      jobHref: null,
      stats: [],
    }
  }

  return {
    loading,
    state: 'selected',
    emptyMessage: null,
    title: selectedJob.title,
    customerLine: `${selectedJob.customer_name ?? 'Unknown customer'}${
      selectedJob.customer_address
        ? `${QUOTE_META_SEPARATOR}${selectedJob.customer_address}`
        : ''
    }`,
    jobHref: `/crm/jobs/${selectedJob.id}`,
    stats: [
      { label: 'Customer', value: selectedJob.customer_name ?? 'Unknown' },
      { label: 'Job Status', value: formatVersionState(selectedJob.status) },
      { label: 'Versions', value: String(selectedJobVersionsCount) },
    ],
  }
}
