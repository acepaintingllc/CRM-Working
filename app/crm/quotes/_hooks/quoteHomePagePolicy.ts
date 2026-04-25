import { normalizeQuoteHomeJobQuery } from '@/lib/quotes/quoteHomeCursors'
import type {
  QuoteHomeJobsPageReadModel,
  QuoteHomeJobListItemReadModel,
} from '@/lib/quotes/quoteHomeTypes'

export type QuoteHomeSelectedJobState = {
  selectedJobId: string
  selectedJob: QuoteHomeJobListItemReadModel | null
}

export type QuoteHomeLoadedJobsChangeKind = 'jobs_replaced' | 'jobs_appended'

export type QuoteHomeSelectionPolicyInput =
  | {
      event: 'initialize'
      jobs: QuoteHomeJobListItemReadModel[]
      selectedJobId: string | null | undefined
    }
  | {
      event: 'bootstrap_jobs_loaded'
      jobs: QuoteHomeJobListItemReadModel[]
      currentSelection: QuoteHomeSelectedJobState
      selectedJobId: string | null | undefined
    }
  | {
      event: 'jobs_replaced'
      jobs: QuoteHomeJobListItemReadModel[]
      currentSelection: QuoteHomeSelectedJobState
      jobQuery: string
      preferredSelectedJobId?: string | null | undefined
    }
  | {
      event: 'jobs_appended'
      jobs: QuoteHomeJobListItemReadModel[]
      currentSelection: QuoteHomeSelectedJobState
    }
  | {
      event: 'manual_select'
      jobs: QuoteHomeJobListItemReadModel[]
      selectedJobId: string
    }

export type QuoteHomeJobsBootstrapSyncDecision =
  | {
      action: 'adopt_bootstrap_jobs'
      jobsPage: QuoteHomeJobsPageReadModel
    }
  | {
      action: 'keep_active_jobs'
      reason: 'bootstrap_query_mismatch'
    }

export type QuoteHomeJobsQuerySyncDecision =
  | {
      action: 'keep_current_jobs'
      reason: 'query_already_loaded'
    }
  | {
      action: 'load_query_jobs'
      query: string
    }

export type QuoteHomeJobsRefreshDecision =
  | {
      action: 'adopt_bootstrap_jobs'
      jobsPage: QuoteHomeJobsPageReadModel
    }
  | {
      action: 'load_active_query_jobs'
      query: string
    }

export type QuoteHomeJobsPageMergeMode = 'replace' | 'append'

export type QuoteHomeJobsRequestPurpose = 'query_change' | 'refresh' | 'pagination'

export type QuoteHomeJobsPageRequest = {
  requestId: number
  query: string
  purpose: QuoteHomeJobsRequestPurpose
  reportError: boolean
}

export type QuoteHomeJobsLoadMoreDecision =
  | {
      action: 'load_next_jobs_page'
      query: string
      cursor: string
    }
  | {
      action: 'skip_load_more'
      reason: 'jobs_request_in_flight' | 'no_next_cursor'
    }

export type QuoteHomeJobsPageState = {
  jobsPage: QuoteHomeJobsPageReadModel
  activeRequest: QuoteHomeJobsPageRequest | null
  error: string | null
}

export type QuoteHomeJobsPageAction =
  | {
      type: 'adopt_bootstrap_jobs'
      jobsPage: QuoteHomeJobsPageReadModel
    }
  | {
      type: 'request_started'
      request: QuoteHomeJobsPageRequest
    }
  | {
      type: 'request_succeeded'
      request: QuoteHomeJobsPageRequest
      loadedJobsPage: QuoteHomeJobsPageReadModel
      mergeMode: QuoteHomeJobsPageMergeMode
    }
  | {
      type: 'request_failed'
      request: QuoteHomeJobsPageRequest
      error: string
    }
  | {
      type: 'request_finished'
      request: QuoteHomeJobsPageRequest
    }
  | {
      type: 'request_cancelled'
    }

export function resolveQuoteHomeSelectedJobId(
  jobs: QuoteHomeJobListItemReadModel[],
  currentJobId: string
) {
  if (currentJobId && jobs.some((job) => job.id === currentJobId)) {
    return currentJobId
  }

  return jobs[0]?.id ?? ''
}

export function resolveQuoteHomeSelectedJob(
  jobs: QuoteHomeJobListItemReadModel[],
  currentJobId: string | null | undefined
): QuoteHomeSelectedJobState {
  const selectedJobId = resolveQuoteHomeSelectedJobId(jobs, currentJobId ?? '')
  return {
    selectedJobId,
    selectedJob: jobs.find((job) => job.id === selectedJobId) ?? null,
  }
}

function findQuoteHomeJobById(
  jobs: QuoteHomeJobListItemReadModel[],
  selectedJobId: string | null | undefined
) {
  return jobs.find((job) => job.id === selectedJobId) ?? null
}

function isQuoteHomeJobsPageAppend(params: {
  previousJobs: QuoteHomeJobListItemReadModel[]
  jobs: QuoteHomeJobListItemReadModel[]
}) {
  if (params.previousJobs.length === 0) {
    return false
  }

  if (params.jobs.length <= params.previousJobs.length) {
    return false
  }

  return params.previousJobs.every(
    (previousJob, index) => params.jobs[index]?.id === previousJob.id
  )
}

export function resolveQuoteHomeLoadedJobsChangeKind(params: {
  previousJobs: QuoteHomeJobListItemReadModel[]
  previousJobQuery: string
  jobs: QuoteHomeJobListItemReadModel[]
  jobQuery: string
}): QuoteHomeLoadedJobsChangeKind {
  if (
    normalizeQuoteHomeJobQuery(params.previousJobQuery) !==
    normalizeQuoteHomeJobQuery(params.jobQuery)
  ) {
    return 'jobs_replaced'
  }

  return isQuoteHomeJobsPageAppend({
    previousJobs: params.previousJobs,
    jobs: params.jobs,
  })
    ? 'jobs_appended'
    : 'jobs_replaced'
}

export function resolveQuoteHomeSelectionAfterBootstrapJobsLoaded(params: {
  jobs: QuoteHomeJobListItemReadModel[]
  currentSelection: QuoteHomeSelectedJobState
  selectedJobId: string | null | undefined
}): QuoteHomeSelectedJobState {
  const selectedJob = findQuoteHomeJobById(
    params.jobs,
    params.currentSelection.selectedJobId
  )

  if (selectedJob) {
    return {
      selectedJobId: selectedJob.id,
      selectedJob,
    }
  }

  return resolveQuoteHomeSelectedJob(params.jobs, params.selectedJobId)
}

export function resolveQuoteHomeSelectionAfterJobsReplaced(params: {
  jobs: QuoteHomeJobListItemReadModel[]
  currentSelection: QuoteHomeSelectedJobState
  jobQuery: string
  preferredSelectedJobId?: string | null | undefined
}): QuoteHomeSelectedJobState {
  const selectedJob = findQuoteHomeJobById(
    params.jobs,
    params.currentSelection.selectedJobId
  )

  if (selectedJob) {
    return {
      selectedJobId: selectedJob.id,
      selectedJob,
    }
  }

  if (
    normalizeQuoteHomeJobQuery(params.jobQuery) &&
    params.currentSelection.selectedJobId &&
    params.currentSelection.selectedJob
  ) {
    return params.currentSelection
  }

  if (!params.currentSelection.selectedJobId && params.preferredSelectedJobId) {
    return resolveQuoteHomeSelectedJob(params.jobs, params.preferredSelectedJobId)
  }

  return resolveQuoteHomeSelectedJob(params.jobs, params.currentSelection.selectedJobId)
}

export function resolveQuoteHomeSelectionAfterJobsAppended(params: {
  jobs: QuoteHomeJobListItemReadModel[]
  currentSelection: QuoteHomeSelectedJobState
}): QuoteHomeSelectedJobState {
  const selectedJob = findQuoteHomeJobById(
    params.jobs,
    params.currentSelection.selectedJobId
  )

  if (selectedJob) {
    return {
      selectedJobId: selectedJob.id,
      selectedJob,
    }
  }

  if (params.currentSelection.selectedJobId && params.currentSelection.selectedJob) {
    return params.currentSelection
  }

  return resolveQuoteHomeSelectedJob(params.jobs, params.currentSelection.selectedJobId)
}

export function resolveQuoteHomeManualSelection(params: {
  jobs: QuoteHomeJobListItemReadModel[]
  selectedJobId: string
}): QuoteHomeSelectedJobState {
  const selectedJob = findQuoteHomeJobById(params.jobs, params.selectedJobId)

  return {
    selectedJobId: selectedJob?.id ?? '',
    selectedJob,
  }
}

export function resolveQuoteHomeSelection(
  input: QuoteHomeSelectionPolicyInput
): QuoteHomeSelectedJobState {
  if (input.event === 'initialize') {
    return resolveQuoteHomeSelectedJob(input.jobs, input.selectedJobId)
  }

  if (input.event === 'manual_select') {
    return resolveQuoteHomeManualSelection({
      jobs: input.jobs,
      selectedJobId: input.selectedJobId,
    })
  }

  if (input.event === 'bootstrap_jobs_loaded') {
    return resolveQuoteHomeSelectionAfterBootstrapJobsLoaded({
      jobs: input.jobs,
      currentSelection: input.currentSelection,
      selectedJobId: input.selectedJobId,
    })
  }

  if (input.event === 'jobs_appended') {
    return resolveQuoteHomeSelectionAfterJobsAppended({
      jobs: input.jobs,
      currentSelection: input.currentSelection,
    })
  }

  return resolveQuoteHomeSelectionAfterJobsReplaced({
    jobs: input.jobs,
    currentSelection: input.currentSelection,
    jobQuery: input.jobQuery,
    preferredSelectedJobId: input.preferredSelectedJobId,
  })
}

export function resolveQuoteHomeBootstrapJobsSync(params: {
  activeJobQuery: string
  bootstrapJobsPage: QuoteHomeJobsPageReadModel
}): QuoteHomeJobsBootstrapSyncDecision {
  if (
    normalizeQuoteHomeJobQuery(params.bootstrapJobsPage.query) !==
    normalizeQuoteHomeJobQuery(params.activeJobQuery)
  ) {
    return {
      action: 'keep_active_jobs',
      reason: 'bootstrap_query_mismatch',
    }
  }

  return {
    action: 'adopt_bootstrap_jobs',
    jobsPage: params.bootstrapJobsPage,
  }
}

export function resolveQuoteHomeQueryJobsSync(params: {
  activeJobQuery: string
  currentJobsPage: QuoteHomeJobsPageReadModel
}): QuoteHomeJobsQuerySyncDecision {
  const activeJobQuery = normalizeQuoteHomeJobQuery(params.activeJobQuery)
  if (activeJobQuery === normalizeQuoteHomeJobQuery(params.currentJobsPage.query)) {
    return {
      action: 'keep_current_jobs',
      reason: 'query_already_loaded',
    }
  }

  return {
    action: 'load_query_jobs',
    query: activeJobQuery,
  }
}

export function resolveQuoteHomeJobsRefresh(params: {
  activeJobQuery: string
  refreshedBootstrapJobsPage: QuoteHomeJobsPageReadModel
}): QuoteHomeJobsRefreshDecision {
  const bootstrapSync = resolveQuoteHomeBootstrapJobsSync({
    activeJobQuery: params.activeJobQuery,
    bootstrapJobsPage: params.refreshedBootstrapJobsPage,
  })

  if (bootstrapSync.action === 'adopt_bootstrap_jobs') {
    return bootstrapSync
  }

  return {
    action: 'load_active_query_jobs',
    query: normalizeQuoteHomeJobQuery(params.activeJobQuery),
  }
}

export function resolveQuoteHomeJobsPageAfterRequest(params: {
  currentJobsPage: QuoteHomeJobsPageReadModel
  loadedJobsPage: QuoteHomeJobsPageReadModel
  mergeMode: QuoteHomeJobsPageMergeMode
}): QuoteHomeJobsPageReadModel {
  if (params.mergeMode === 'replace') {
    return params.loadedJobsPage
  }

  const existingIds = new Set(params.currentJobsPage.items.map((job) => job.id))
  return {
    ...params.loadedJobsPage,
    items: [
      ...params.currentJobsPage.items,
      ...params.loadedJobsPage.items.filter((job) => !existingIds.has(job.id)),
    ],
  }
}

export function createQuoteHomeJobsPageState(
  jobsPage: QuoteHomeJobsPageReadModel
): QuoteHomeJobsPageState {
  return {
    jobsPage,
    activeRequest: null,
    error: null,
  }
}

function isQuoteHomeJobsPageRequestActive(
  state: QuoteHomeJobsPageState,
  request: QuoteHomeJobsPageRequest
) {
  return (
    state.activeRequest?.requestId === request.requestId &&
    normalizeQuoteHomeJobQuery(state.activeRequest.query) ===
      normalizeQuoteHomeJobQuery(request.query)
  )
}

export function reduceQuoteHomeJobsPageState(
  state: QuoteHomeJobsPageState,
  action: QuoteHomeJobsPageAction
): QuoteHomeJobsPageState {
  if (action.type === 'adopt_bootstrap_jobs') {
    return {
      jobsPage: action.jobsPage,
      activeRequest: null,
      error: null,
    }
  }

  if (action.type === 'request_cancelled') {
    return {
      ...state,
      activeRequest: null,
      error: null,
    }
  }

  if (action.type === 'request_started') {
    return {
      ...state,
      activeRequest: {
        ...action.request,
        query: normalizeQuoteHomeJobQuery(action.request.query),
      },
      error: action.request.reportError ? null : state.error,
    }
  }

  if (!isQuoteHomeJobsPageRequestActive(state, action.request)) {
    return state
  }

  if (action.type === 'request_succeeded') {
    return {
      ...state,
      jobsPage: resolveQuoteHomeJobsPageAfterRequest({
        currentJobsPage: state.jobsPage,
        loadedJobsPage: action.loadedJobsPage,
        mergeMode: action.mergeMode,
      }),
      error: action.request.reportError ? null : state.error,
    }
  }

  if (action.type === 'request_failed') {
    return {
      ...state,
      error: action.request.reportError ? action.error : state.error,
    }
  }

  return {
    ...state,
    activeRequest: null,
  }
}

export function resolveQuoteHomeLoadMoreJobs(params: {
  currentJobsPage: QuoteHomeJobsPageReadModel
  jobsRequestInFlight: boolean
}): QuoteHomeJobsLoadMoreDecision {
  if (params.jobsRequestInFlight) {
    return {
      action: 'skip_load_more',
      reason: 'jobs_request_in_flight',
    }
  }

  const cursor = params.currentJobsPage.next_cursor
  if (!cursor) {
    return {
      action: 'skip_load_more',
      reason: 'no_next_cursor',
    }
  }

  return {
    action: 'load_next_jobs_page',
    query: normalizeQuoteHomeJobQuery(params.currentJobsPage.query),
    cursor,
  }
}
