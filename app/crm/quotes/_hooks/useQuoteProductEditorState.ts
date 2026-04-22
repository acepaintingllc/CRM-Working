'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createEmptyQuoteProductDraft,
  quoteProductRowToDraft,
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

  useEffect(() => {
    if (isCreating) return
    if (!selected) {
      setDraft(createEmptyQuoteProductDraft())
      return
    }
    setDraft(quoteProductRowToDraft(selected))
  }, [isCreating, selected])

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
    setIsCreating(true)
    setDraft({
      ...createEmptyQuoteProductDraft(),
      family: defaultFamily,
    })
  }

  function cancel(selectedFallback: QuoteProductRow | null) {
    if (selectedFallback) {
      setDraft(quoteProductRowToDraft(selectedFallback))
    } else {
      setDraft(createEmptyQuoteProductDraft())
    }
    setIsCreating(false)
  }

  function finishCreate(nextSelected: QuoteProductRow) {
    setIsCreating(false)
    setDraft(quoteProductRowToDraft(nextSelected))
  }

  return {
    draft: validationResult.draft,
    isCreating,
    validation,
    updateDraftField,
    startCreate,
    cancel,
    finishCreate,
    resetDraft: () => setDraft(createEmptyQuoteProductDraft()),
    getValidatedDraft: () => {
      const validated = validateQuoteProductDraft(draft)
      setDraft(validated.draft)
      return validated
    },
  }
}
