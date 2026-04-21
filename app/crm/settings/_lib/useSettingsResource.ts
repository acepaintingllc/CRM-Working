'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SaveResult<TData> = {
  data: TData
  notice?: string
}

type Params<TData> = {
  initialData: TData
  load: () => Promise<TData>
  save: (data: TData) => Promise<SaveResult<TData>>
  getErrorMessage?: (error: unknown) => string
}

function stringify(value: unknown) {
  return JSON.stringify(value)
}

function defaultErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed.'
}

export function useSettingsResource<TData>({
  initialData,
  load,
  save,
  getErrorMessage = defaultErrorMessage,
}: Params<TData>) {
  const [data, setDataState] = useState(initialData)
  const [snapshot, setSnapshot] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const requestIdRef = useRef(0)

  const replaceData = useCallback((next: TData | ((current: TData) => TData)) => {
    setNotice(null)
    setDataState((current) =>
      typeof next === 'function' ? (next as (value: TData) => TData)(current) : next
    )
  }, [])

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const next = await load()
      if (requestId !== requestIdRef.current) return
      setDataState(next)
      setSnapshot(next)
      setError(null)
      setNotice(null)
      setHasLoaded(true)
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(loadError))
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [getErrorMessage, load])

  useEffect(() => {
    void reload()
    return () => {
      requestIdRef.current += 1
    }
  }, [reload])

  const saveChanges = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const result = await save(data)
      setDataState(result.data)
      setSnapshot(result.data)
      setError(null)
      setNotice(result.notice ?? 'Saved.')
      setHasLoaded(true)
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }, [data, getErrorMessage, save, saving])

  const dirty = useMemo(
    () => stringify(data) !== stringify(snapshot),
    [data, snapshot]
  )

  return {
    data,
    setData: replaceData,
    loading,
    saving,
    error,
    notice,
    dirty,
    hasLoaded,
    reload,
    saveChanges,
  }
}
