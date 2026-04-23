'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { loadJobRecord, type JobDetail } from '@/lib/jobs/client'
import type {
  QuoteHomeJobVersionItemReadModel,
  QuoteJobVersionsReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteJobVersions } from '@/lib/quotes/client'
import {
  isEligibleQuoteVersionJob,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'
import { QUOTE_META_SEPARATOR } from '../_home/quoteHomePresentation'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'

type QuoteCreatePageJob = EligibleQuoteVersionJob<JobDetail>

type QuoteCreateResource = {
  job: QuoteCreatePageJob | null
  versions: QuoteHomeJobVersionItemReadModel[]
}

const EMPTY_RESOURCE: QuoteCreateResource = {
  job: null,
  versions: [],
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

      const [jobPayload, versionsPayload] = await Promise.all([
        loadJobRecord(jobId),
        loadQuoteJobVersions<QuoteJobVersionsReadModel>(jobId),
      ])

      return {
        job: isEligibleQuoteVersionJob(jobPayload) ? jobPayload : null,
        versions: versionsPayload.items,
      }
    },
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote creation data.',
  })

  const selectedJob = useMemo(() => resource.data.job, [resource.data.job])
  const createController = useQuoteVersionCreation(selectedJob)
  const jobVersions = useMemo(() => resource.data.versions, [resource.data.versions])
  const pageError = resource.error ?? createController.error

  return {
    feedbackVm: {
      loading: resource.loading,
      error: pageError,
      loadError: resource.error,
      hasLoadedJobData: Boolean(jobId) && (Boolean(resource.data.job) || resource.data.versions.length > 0),
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
