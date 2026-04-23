'use client'

import { useState } from 'react'
import { type QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { deleteQuoteVersion } from '@/lib/quotes/client'

export function useQuotesHomeDelete() {
  const [confirmingDelete, setConfirmingDelete] = useState<QuoteHomeJobVersionItemReadModel | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function requestDeleteVersion(estimate: QuoteHomeJobVersionItemReadModel) {
    setError(null)
    setConfirmingDelete(estimate)
  }

  function cancelDelete() {
    if (deletingId) return
    setConfirmingDelete(null)
  }

  async function confirmDeleteVersion() {
    if (!confirmingDelete) return false

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
  }

  return {
    confirmingDelete,
    deletingId,
    error,
    requestDeleteVersion,
    cancelDelete,
    confirmDeleteVersion,
  }
}
