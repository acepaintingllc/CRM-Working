'use client'

import { useCallback, useRef, useState } from 'react'

type UseEntityDetailActionsParams = {
  deleteMessage: string
  deleteAction: () => Promise<boolean>
  confirmDelete?: (message: string) => boolean
  copyDurationMs?: number
}

export function useEntityDetailActions({
  deleteMessage,
  deleteAction,
  confirmDelete = (message: string) => window.confirm(message),
  copyDurationMs = 1200,
}: UseEntityDetailActionsParams) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const clearStatus = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setStatusMessage(null)
  }, [])

  const setTimedStatus = useCallback(
    (value: string) => {
      clearStatus()
      setStatusMessage(value)
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        setStatusMessage(null)
      }, copyDurationMs)
    },
    [clearStatus, copyDurationMs]
  )

  const copyValue = useCallback(
    async (label: string, value: string | null | undefined) => {
      if (!value) return false
      try {
        await navigator.clipboard.writeText(value)
      } catch {
        const el = document.createElement('textarea')
        el.value = value
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setTimedStatus(`${label} copied`)
      return true
    },
    [setTimedStatus]
  )

  const confirmAndDelete = useCallback(async () => {
    const ok = confirmDelete(deleteMessage)
    if (!ok) return false
    clearStatus()
    return deleteAction()
  }, [clearStatus, confirmDelete, deleteAction, deleteMessage])

  return {
    statusMessage,
    setStatusMessage,
    clearStatus,
    copyValue,
    confirmAndDelete,
  }
}
