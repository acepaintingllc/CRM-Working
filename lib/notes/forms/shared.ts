'use client'

import { useEffect, useMemo, useState } from 'react'

export type NotesFormSubmitResult<T> =
  | { ok: true; payload: T }
  | { ok: false; error: string }

export function mapNotesFormServerError(payload: unknown, fallbackMessage: string) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error
  }
  if (payload instanceof Error && payload.message) {
    return payload.message
  }
  return fallbackMessage
}

export function isNotesFormDirty<TValues>(values: TValues, snapshot: TValues) {
  return JSON.stringify(values) !== JSON.stringify(snapshot)
}

type UseNotesFormStateOptions<TValues, TPayload> = {
  initialValues: TValues
  prepareSubmit: (values: TValues) => NotesFormSubmitResult<TPayload>
  onSubmit: (payload: TPayload) => Promise<void>
  fallbackMessage: string
}

export function useNotesFormState<TValues, TPayload>({
  initialValues,
  prepareSubmit,
  onSubmit,
  fallbackMessage,
}: UseNotesFormStateOptions<TValues, TPayload>) {
  const [values, setValues] = useState(initialValues)
  const [snapshot, setSnapshot] = useState(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues(initialValues)
    setSnapshot(initialValues)
    setError(null)
  }, [initialValues])

  const dirty = useMemo(() => isNotesFormDirty(values, snapshot), [snapshot, values])

  const submit = async () => {
    setError(null)
    const prepared = prepareSubmit(values)
    if (!prepared.ok) {
      setError(prepared.error)
      return false
    }

    setSaving(true)
    try {
      await onSubmit(prepared.payload)
      setSnapshot(values)
      return true
    } catch (submitError) {
      setError(mapNotesFormServerError(submitError, fallbackMessage))
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    values,
    setValues,
    snapshot,
    setSnapshot,
    saving,
    error,
    setError,
    dirty,
    submit,
  }
}
