'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type UseResourceOptions<T> = {
  initialData: T
  load: () => Promise<T>
  getErrorMessage: (error: unknown) => string
  reloadKey?: unknown
  resetOnError?: boolean
}

export function useResource<T>({
  initialData,
  load,
  getErrorMessage,
  reloadKey,
  resetOnError = true,
}: UseResourceOptions<T>) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const loadRef = useRef(load)
  const getErrorMessageRef = useRef(getErrorMessage)

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    getErrorMessageRef.current = getErrorMessage
  }, [getErrorMessage])

  const attemptRefresh = useCallback(
    async (options?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      const requestId = ++requestIdRef.current
      setLoading(true)
      if (options?.reportError ?? true) {
        setError(null)
      }

      try {
        const nextData = await loadRef.current()
        if (requestIdRef.current !== requestId) return { ok: false, error: null, data: null as T | null }
        setData(nextData)
        return { ok: true, error: null, data: nextData }
      } catch (loadError) {
        if (requestIdRef.current !== requestId) return { ok: false, error: null, data: null as T | null }
        if (resetOnError && !(options?.preserveDataOnError ?? false)) {
          setData(initialData)
        }
        const nextError = getErrorMessageRef.current(loadError)
        if (options?.reportError ?? true) {
          setError(nextError)
        }
        return { ok: false, error: nextError, data: null as T | null }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    [initialData, resetOnError]
  )

  const refresh = useCallback(async () => {
    const result = await attemptRefresh()
    return result.ok
  }, [attemptRefresh])

  useEffect(() => {
    void refresh()
  }, [refresh, reloadKey])

  return {
    data,
    setData,
    loading,
    error,
    setError,
    refresh,
    attemptRefresh,
  }
}
