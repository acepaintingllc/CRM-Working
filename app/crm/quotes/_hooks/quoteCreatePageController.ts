'use client'

import { useMemo } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import type { QuoteCreateJobContextReadModel } from '@/lib/quotes/collectionData'
import { loadQuoteCreateJobContext } from '@/lib/quotes/client'
import {
  buildQuoteCreatePageResource,
  EMPTY_QUOTE_CREATE_RESOURCE,
  type QuoteCreatePageResource,
} from './quoteCreatePagePolicy'
import { useQuoteVersionWorkflow } from './useQuoteVersionWorkflow'

type UseQuoteCreatePageControllerOptions = {
  jobId: string
}

function quoteCreatePageLoadErrorMessage(loadError: unknown) {
  return loadError instanceof Error
    ? loadError.message
    : 'Failed to load quote creation data.'
}

export function useQuoteCreatePageController({ jobId }: UseQuoteCreatePageControllerOptions) {
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
    getErrorMessage: quoteCreatePageLoadErrorMessage,
    reloadKey: jobId,
  })
  const workflow = useQuoteVersionWorkflow({
    jobId,
    selectedJob: resource.data.selectedJob,
    loading: resource.loading,
    blockCreateWhileVersionsLoading: true,
    onRefresh: resource.refresh,
  })

  const actions = useMemo(
    () => ({
      setVersionName: workflow.actions.setVersionName,
      setVersionKind: workflow.actions.setVersionKind,
      create: workflow.actions.create,
      retry: workflow.actions.refresh,
    }),
    [
      workflow.actions.create,
      workflow.actions.refresh,
      workflow.actions.setVersionKind,
      workflow.actions.setVersionName,
    ]
  )

  return {
    jobId,
    shouldLoadJobData,
    resource,
    workflow,
    actions,
  }
}

export type QuoteCreatePageController = ReturnType<typeof useQuoteCreatePageController>
