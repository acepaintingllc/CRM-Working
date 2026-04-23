'use client'

import { useState } from 'react'
import { type QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { deleteQuoteVersion } from '@/lib/quotes/client'

type Options = {
  refresh: () => Promise<boolean>
  setError: (value: string | null) => void
}

export function useQuotesHomeDelete({ refresh, setError }: Options) {
  const [confirmingDelete, setConfirmingDelete] = useState<QuoteHomeJobVersionItemReadModel | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function requestDeleteVersion(estimate: QuoteHomeJobVersionItemReadModel) {
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
      await refresh()
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
    requestDeleteVersion,
    cancelDelete,
    confirmDeleteVersion,
  }
}
