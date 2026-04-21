'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function readNotesError(payload: unknown, fallbackMessage: string) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error
  }
  return fallbackMessage
}

export async function notesFetchJson<T>(input: string, init: RequestInit | undefined, fallbackMessage: string) {
  try {
    const response = await authedFetch(input, init)
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false as const,
        data: null,
        payload,
        error: readNotesError(payload, fallbackMessage),
      }
    }

    return {
      ok: true as const,
      data: payload as T,
      payload,
      error: null,
    }
  } catch {
    return {
      ok: false as const,
      data: null,
      payload: null,
      error: fallbackMessage,
    }
  }
}

type UseNotesMutationOptions<T> = {
  fallbackMessage: string
  refresh?: (() => Promise<void> | void) | null
  refreshRoute?: boolean
  onSuccess?: ((data: T) => Promise<void> | void) | null
  onError?: ((message: string) => void) | null
}

export function useNotesMutation() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const runMutation = async <T>(request: () => Promise<Response>, options: UseNotesMutationOptions<T>) => {
    setSaving(true)
    try {
      const response = await request()
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = readNotesError(payload, options.fallbackMessage)
        options.onError?.(message)
        return { ok: false as const, data: null, payload, error: message }
      }

      const data = payload as T
      if (options.refresh) await options.refresh()
      if (options.refreshRoute) router.refresh()
      if (options.onSuccess) await options.onSuccess(data)
      return { ok: true as const, data, payload, error: null }
    } catch {
      const message = options.fallbackMessage
      options.onError?.(message)
      return { ok: false as const, data: null, payload: null, error: message }
    } finally {
      setSaving(false)
    }
  }

  return { saving, runMutation }
}
