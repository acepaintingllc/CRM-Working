'use client'

import { useState } from 'react'

export function useDenseQuoteAdminFeedback() {
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function clearFeedback() {
    setNotice(null)
    setActionError(null)
  }

  function setSuccessNotice(message: string | null) {
    setNotice(message)
    setActionError(null)
  }

  function setErrorMessage(message: string | null) {
    setActionError(message)
    setNotice(null)
  }

  function beginAction() {
    setSaving(true)
    clearFeedback()
  }

  function finishAction() {
    setSaving(false)
  }

  return {
    saving,
    notice,
    actionError,
    clearFeedback,
    setSuccessNotice,
    setErrorMessage,
    beginAction,
    finishAction,
  }
}
