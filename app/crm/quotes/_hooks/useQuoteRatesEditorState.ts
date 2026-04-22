'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createEmptyDraft,
  draftToMutationValues,
  formatDraftValue,
  rowToDraft,
  updateDraftField,
  validateDraft,
} from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsDraft,
  RatesFlagsMutationAction,
} from '@/types/estimator/ratesFlags'

type Options = {
  activeCategory: RatesFlagsCategory | null
  filteredRows: RatesFlagsCategory['rows']
}

export function useQuoteRatesEditorState({ activeCategory, filteredRows }: Options) {
  const [selectedId, setSelectedId] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<RatesFlagsDraft>({})
  const [draftActive, setDraftActive] = useState(true)

  useEffect(() => {
    if (!activeCategory || isCreating) return
    const exists = filteredRows.some((row) => row.id === selectedId)
    if (exists) return
    const fallback = filteredRows[0]
    if (!fallback) {
      setSelectedId('')
      setDraft({})
      return
    }
    setSelectedId(fallback.id)
  }, [activeCategory, filteredRows, isCreating, selectedId])

  const selectedRow = useMemo(() => {
    if (!activeCategory || !selectedId) return null
    return activeCategory.rows.find((row) => row.id === selectedId) ?? null
  }, [activeCategory, selectedId])

  useEffect(() => {
    if (!activeCategory || isCreating || !selectedRow) return
    setDraft(rowToDraft(activeCategory, selectedRow))
    setDraftActive(selectedRow.active)
  }, [activeCategory, isCreating, selectedRow])

  const validationResult = activeCategory ? validateDraft(activeCategory, draft) : null
  const validationError = validationResult && !validationResult.ok ? validationResult.error : null

  function updateDraftValue(fieldKey: string, rawInput: string) {
    if (!activeCategory) return
    setDraft((current) => updateDraftField(activeCategory, current, fieldKey, rawInput))
  }

  function startCreate() {
    if (!activeCategory) return
    setIsCreating(true)
    setSelectedId('')
    setDraft(createEmptyDraft(activeCategory))
    setDraftActive(true)
  }

  function startDuplicate() {
    if (!activeCategory || !selectedRow) return
    const next = rowToDraft(activeCategory, selectedRow)
    next.id = `${selectedRow.id}_COPY`
    setIsCreating(true)
    setSelectedId('')
    setDraft(next)
    setDraftActive(selectedRow.active)
  }

  function cancelEdit() {
    if (selectedRow && activeCategory) {
      setDraft(rowToDraft(activeCategory, selectedRow))
      setDraftActive(selectedRow.active)
      setIsCreating(false)
      return
    }
    setDraft({})
    setDraftActive(true)
    setIsCreating(false)
  }

  function buildMutation(args: {
    action: RatesFlagsMutationAction
  }) {
    if (!activeCategory || !validationResult?.ok) return null
    return {
      action: args.action,
      values: draftToMutationValues(activeCategory, draft, draftActive),
      originalId: isCreating ? undefined : selectedRow?.id,
      keepId: typeof draft.id === 'string' && draft.id ? draft.id : selectedId,
    }
  }

  return {
    selectedId,
    setSelectedId,
    isCreating,
    draft,
    draftActive,
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
      ? (fieldKey: string) => formatDraftValue(activeCategory, draft, fieldKey)
      : () => '',
    finishCreate: () => setIsCreating(false),
  }
}
