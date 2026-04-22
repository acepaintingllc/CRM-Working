'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SaveResult<TData> = {
  data: TData
  notice?: string
}

type UseEditableResourceParams<TData> = {
  initialData: TData
  load: () => Promise<TData>
  save: (data: TData) => Promise<SaveResult<TData>>
  getErrorMessage?: (error: unknown) => string
}

function defaultErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed.'
}

function stableStringify(value: unknown) {
  return JSON.stringify(value)
}

export function useEditableResource<TData>({
  initialData,
  load,
  save,
  getErrorMessage = defaultErrorMessage,
}: UseEditableResourceParams<TData>) {
  const [data, setDataState] = useState(initialData)
  const [snapshot, setSnapshot] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const requestIdRef = useRef(0)
  const loadRef = useRef(load)
  const saveRef = useRef(save)
  const getErrorMessageRef = useRef(getErrorMessage)

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    saveRef.current = save
  }, [save])

  useEffect(() => {
    getErrorMessageRef.current = getErrorMessage
  }, [getErrorMessage])

  const setData = useCallback((next: TData | ((current: TData) => TData)) => {
    setNotice(null)
    setDataState((current) =>
      typeof next === 'function' ? (next as (value: TData) => TData)(current) : next
    )
  }, [])

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)

    try {
      const nextData = await loadRef.current()
      if (requestIdRef.current !== requestId) return
      setDataState(nextData)
      setSnapshot(nextData)
      setError(null)
      setNotice(null)
      setHasLoaded(true)
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return
      setError(getErrorMessageRef.current(loadError))
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [])

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
      const result = await saveRef.current(data)
      setDataState(result.data)
      setSnapshot(result.data)
      setError(null)
      setNotice(result.notice ?? 'Saved.')
      setHasLoaded(true)
    } catch (saveError) {
      setError(getErrorMessageRef.current(saveError))
    } finally {
      setSaving(false)
    }
  }, [data, saving])

  const dirty = useMemo(
    () => stableStringify(data) !== stableStringify(snapshot),
    [data, snapshot]
  )

  return {
    data,
    setData,
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
