'use client'

import { useCallback } from 'react'

import { useSwrResource } from '@/app/crm/_hooks/useSwrResource'
import { loadJobRecord } from '@/lib/jobs/client'
import type { JobDetail } from '@/types/jobs/api'

export function getJobDetailResourceKey(jobId: string | null | undefined) {
  return typeof jobId === 'string' && jobId ? `/api/jobs/${jobId}` : null
}

export function useJobDetailResource(jobId: string | null | undefined) {
  const jobKey = getJobDetailResourceKey(jobId)
  const load = useCallback(() => {
    if (!jobId) return Promise.resolve(null)
    return loadJobRecord(jobId)
  }, [jobId])

  return {
    key: jobKey,
    resource: useSwrResource<JobDetail | null>(jobKey, {
      fallbackData: null,
      load,
    }),
  }
}
