'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import type { QuoteCreateJobContextReadModel } from '@/lib/quotes/quoteHomeTypes'
import { loadQuoteCreateJobContext } from '@/lib/quotes/client'
import { getQuoteWorkspaceHref } from '@/lib/quotes/versionCreation'
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
  const { push } = useRouter()
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
  const workflowActions = workflow.actions
  const createAndNavigate = useCallback(async () => {
    const created = await workflowActions.create()
    if (created) {
      push(getQuoteWorkspaceHref(created.id))
    }
    return created
  }, [push, workflowActions])

  const actions = useMemo(
    () => ({
      setVersionName: workflowActions.setVersionName,
      setVersionKind: workflowActions.setVersionKind,
      create: createAndNavigate,
      retry: workflowActions.refresh,
    }),
    [createAndNavigate, workflowActions]
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
