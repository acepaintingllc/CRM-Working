'use client'

import { useState } from 'react'
import { type QuoteHomeEstimate } from '@/lib/quotes/collectionData'
import { deleteQuoteVersion } from '@/lib/quotes/client'

type Options = {
  refresh: () => Promise<boolean>
  setError: (value: string | null) => void
}

export function useQuotesHomeDelete({ refresh, setError }: Options) {
  const [confirmingDelete, setConfirmingDelete] = useState<QuoteHomeEstimate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function requestDeleteVersion(estimate: QuoteHomeEstimate) {
    setConfirmingDelete(estimate)
  }

  function cancelDelete() {
    if (deletingId) return
    setConfirmingDelete(null)
  }

  async function confirmDeleteVersion() {
    if (!confirmingDelete) return

    const deletedId = confirmingDelete.estimate_id
    setDeletingId(deletedId)
    setError(null)

    try {
      await deleteQuoteVersion(deletedId)
      setConfirmingDelete(null)
      await refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete quote.')
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
