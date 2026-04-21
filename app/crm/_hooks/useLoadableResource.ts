'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type LoadableResourceOptions<T> = {
  initialData: T
  load: () => Promise<T>
  getErrorMessage: (error: unknown) => string
  reloadKey?: unknown
}

export function useLoadableResource<T>({
  initialData,
  load,
  getErrorMessage,
  reloadKey,
}: LoadableResourceOptions<T>) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const loadRef = useRef(load)
  const errorMessageRef = useRef(getErrorMessage)

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    errorMessageRef.current = getErrorMessage
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
    } catch (loadError: unknown) {
      if (requestIdRef.current !== requestId) return false
      setData(initialData)
      setError(errorMessageRef.current(loadError))
      return false
    } finally {
      if (requestIdRef.current !== requestId) return false
      setLoading(false)
    }
  }, [initialData])

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
