'use client'

import { useState } from 'react'
import { type QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { deleteQuoteVersion } from '@/lib/quotes/client'

type Options = {
  refresh: () => Promise<boolean>
  setDeleteError: (value: string | null) => void
}

export function useQuotesHomeDelete(options?: Partial<Options>) {
  const refresh = options?.refresh ?? (async () => true)
  const externalSetDeleteError = options?.setDeleteError
  const [confirmingDelete, setConfirmingDelete] = useState<QuoteHomeJobVersionItemReadModel | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setDeleteError(value: string | null) {
    setError(value)
    externalSetDeleteError?.(value)
  }

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
    setDeleteError(null)

    try {
      await deleteQuoteVersion(deletedId)
      setConfirmingDelete(null)
      await refresh()
      return true
    } catch (deleteError) {
      setDeleteError(deleteError instanceof Error ? deleteError.message : 'Failed to delete quote.')
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
