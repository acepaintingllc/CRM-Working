'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import type { JobSummary } from '@/lib/jobs/client'
import { fetchJobList } from '@/lib/jobs/client'
import type { QuoteListEstimate } from '@/lib/quotes/collectionData'
import { loadQuoteList } from '@/lib/quotes/client'
import {
  deriveQuoteVersionsForJob,
  filterEligibleQuoteVersionJobs,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'
import { QUOTE_META_SEPARATOR } from '../_home/quoteHomePresentation'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'

type QuoteCreatePageJob = EligibleQuoteVersionJob<JobSummary>

type QuoteCreateResource = {
  jobs: QuoteCreatePageJob[]
  estimates: QuoteListEstimate[]
}

const EMPTY_RESOURCE: QuoteCreateResource = {
  jobs: [],
  estimates: [],
}

export function useQuoteCreatePage() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job') ?? ''
  const resource = useLoadableResource<QuoteCreateResource>({
    initialData: EMPTY_RESOURCE,
    reloadKey: jobId,
    load: async () => {
      if (!jobId) {
        return EMPTY_RESOURCE
      }

      const [jobsPayload, estimatesPayload] = await Promise.all([
        fetchJobList(),
        loadQuoteList<{ estimates?: QuoteListEstimate[] }>(),
      ])

      return {
        jobs: filterEligibleQuoteVersionJobs(jobsPayload),
        estimates: (estimatesPayload?.estimates ?? []) as QuoteListEstimate[],
      }
    },
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote creation data.',
  })

  const selectedJob = useMemo(
    () => resource.data.jobs.find((candidate) => candidate.id === jobId) ?? null,
    [resource.data.jobs, jobId]
  )
  const createController = useQuoteVersionCreation(selectedJob)
  const jobVersions = useMemo(
    () => deriveQuoteVersionsForJob(resource.data.estimates, jobId),
    [resource.data.estimates, jobId]
  )
  const pageError = resource.error ?? createController.error

  return {
    feedbackVm: {
      loading: resource.loading,
      error: pageError,
      loadError: resource.error,
      hasLoadedJobData: Boolean(jobId) && (resource.data.jobs.length > 0 || resource.data.estimates.length > 0),
      shouldLoadJobData: Boolean(jobId),
    },
    selectedJobVm: {
      jobId,
      title: resource.loading ? '...' : selectedJob?.title ?? 'Unknown job',
      customerLine: selectedJob
        ? `${selectedJob.customer_name ?? 'Unknown customer'}${
            selectedJob.customer_address ? `${QUOTE_META_SEPARATOR}${selectedJob.customer_address}` : ''
          }`
        : null,
      jobHref: selectedJob ? `/crm/jobs/${selectedJob.id}` : null,
      hasJob: Boolean(selectedJob),
    },
    versionsVm: {
      items: jobVersions,
      hasVersions: jobVersions.length > 0,
    },
    createVm: {
      versionName: createController.versionName,
      versionKind: createController.versionKind,
      creating: createController.creating,
      canCreate: Boolean(selectedJob) && !createController.creating && !resource.loading,
    },
    actions: {
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      createVersion: createController.createVersion,
      retry: resource.refresh,
    },
  }
}
