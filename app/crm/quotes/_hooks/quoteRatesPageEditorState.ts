'use client'

import {
  createRatesFlagsDraftSnapshot,
} from '@/lib/quotes/ratesFlagsForm'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsDraft,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
} from '@/types/estimator/ratesFlags'

export type QuoteRatesEditorState = {
  selectedId: string
  isCreating: boolean
  draft: RatesFlagsDraft | null
  draftActive: boolean
  cleanSnapshot: ReturnType<typeof createRatesFlagsDraftSnapshot>
  cleanDraftActive: boolean
}

export function emptyQuoteRatesEditorState(): QuoteRatesEditorState {
  return {
    selectedId: '',
    isCreating: false,
    draft: null,
    draftActive: true,
    cleanSnapshot: createRatesFlagsDraftSnapshot(null),
    cleanDraftActive: true,
  }
}

export function buildQuoteRatesEditorStateFromSelection(args: {
  category: RatesFlagsCategory | null
  selectedId: string
}): QuoteRatesEditorState {
  if (!args.category || !args.selectedId) return emptyQuoteRatesEditorState()

  const selectedRow = args.category.rows.find((row) => row.id === args.selectedId) ?? null
  if (!selectedRow) return emptyQuoteRatesEditorState()

  const adapter = getRatesFlagsDraftAdapter(args.category.key as RatesFlagsEditableCategoryKey)
  const draft = adapter.rowToDraft(
    args.category as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
    selectedRow
  )

  return {
    selectedId: selectedRow.id,
    isCreating: false,
    draft,
    draftActive: selectedRow.active,
    cleanSnapshot: createRatesFlagsDraftSnapshot(draft),
    cleanDraftActive: selectedRow.active,
  }
}
