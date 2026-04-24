'use client'

import { useCallback, useState } from 'react'
import { type QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { deleteQuoteVersion } from '@/lib/quotes/client'

export function useQuotesHomeDelete() {
  const [confirmingDelete, setConfirmingDelete] = useState<QuoteHomeJobVersionItemReadModel | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestDeleteVersion = useCallback((estimate: QuoteHomeJobVersionItemReadModel) => {
    setError(null)
    setConfirmingDelete(estimate)
  }, [])

  const cancelDelete = useCallback(() => {
    if (deletingId) return
    setError(null)
    setConfirmingDelete(null)
  }, [deletingId])

  const confirmDeleteVersion = useCallback(async () => {
    if (deletingId || !confirmingDelete) return false

    const deletedId = confirmingDelete.estimate_id
    setDeletingId(deletedId)
    setError(null)

    try {
      await deleteQuoteVersion(deletedId)
      setConfirmingDelete(null)
      return true
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete quote.')
      return false
    } finally {
      setDeletingId(null)
    }
  }, [confirmingDelete, deletingId])

  return {
    confirmingDelete,
    deletingId,
    error,
    requestDeleteVersion,
    cancelDelete,
    confirmDeleteVersion,
  }
}
