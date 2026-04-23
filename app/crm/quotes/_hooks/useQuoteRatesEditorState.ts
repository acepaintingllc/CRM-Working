'use client'

import { useEffect, useMemo, useState } from 'react'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import {
  areRatesFlagsDraftSnapshotsEqual,
  createRatesFlagsDraftSnapshot,
} from '@/lib/quotes/ratesFlagsForm'
import type {
  RatesFlagsCategory,
  RatesFlagsCreateOrUpdateMutation,
  RatesFlagsDraft,
  RatesFlagsEditableCategoryKey,
} from '@/types/estimator/ratesFlags'

type Options = {
  activeCategory: RatesFlagsCategory | null
  filteredRows: RatesFlagsCategory['rows']
}

export function useQuoteRatesEditorState({ activeCategory, filteredRows }: Options) {
  const [selectedId, setSelectedId] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<RatesFlagsDraft | null>(null)
  const [draftActive, setDraftActive] = useState(true)
  const [cleanSnapshot, setCleanSnapshot] = useState(() => createRatesFlagsDraftSnapshot(null))
  const [cleanDraftActive, setCleanDraftActive] = useState(true)
  const adapter = useMemo(
    () =>
      activeCategory
        ? getRatesFlagsDraftAdapter(activeCategory.key as RatesFlagsEditableCategoryKey)
        : null,
    [activeCategory]
  )

  function syncDraft(nextDraft: RatesFlagsDraft | null, nextDraftActive: boolean) {
    setDraft(nextDraft)
    setDraftActive(nextDraftActive)
    setCleanSnapshot(createRatesFlagsDraftSnapshot(nextDraft))
    setCleanDraftActive(nextDraftActive)
  }

  useEffect(() => {
    if (!activeCategory || isCreating) return
    const exists = filteredRows.some((row) => row.id === selectedId)
    if (exists) return
    const fallback = filteredRows[0]
    if (!fallback) {
      setSelectedId('')
      setDraft(null)
      return
    }
    setSelectedId(fallback.id)
  }, [activeCategory, filteredRows, isCreating, selectedId])

  const selectedRow = useMemo(() => {
    if (!activeCategory || !selectedId) return null
    return activeCategory.rows.find((row) => row.id === selectedId) ?? null
  }, [activeCategory, selectedId])

  useEffect(() => {
    if (!activeCategory || !adapter || isCreating || !selectedRow) return
    syncDraft(adapter.rowToDraft(activeCategory, selectedRow), selectedRow.active)
  }, [activeCategory, adapter, isCreating, selectedRow])

  const validationResult =
    activeCategory && adapter && draft ? adapter.validateDraft(activeCategory, draft as never) : null
  const validationError = validationResult && !validationResult.ok ? validationResult.error : null
  const draftSnapshot = useMemo(() => createRatesFlagsDraftSnapshot(draft), [draft])
  const isDirty = useMemo(
    () =>
      !areRatesFlagsDraftSnapshotsEqual(draftSnapshot, cleanSnapshot) ||
      draftActive !== cleanDraftActive,
    [cleanDraftActive, cleanSnapshot, draftActive, draftSnapshot]
  )

  function updateDraftValue(fieldKey: string, rawInput: string) {
    if (!activeCategory || !adapter) return
    setDraft((current) =>
      current ? adapter.updateDraftField(activeCategory, current as never, fieldKey, rawInput) : current
    )
  }

  function startCreate() {
    if (!activeCategory || !adapter) return
    setIsCreating(true)
    setSelectedId('')
    syncDraft(adapter.createEmptyDraft(activeCategory), true)
  }

  function startDuplicate() {
    if (!activeCategory || !adapter || !selectedRow) return
    const next = adapter.withDuplicateId(
      adapter.rowToDraft(activeCategory, selectedRow),
      selectedRow.id
    )
    setIsCreating(true)
    setSelectedId('')
    syncDraft(next, selectedRow.active)
  }

  function cancelEdit() {
    if (selectedRow && activeCategory && adapter) {
      syncDraft(adapter.rowToDraft(activeCategory, selectedRow), selectedRow.active)
      setIsCreating(false)
      return
    }
    syncDraft(null, true)
    setIsCreating(false)
  }

  function buildMutation(args: {
    action: 'create' | 'update'
  }) {
    if (!activeCategory || !draft || !validationResult?.ok) return null
    const activeAdapter = adapter
    if (!activeAdapter) return null
    return {
      // Draft values stay typed for the UI; the adapter is the only place that
      // translates them into the wire mutation contract.
      request: activeAdapter.toMutationRequest({
        action: args.action,
        draft: draft as never,
        draftActive,
        originalId: isCreating ? undefined : selectedRow?.id,
      }) as RatesFlagsCreateOrUpdateMutation,
      keepId: typeof draft.id === 'string' && draft.id ? draft.id : selectedId,
    }
  }

  return {
    selectedId,
    setSelectedId,
    isCreating,
    draft,
    draftActive,
    isDirty,
    setDraftActive,
    selectedRow,
    validationResult,
    validationError,
    updateDraftValue,
    startCreate,
    startDuplicate,
    cancelEdit,
    buildMutation,
    formatDraftValue: activeCategory
      ? (fieldKey: string) =>
          draft && adapter ? adapter.formatDraftValue(activeCategory, draft as never, fieldKey) : ''
      : () => '',
    finishCreate: () => setIsCreating(false),
  }
}
