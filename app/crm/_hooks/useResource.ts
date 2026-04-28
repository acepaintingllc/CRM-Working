'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type UseResourceOptions<T> = {
  initialData: T
  load: () => Promise<T>
  getErrorMessage: (error: unknown) => string
  reloadKey?: unknown
  resetOnError?: boolean
  initialLoading?: boolean
  skipInitialLoad?: boolean
}

export function useResource<T>({
  initialData,
  load,
  getErrorMessage,
  reloadKey,
  resetOnError = true,
  initialLoading = true,
  skipInitialLoad = false,
}: UseResourceOptions<T>) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(initialLoading)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const loadRef = useRef(load)
  const getErrorMessageRef = useRef(getErrorMessage)
  const initialDataRef = useRef(initialData)
  const skipInitialLoadRef = useRef(skipInitialLoad)
  const resetOnErrorRef = useRef(resetOnError)

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    getErrorMessageRef.current = getErrorMessage
  }, [getErrorMessage])

  useEffect(() => {
    initialDataRef.current = initialData
  }, [initialData])

  useEffect(() => {
    resetOnErrorRef.current = resetOnError
  }, [resetOnError])

  const attemptRefresh = useCallback(
    async (options?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      const requestId = ++requestIdRef.current
      const preserveDataOnError = options?.preserveDataOnError ?? false
      const reportError = options?.reportError ?? true

      setLoading(true)
      if (reportError) {
        setError(null)
      }

      try {
        const nextData = await loadRef.current()
        if (requestIdRef.current !== requestId) {
          return { ok: false, error: null, data: null as T | null }
        }
        setData(nextData)
        if (reportError) {
          setError(null)
        }
        return { ok: true, error: null, data: nextData }
      } catch (loadError) {
        if (requestIdRef.current !== requestId) {
          return { ok: false, error: null, data: null as T | null }
        }

        const nextError = getErrorMessageRef.current(loadError)
        if (resetOnErrorRef.current && !preserveDataOnError) {
          setData(initialDataRef.current)
        }
        if (reportError) {
          setError(nextError)
        }
        return { ok: false, error: nextError, data: null as T | null }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    []
  )

  const refresh = useCallback(async () => {
    const result = await attemptRefresh()
    return result.ok
  }, [attemptRefresh])

  useEffect(() => {
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false
      return
    }
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
