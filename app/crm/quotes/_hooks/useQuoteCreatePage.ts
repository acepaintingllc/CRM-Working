'use client'

import { useSearchParams } from 'next/navigation'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import type { QuoteCreateJobContextReadModel } from '@/lib/quotes/collectionData'
import { loadQuoteCreateJobContext } from '@/lib/quotes/client'
import { QUOTE_META_SEPARATOR } from '../_home/quoteHomePresentation'
import {
  buildQuoteCreatePageResource,
  EMPTY_QUOTE_CREATE_RESOURCE,
  type QuoteCreatePageResource,
} from './quoteCreatePagePolicy'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'

export function useQuoteCreatePage() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job') ?? ''
  const shouldLoadJobData = Boolean(jobId)
  const resource = useLoadableResource<QuoteCreatePageResource>({
    initialData: EMPTY_QUOTE_CREATE_RESOURCE,
    load: async () => {
      if (!jobId) {
        return EMPTY_QUOTE_CREATE_RESOURCE
      }

      const jobPayload = await loadQuoteCreateJobContext<QuoteCreateJobContextReadModel>(jobId)

      return buildQuoteCreatePageResource(jobPayload)
    },
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote creation data.',
    reloadKey: jobId,
  })
  const jobContext = resource.data.job
  const selectedJob = resource.data.selectedJob
  const workflow = useQuoteVersionWorkflow({
    jobId,
    selectedJob,
    loading: resource.loading,
    blockCreateWhileVersionsLoading: true,
    onRefresh: resource.refresh,
  })
  const jobVersions = workflow.versions.items
  const hasLoadedJobData = shouldLoadJobData && (Boolean(jobContext) || jobVersions.length > 0)
  const loadError = resource.error ?? workflow.versions.error
  const loading = shouldLoadJobData && !loadError && (resource.loading || workflow.versions.loading)
  const status = buildQuoteAdminPageStatus({
    loading,
    hasData: hasLoadedJobData,
    loadError,
    actionError: workflow.create.error,
    canRetry: shouldLoadJobData && !loading,
  })

  return {
    feedback: {
      ...status,
      hasLoadedJobData,
      shouldLoadJobData,
    },
    job: {
      jobId,
      title: resource.loading && shouldLoadJobData ? '...' : jobContext?.title ?? 'Unknown job',
      customerLine: jobContext
        ? `${jobContext.customer_name ?? 'No customer assigned'}${
            jobContext.customer_address ? `${QUOTE_META_SEPARATOR}${jobContext.customer_address}` : ''
          }`
        : null,
      jobHref: jobContext ? `/crm/jobs/${jobContext.id}` : null,
      hasJob: Boolean(jobContext),
      isEligible: Boolean(selectedJob),
    },
    versions: {
      items: jobVersions,
      hasVersions: jobVersions.length > 0,
    },
    create: {
      versionName: workflow.create.versionName,
      versionKind: workflow.create.versionKind,
      creating: workflow.create.creating,
      canCreate: workflow.create.canCreate,
    },
    actions: {
      setVersionName: workflow.actions.setVersionName,
      setVersionKind: workflow.actions.setVersionKind,
      create: workflow.actions.create,
      retry: workflow.actions.refresh,
    },
  }
}
