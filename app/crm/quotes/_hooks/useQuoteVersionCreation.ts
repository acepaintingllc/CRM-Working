'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { createQuoteVersion } from '@/lib/quotes/client'
import {
  buildCreateQuoteVersionInput,
  getQuoteWorkspaceHref,
  QUOTE_VERSION_CREATE_ERROR,
  QUOTE_VERSION_REQUIRED_JOB_ERROR,
  type EligibleQuoteVersionJob,
  type QuoteVersionKind,
} from '@/lib/quotes/versionCreation'

export function useQuoteVersionCreation(selectedJob: EligibleQuoteVersionJob | null) {
  const router = useRouter()
  const [versionName, setVersionName] = useState('')
  const [versionKind, setVersionKind] = useState<QuoteVersionKind>('standard')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createInFlightRef = useRef(false)

  async function createVersion() {
    if (createInFlightRef.current) {
      return null
    }

    if (!selectedJob) {
      setError(QUOTE_VERSION_REQUIRED_JOB_ERROR)
      return null
    }

    createInFlightRef.current = true
    setCreating(true)
    setError(null)

    try {
      const payload = await createQuoteVersion<{ id: string }>(
        buildCreateQuoteVersionInput(selectedJob, { versionKind, versionName })
      )
      router.push(getQuoteWorkspaceHref(payload.id))
      return payload
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : QUOTE_VERSION_CREATE_ERROR)
      return null
    } finally {
      createInFlightRef.current = false
      setCreating(false)
    }
  }

  return {
    creating,
    error,
    versionKind,
    versionName,
    setVersionKind,
    setVersionName,
    setError,
    createVersion,
  }
}
