import type {
  QuoteHomeJobsPageReadModel,
  QuoteHomeJobListItemReadModel,
} from '@/lib/quotes/collectionData'

export function normalizeQuoteHomeJobQuery(query: string) {
  return query.trim()
}

export type QuoteHomeSelectedJobState = {
  selectedJobId: string
  selectedJob: QuoteHomeJobListItemReadModel | null
}

export type QuoteHomeSelectionPolicyInput =
  | {
      event: 'initialize'
      jobs: QuoteHomeJobListItemReadModel[]
      selectedJobId: string | null | undefined
    }
  | {
      event: 'loaded_jobs_changed'
      jobs: QuoteHomeJobListItemReadModel[]
      currentSelection: QuoteHomeSelectedJobState
      jobQuery: string
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

export function resolveQuoteHomeSelectionAfterJobsLoaded(params: {
  jobs: QuoteHomeJobListItemReadModel[]
  currentSelection: QuoteHomeSelectedJobState
  jobQuery: string
}): QuoteHomeSelectedJobState {
  const selectedJob = params.jobs.find(
    (job) => job.id === params.currentSelection.selectedJobId
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

  return resolveQuoteHomeSelectedJob(params.jobs, params.currentSelection.selectedJobId)
}

export function resolveQuoteHomeManualSelection(params: {
  jobs: QuoteHomeJobListItemReadModel[]
  selectedJobId: string
}): QuoteHomeSelectedJobState {
  const selectedJob =
    params.jobs.find((job) => job.id === params.selectedJobId) ?? null

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

  return resolveQuoteHomeSelectionAfterJobsLoaded({
    jobs: input.jobs,
    currentSelection: input.currentSelection,
    jobQuery: input.jobQuery,
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
