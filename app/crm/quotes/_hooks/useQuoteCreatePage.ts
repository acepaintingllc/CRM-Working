'use client'

import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import { loadJobRecord } from '@/lib/jobs/client'
import type {
  QuoteHomeJobVersionItemReadModel,
  QuoteJobVersionsReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteJobVersions } from '@/lib/quotes/client'
import { QUOTE_META_SEPARATOR } from '../_home/quoteHomePresentation'
import {
  buildQuoteCreatePageResource,
  EMPTY_QUOTE_CREATE_RESOURCE,
  type QuoteCreatePageResource,
} from './quoteCreatePagePolicy'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'

export function useQuoteCreatePage() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job') ?? ''
  const resource = useLoadableResource<QuoteCreatePageResource>({
    initialData: EMPTY_QUOTE_CREATE_RESOURCE,
    load: async () => {
      if (!jobId) {
        return EMPTY_QUOTE_CREATE_RESOURCE
      }

      const [jobPayload, versionsPayload] = await Promise.all([
        loadJobRecord(jobId),
        loadQuoteJobVersions<QuoteJobVersionsReadModel>(jobId),
      ])

      return jobPayload
        ? buildQuoteCreatePageResource(jobPayload, versionsPayload)
        : EMPTY_QUOTE_CREATE_RESOURCE
    },
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote creation data.',
    reloadKey: jobId,
  })
  const selectedJob = useMemo(() => resource.data.job, [resource.data.job])
  const createController = useQuoteVersionCreation(selectedJob)
  const jobVersions = useMemo(
    () => resource.data.versions as QuoteHomeJobVersionItemReadModel[],
    [resource.data.versions]
  )

  useEffect(() => {
    createController.setVersionName('')
    createController.setVersionKind('standard')
    createController.setError(null)
  }, [selectedJob?.id])

  const shouldLoadJobData = Boolean(jobId)
  const hasLoadedJobData = shouldLoadJobData && (Boolean(resource.data.job) || resource.data.versions.length > 0)
  const status = buildQuoteAdminPageStatus({
    loading: resource.loading && shouldLoadJobData,
    hasData: hasLoadedJobData,
    loadError: resource.error,
    actionError: createController.error,
    canRetry: shouldLoadJobData && !resource.loading,
  })

  return {
    feedback: {
      ...status,
      hasLoadedJobData,
      shouldLoadJobData,
    },
    job: {
      jobId,
      title: resource.loading && shouldLoadJobData ? '...' : selectedJob?.title ?? 'Unknown job',
      customerLine: selectedJob
        ? `${selectedJob.customer_name ?? 'Unknown customer'}${
            selectedJob.customer_address ? `${QUOTE_META_SEPARATOR}${selectedJob.customer_address}` : ''
          }`
        : null,
      jobHref: selectedJob ? `/crm/jobs/${selectedJob.id}` : null,
      hasJob: Boolean(selectedJob),
    },
    versions: {
      items: jobVersions,
      hasVersions: jobVersions.length > 0,
    },
    create: {
      versionName: createController.versionName,
      versionKind: createController.versionKind,
      creating: createController.creating,
      canCreate: Boolean(selectedJob) && !createController.creating && !resource.loading,
    },
    actions: {
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      create: createController.createVersion,
      retry: resource.refresh,
    },
  }
}
