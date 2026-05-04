'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SaveResult<TData> = {
  data: TData
  notice?: string
  error?: string | null
}

type UseEditableResourceParams<TData> = {
  initialData: TData
  load: () => Promise<TData>
  save: (data: TData) => Promise<SaveResult<TData>>
  getErrorMessage?: (error: unknown) => string
  isDirty?: (current: TData, snapshot: TData) => boolean
  resetOnLoadError?: boolean
}

type SaveActionOptions = {
  trackSaving?: boolean
}

type SaveActionResult<TData> = {
  ok: boolean
  data: TData | null
  error: string | null
}

function defaultErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed.'
}

function stableStringify(value: unknown) {
  return JSON.stringify(value)
}

function defaultIsDirty<TData>(current: TData, snapshot: TData) {
  // Small forms can rely on the generic stringify fallback.
  // Dense editors should pass an explicit comparator or canonical snapshot helper.
  return stableStringify(current) !== stableStringify(snapshot)
}

export function useEditableResource<TData>({
  initialData,
  load,
  save,
  getErrorMessage = defaultErrorMessage,
  isDirty = defaultIsDirty,
  resetOnLoadError = false,
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
  const initialDataRef = useRef(initialData)
  const resetOnLoadErrorRef = useRef(resetOnLoadError)

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    saveRef.current = save
  }, [save])

  useEffect(() => {
    getErrorMessageRef.current = getErrorMessage
  }, [getErrorMessage])

  useEffect(() => {
    initialDataRef.current = initialData
  }, [initialData])

  useEffect(() => {
    resetOnLoadErrorRef.current = resetOnLoadError
  }, [resetOnLoadError])

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
      if (requestIdRef.current !== requestId) {
        return { ok: false, error: null, data: null as TData | null }
      }
      setDataState(nextData)
      setSnapshot(nextData)
      setError(null)
      setNotice(null)
      setHasLoaded(true)
      return { ok: true, error: null, data: nextData }
    } catch (loadError) {
      if (requestIdRef.current !== requestId) {
        return { ok: false, error: null, data: null as TData | null }
      }
      const nextError = getErrorMessageRef.current(loadError)
      if (resetOnLoadErrorRef.current) {
        setDataState(initialDataRef.current)
        setSnapshot(initialDataRef.current)
      }
      setError(nextError)
      return { ok: false, error: nextError, data: null as TData | null }
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

  const runSaveAction = useCallback(
    async (
      action?: (current: TData) => Promise<SaveResult<TData>>,
      options?: SaveActionOptions
    ): Promise<SaveActionResult<TData>> => {
      const trackSaving = options?.trackSaving ?? true
      if (trackSaving && saving) {
        return { ok: false, data: null, error: null }
      }

      if (trackSaving) {
        setSaving(true)
      }
      setError(null)
      setNotice(null)
      try {
        const result = await (action ?? saveRef.current)(data)
        const nextError = result.error ?? null
        setDataState(result.data)
        setSnapshot(result.data)
        setError(nextError)
        setNotice(result.notice ?? 'Saved.')
        setHasLoaded(true)
        return { ok: !nextError, data: result.data, error: nextError }
      } catch (saveError) {
        const nextError = getErrorMessageRef.current(saveError)
        setError(nextError)
        return { ok: false, data: null, error: nextError }
      } finally {
        if (trackSaving) {
          setSaving(false)
        }
      }
    },
    [data, saving]
  )

  const saveChanges = useCallback(() => runSaveAction(), [runSaveAction])

  const clearFeedback = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const dirty = useMemo(() => isDirty(data, snapshot), [data, isDirty, snapshot])

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
    runSaveAction,
    saveChanges,
    setError,
    setNotice,
    clearFeedback,
  }
}
