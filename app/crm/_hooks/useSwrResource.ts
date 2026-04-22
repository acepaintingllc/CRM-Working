'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR, { useSWRConfig, type MutatorOptions } from 'swr'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  getApiErrorMessage,
  parseApiResponse,
  type ApiReadMetaEnvelope,
} from '@/lib/client/api'

type Options<T> = {
  fallbackData?: T
  load?: () => Promise<T>
}

type Updater<T> = T | ((current: T) => T)

async function loadEnvelope<T>(url: string) {
  const response = await authedFetch(url)
  const parsed = await parseApiResponse<ApiReadMetaEnvelope<T>>(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(response, parsed))
  }

  if (!parsed.json || typeof parsed.json !== 'object' || !('data' in parsed.json)) {
    throw new Error('Malformed API response.')
  }

  return parsed.json
}

export function useSwrResource<T>(url: string | null, options: Options<T> = {}) {
  const { fallbackData, load } = options
  const { mutate: mutateCache } = useSWRConfig()
  const [errorOverride, setErrorOverride] = useState<string | null | undefined>(undefined)
  const fetcher = useCallback(
    async (key: string) => {
      if (load) {
        return { data: await load() }
      }
      return loadEnvelope<T>(key)
    },
    [load]
  )

  const resource = useSWR<ApiReadMetaEnvelope<T>>(url, fetcher, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    setErrorOverride(undefined)
  }, [url])

  const error = useMemo(() => {
    if (errorOverride !== undefined) return errorOverride
    if (!resource.error) return null
    return resource.error instanceof Error ? resource.error.message : 'Request failed.'
  }, [errorOverride, resource.error])

  const data = useMemo(() => {
    if (resource.data) return resource.data.data
    return fallbackData
  }, [fallbackData, resource.data])

  const setData = useCallback(
    (value: Updater<T>) => {
      if (!url) return

      void mutateCache(
        url,
        (current: ApiReadMetaEnvelope<T> | undefined) => {
          const base =
            current !== undefined
              ? current.data
              : fallbackData !== undefined
                ? fallbackData
                : (() => {
                    throw new Error('Cannot set SWR resource data before it has loaded.')
                  })()
          const nextData = typeof value === 'function' ? (value as (current: T) => T)(base) : value
          return { data: nextData }
        },
        { revalidate: false } satisfies MutatorOptions
      )
      setErrorOverride(undefined)
    },
    [fallbackData, mutateCache, url]
  )

  const refresh = useCallback(async () => {
    if (!url) return false
    setErrorOverride(undefined)

    try {
      const next = await resource.mutate()
      return Boolean(next)
    } catch (refreshError) {
      setErrorOverride(
        refreshError instanceof Error ? refreshError.message : 'Request failed.'
      )
      return false
    }
  }, [resource, url])

  const loading =
    Boolean(url) && !resource.data && !error && (resource.isLoading || resource.isValidating)

  return {
    data,
    loading,
    error,
    refresh,
    setData,
    setError: setErrorOverride,
  }
}
