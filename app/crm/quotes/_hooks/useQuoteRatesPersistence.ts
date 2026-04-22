'use client'

import { useState } from 'react'
import { mutateRatesFlags } from '@/lib/quotes/client'
import type { RatesFlagsMutationAction } from '@/types/estimator/ratesFlags'

type Options = {
  categoryKey: string | null
  refresh: (keepId?: string) => Promise<boolean>
}

export function useQuoteRatesPersistence({ categoryKey, refresh }: Options) {
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function persist(
    action: RatesFlagsMutationAction,
    values: Record<string, unknown>,
    originalId?: string
  ) {
    if (!categoryKey) return false
    setSaving(true)
    setNotice(null)
    setActionError(null)
    try {
      await mutateRatesFlags({
        category: categoryKey,
        action,
        values,
        original_id: originalId,
      })
      return true
    } catch (mutationError) {
      setActionError(
        mutationError instanceof Error ? mutationError.message : 'Failed to save changes.'
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveMutation(params: {
    action: RatesFlagsMutationAction
    values: Record<string, unknown>
    originalId?: string
    keepId?: string
    notice: string
  }) {
    const ok = await persist(params.action, params.values, params.originalId)
    if (!ok) return false
    const reloaded = await refresh(params.keepId)
    if (!reloaded) return false
    setNotice(params.notice)
    return true
  }

  async function archiveToggle(params: {
    selectedId: string
    nextActive: boolean
  }) {
    const ok = await persist(
      params.nextActive ? 'reactivate' : 'archive',
      { id: params.selectedId },
      params.selectedId
    )
    if (!ok) return false
    const reloaded = await refresh(params.selectedId)
    if (!reloaded) return false
    setNotice(params.nextActive ? 'Reactivated row.' : 'Archived row.')
    return true
  }

  return {
    saving,
    actionError,
    notice,
    setActionError,
    setNotice,
    saveMutation,
    archiveToggle,
  }
}
