'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [hydratedRowId, setHydratedRowId] = useState<string | null>(null)
  const isCreatingRef = useRef(false)

  function setCreateMode(next: boolean) {
    isCreatingRef.current = next
    setIsCreating(next)
  }

  function hydrateDraftFromRow(selected: QuoteProductRow | null) {
    const nextDraft = selected ? quoteProductRowToDraft(selected) : createEmptyQuoteProductDraft()
    const nextSnapshot = createQuoteProductDraftSnapshot(nextDraft)
    setDraft(nextDraft)
    setCleanSnapshot(nextSnapshot)
    setHydratedRowId(selected?.id ?? null)
  }

  function syncDraftWithSnapshot(nextDraft: Partial<QuoteProductDraft>) {
    const normalized = normalizeQuoteProductDraft(nextDraft)
    const nextSnapshot = createQuoteProductDraftSnapshot(normalized)
    setDraft(normalized)
    setCleanSnapshot(nextSnapshot)
  }

  useEffect(() => {
    if (isCreating) return
    if (!selected) {
      if (hydratedRowId !== null) {
        hydrateDraftFromRow(null)
      }
      return
    }
    if (selected.id === hydratedRowId) return
    hydrateDraftFromRow(selected)
  }, [hydratedRowId, isCreating, selected])

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
    setCreateMode(true)
    syncDraftWithSnapshot(nextDraft)
  }

  function cancel(selectedFallback: QuoteProductRow | null) {
    hydrateDraftFromRow(selectedFallback)
    setCreateMode(false)
  }

  function setDraftFromRow(next: QuoteProductRow | null) {
    hydrateDraftFromRow(next)
  }

  function finishCreate(nextSelected: QuoteProductRow) {
    setCreateMode(false)
    hydrateDraftFromRow(nextSelected)
  }

  return {
    draft: validationResult.draft,
    isCreating,
    isCreatingNow: () => isCreatingRef.current,
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
