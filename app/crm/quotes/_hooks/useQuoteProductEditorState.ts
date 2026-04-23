'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createEmptyQuoteProductDraft,
  createQuoteProductDraftSnapshot,
  areQuoteProductDraftSnapshotsEqual,
  quoteProductRowToDraft,
  normalizeQuoteProductDraft,
  validateQuoteProductDraft,
  type QuoteProductDraft,
  type QuoteProductRow,
  type QuoteProductValidationState,
} from '@/lib/quotes/productsForm'

type Options = {
  selected: QuoteProductRow | null
}

export function useQuoteProductEditorState({ selected }: Options) {
  const [draft, setDraft] = useState<QuoteProductDraft>(() => createEmptyQuoteProductDraft())
  const [isCreating, setIsCreating] = useState(false)
  const [cleanSnapshot, setCleanSnapshot] = useState(() =>
    createQuoteProductDraftSnapshot(createEmptyQuoteProductDraft())
  )

  function hydrateDraftFromRow(selected: QuoteProductRow | null) {
    const nextDraft = selected ? quoteProductRowToDraft(selected) : createEmptyQuoteProductDraft()
    const nextSnapshot = createQuoteProductDraftSnapshot(nextDraft)
    setDraft(nextDraft)
    setCleanSnapshot(nextSnapshot)
  }

  function syncDraftWithSnapshot(nextDraft: Partial<QuoteProductDraft>) {
    const normalized = normalizeQuoteProductDraft(nextDraft)
    const nextSnapshot = createQuoteProductDraftSnapshot(normalized)
    setDraft(normalized)
    setCleanSnapshot(nextSnapshot)
  }

  useEffect(() => {
    if (isCreating) return
    hydrateDraftFromRow(selected)
  }, [isCreating, selected])

  const draftSnapshot = useMemo(() => createQuoteProductDraftSnapshot(draft), [draft])
  const isDirty = useMemo(
    () => !areQuoteProductDraftSnapshotsEqual(draftSnapshot, cleanSnapshot),
    [draftSnapshot, cleanSnapshot]
  )

  const validationResult = useMemo(() => validateQuoteProductDraft(draft), [draft])
  const validation: QuoteProductValidationState = validationResult.validation

  function updateDraftField<K extends keyof QuoteProductDraft>(
    field: K,
    value: QuoteProductDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function startCreate(defaultFamily: QuoteProductDraft['family']) {
    const nextDraft = {
      ...createEmptyQuoteProductDraft(),
      family: defaultFamily,
    }
    setIsCreating(true)
    syncDraftWithSnapshot(nextDraft)
  }

  function cancel(selectedFallback: QuoteProductRow | null) {
    hydrateDraftFromRow(selectedFallback)
    setIsCreating(false)
  }

  function setDraftFromRow(next: QuoteProductRow | null) {
    hydrateDraftFromRow(next)
  }

  function finishCreate(nextSelected: QuoteProductRow) {
    setIsCreating(false)
    hydrateDraftFromRow(nextSelected)
  }

  return {
    draft: validationResult.draft,
    isCreating,
    isDirty,
    validation,
    hydrateDraftFromRow,
    updateDraftField,
    startCreate,
    cancel,
    setDraftFromRow,
    finishCreate,
    resetDraft: () => syncDraftWithSnapshot(createEmptyQuoteProductDraft()),
    getValidatedDraft: () => {
      const validated = validateQuoteProductDraft(draft)
      setDraft(validated.draft)
      return validated
    },
  }
}
