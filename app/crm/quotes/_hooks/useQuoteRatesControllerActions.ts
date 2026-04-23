'use client'

import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type { RatesFlagsEditableCategoryKey } from '@/types/estimator/ratesFlags'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import type { useQuoteRatesEditorState } from './useQuoteRatesEditorState'
import type { useQuoteRatesFilters } from './useQuoteRatesFilters'
import type { useQuoteRatesPersistence } from './useQuoteRatesPersistence'

type Options = {
  filters: ReturnType<typeof useQuoteRatesFilters>
  editor: ReturnType<typeof useQuoteRatesEditorState>
  persistence: ReturnType<typeof useQuoteRatesPersistence>
  feedback: ReturnType<typeof useDenseQuoteAdminFeedback>
  reload: (keepId?: string) => Promise<boolean>
}

export function useQuoteRatesControllerActions({
  filters,
  editor,
  persistence,
  feedback,
  reload,
}: Options) {
  async function saveCurrent() {
    if (!filters.activeCategory) return

    const mutation = editor.buildMutation({
      action: editor.isCreating ? 'create' : 'update',
    })
    if (!mutation) return

    const ok = await persistence.saveMutation({
      request: mutation.request,
      keepId: mutation.keepId,
      notice: `${editor.isCreating ? 'Created' : 'Saved'} ${filters.activeCategory.label}.`,
    })
    if (ok) {
      editor.finishCreate()
    }
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (!editor.selectedRow || !filters.activeCategory) return
    const draftAdapter = getRatesFlagsDraftAdapter(
      filters.activeCategory.key as RatesFlagsEditableCategoryKey
    )
    await persistence.archiveToggle({
      request: draftAdapter.toArchiveRequest({
        action: nextActive ? 'reactivate' : 'archive',
        rowId: editor.selectedRow.id,
      }),
    })
  }

  function startCreate() {
    editor.startCreate()
    feedback.clearFeedback()
  }

  function startDuplicate() {
    editor.startDuplicate()
    feedback.clearFeedback()
  }

  function cancelEdit() {
    editor.cancelEdit()
    feedback.clearFeedback()
  }

  return {
    reload,
    saveCurrent,
    archiveOrReactivate,
    startCreate,
    startDuplicate,
    cancelEdit,
  }
}
