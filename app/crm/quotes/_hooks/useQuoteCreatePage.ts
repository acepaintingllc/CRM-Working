'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { buildQuoteAdminPageFeedback } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
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
  const requestIdRef = useRef(0)
  const [resource, setResource] = useState<QuoteCreatePageResource>(EMPTY_QUOTE_CREATE_RESOURCE)
  const [loading, setLoading] = useState(Boolean(jobId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const selectedJob = useMemo(() => resource.job, [resource.job])
  const createController = useQuoteVersionCreation(selectedJob)
  const jobVersions = useMemo(
    () => resource.versions as QuoteHomeJobVersionItemReadModel[],
    [resource.versions]
  )

  useEffect(() => {
    createController.setVersionName('')
    createController.setVersionKind('standard')
    createController.setError(null)
  }, [selectedJob?.id])

  const refresh = async () => {
    if (!jobId) {
      setResource(EMPTY_QUOTE_CREATE_RESOURCE)
      setLoading(false)
      setLoadError(null)
      return false
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    setLoadError(null)

    try {
      const [jobPayload, versionsPayload] = await Promise.all([
        loadJobRecord(jobId),
        loadQuoteJobVersions<QuoteJobVersionsReadModel>(jobId),
      ])
      if (requestIdRef.current !== requestId) return false

      setResource(
        jobPayload
          ? buildQuoteCreatePageResource(jobPayload, versionsPayload)
          : EMPTY_QUOTE_CREATE_RESOURCE
      )
      return true
    } catch (nextLoadError) {
      if (requestIdRef.current !== requestId) return false
      setResource(EMPTY_QUOTE_CREATE_RESOURCE)
      setLoadError(
        nextLoadError instanceof Error
          ? nextLoadError.message
          : 'Failed to load quote creation data.'
      )
      return false
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void refresh()
  }, [jobId])

  const feedback = buildQuoteAdminPageFeedback({
    loading,
    loadError,
    actionError: createController.error,
  })

  return {
    feedback: {
      ...feedback,
      hasLoadedJobData: Boolean(jobId) && (Boolean(resource.job) || resource.versions.length > 0),
      shouldLoadJobData: Boolean(jobId),
    },
    job: {
      jobId,
      title: loading ? '...' : selectedJob?.title ?? 'Unknown job',
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
      canCreate: Boolean(selectedJob) && !createController.creating && !loading,
    },
    actions: {
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      create: createController.createVersion,
      retry: refresh,
    },
  }
}
