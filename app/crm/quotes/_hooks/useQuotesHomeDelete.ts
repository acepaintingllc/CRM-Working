'use client'

import { useCallback, useState } from 'react'
import { type QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'

export function useQuotesHomeDelete() {
  const [confirmingDelete, setConfirmingDelete] = useState<QuoteHomeJobVersionItemReadModel | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestDeleteVersion = useCallback((estimate: QuoteHomeJobVersionItemReadModel) => {
    setError(null)
    setConfirmingDelete(estimate)
  }, [])

  const cancelDelete = useCallback(() => {
    if (deletingId) return false
    setError(null)
    setConfirmingDelete(null)
    return true
  }, [deletingId])

  const beginDelete = useCallback(() => {
    if (deletingId || !confirmingDelete) return null

    setDeletingId(confirmingDelete.estimate_id)
    setError(null)
    return confirmingDelete
  }, [confirmingDelete, deletingId])

  const completeDelete = useCallback(() => {
    setConfirmingDelete(null)
    setDeletingId(null)
    setError(null)
  }, [])

  const failDelete = useCallback((message: string) => {
    setError(message)
    setDeletingId(null)
  }, [])

  return {
    confirmingDelete,
    deletingId,
    error,
    requestDeleteVersion,
    cancelDelete,
    beginDelete,
    completeDelete,
    failDelete,
  }
}
