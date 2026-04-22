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

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const nextData = await loadRef.current()
      if (requestIdRef.current !== requestId) return false
      setData(nextData)
      return true
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return false
      if (resetOnError) {
        setData(initialData)
      }
      setError(getErrorMessageRef.current(loadError))
      return false
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [initialData, resetOnError])

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
  }
}
