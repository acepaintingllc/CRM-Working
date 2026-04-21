'use client'

import { useCallback, useEffect, useState } from 'react'

type SubmitPayloadResult<TPayload> =
  | { ok: true; payload: TPayload }
  | { ok: false; error: string }

type UseAsyncSubmitStateOptions<TValues, TPayload> = {
  initialValues: TValues
  prepareSubmit: (values: TValues) => SubmitPayloadResult<TPayload>
  onSubmit: (payload: TPayload) => Promise<void>
  getErrorMessage: (error: unknown) => string
}

export function useAsyncSubmitState<TValues, TPayload>({
  initialValues,
  prepareSubmit,
  onSubmit,
  getErrorMessage,
}: UseAsyncSubmitStateOptions<TValues, TPayload>) {
  const [values, setValues] = useState(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues(initialValues)
    setError(null)
  }, [initialValues])

  const submit = useCallback(async () => {
    setError(null)
    const prepared = prepareSubmit(values)
    if (!prepared.ok) {
      setError(prepared.error)
      return false
    }

    setSaving(true)
    try {
      await onSubmit(prepared.payload)
      return true
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError))
      return false
    } finally {
      setSaving(false)
    }
  }, [getErrorMessage, onSubmit, prepareSubmit, values])

  return {
    values,
    setValues,
    saving,
    error,
    setError,
    submit,
  }
}
