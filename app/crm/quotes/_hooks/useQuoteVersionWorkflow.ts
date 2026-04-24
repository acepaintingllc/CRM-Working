'use client'

import { useEffect } from 'react'
import type { EligibleQuoteVersionJob } from '@/lib/quotes/versionCreation'
import type { QuoteJobVersionsPageReadModel } from '@/lib/quotes/collectionData'
import { useQuoteJobVersions } from './useQuoteJobVersions'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'

type UseQuoteVersionWorkflowOptions = {
  jobId: string
  selectedJob: EligibleQuoteVersionJob | null
  loading?: boolean
  blockCreateWhileVersionsLoading?: boolean
  onRefresh?: (() => Promise<unknown>) | null
  initialVersions?: QuoteJobVersionsPageReadModel | null
}

export function useQuoteVersionWorkflow({
  jobId,
  selectedJob,
  loading = false,
  blockCreateWhileVersionsLoading = false,
  onRefresh = null,
  initialVersions = null,
}: UseQuoteVersionWorkflowOptions) {
  const versions = useQuoteJobVersions(jobId, {
    enabled: Boolean(jobId),
    initialData: initialVersions,
  })
  const createController = useQuoteVersionCreation(selectedJob)
  const { setError, setVersionKind, setVersionName } = createController

  useEffect(() => {
    setVersionName('')
    setVersionKind('standard')
    setError(null)
  }, [jobId, setError, setVersionKind, setVersionName])

  const refresh = async () => {
    const [contextResult, versionsResult] = await Promise.all([
      onRefresh ? onRefresh() : Promise.resolve(true),
      versions.refresh(),
    ])

    return Boolean(contextResult && versionsResult)
  }

  return {
    hasJobContext: Boolean(jobId),
    hasSelectedJob: Boolean(selectedJob),
    versions,
    create: {
      ...createController,
      canCreate:
        Boolean(selectedJob) &&
        !createController.creating &&
        !loading &&
        (!blockCreateWhileVersionsLoading || !versions.loading),
    },
    actions: {
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      create: createController.createVersion,
      refresh,
      refreshVersions: versions.refresh,
    },
  }
}
