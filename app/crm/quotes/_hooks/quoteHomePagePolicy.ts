import type { QuoteHomeJobListItemReadModel } from '@/lib/quotes/collectionData'

export function normalizeQuoteHomeJobQuery(query: string) {
  return query.trim()
}

export type QuoteHomeSelectedJobState = {
  selectedJobId: string
  selectedJob: QuoteHomeJobListItemReadModel | null
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
  currentJobId: string
): QuoteHomeSelectedJobState {
  const selectedJobId = resolveQuoteHomeSelectedJobId(jobs, currentJobId)
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
