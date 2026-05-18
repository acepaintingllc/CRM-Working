'use client'

import { useEffect, useRef, useState } from 'react'
import { createQuoteVersion } from '@/lib/quotes/client'
import {
  prepareCreateQuoteVersionInput,
  QUOTE_VERSION_CREATE_ERROR,
  type EligibleQuoteVersionJob,
  type QuoteVersionKind,
} from '@/lib/quotes/versionCreation'

type UseQuoteVersionCreationOptions = {
  resetKey?: string
}

export function useQuoteVersionCreation(
  selectedJob: EligibleQuoteVersionJob | null,
  options?: UseQuoteVersionCreationOptions
) {
  const resetKey = options?.resetKey ?? selectedJob?.id ?? ''
  const [versionName, setVersionName] = useState('')
  const [versionKind, setVersionKind] = useState<QuoteVersionKind>('standard')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createInFlightRef = useRef(false)
  const resetKeyRef = useRef(resetKey)

  useEffect(() => {
    resetKeyRef.current = resetKey
  }, [resetKey])

  useEffect(() => {
    setVersionName('')
    setVersionKind('standard')
    setError(null)
  }, [resetKey])

  async function createVersion() {
    if (createInFlightRef.current) {
      return null
    }

    const createResetKey = resetKey
    const inputResult = prepareCreateQuoteVersionInput(selectedJob, {
      versionKind,
      versionName,
    })

    if (!inputResult.ok) {
      setError(inputResult.error)
      return null
    }

    createInFlightRef.current = true
    setCreating(true)
    setError(null)

    try {
      const payload = await createQuoteVersion<{ id: string }>(
        inputResult.input
      )
      return payload
    } catch (createError) {
      if (resetKeyRef.current === createResetKey) {
        setError(createError instanceof Error ? createError.message : QUOTE_VERSION_CREATE_ERROR)
      }
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
