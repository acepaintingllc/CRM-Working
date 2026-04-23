'use client'

import { mutateRatesFlags } from '@/lib/quotes/client'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsCreateOrUpdateMutation,
  RatesFlagsEditableCategoryKey,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import type { QuoteRatesEditorState } from './quoteRatesPageEditorState'

type QuoteRatesResource = {
  refresh: () => Promise<boolean>
}

type QuoteRatesFeedback = {
  beginAction: () => void
  finishAction: () => void
  setErrorMessage: (message: string | null) => void
  setSuccessNotice: (message: string | null) => void
}

export function useQuoteRatesMutations(args: {
  resource: QuoteRatesResource
  feedback: QuoteRatesFeedback
  activeCategory: RatesFlagsCategory | null
  selectedRow: RatesFlagsRow | null
  editor: QuoteRatesEditorState
  validationOk: boolean
  scheduleRefreshSelection: (selectedId?: string, force?: boolean) => void
  clearScheduledRefreshSelection: () => void
}) {
  const {
    resource,
    feedback,
    activeCategory,
    selectedRow,
    editor,
    validationOk,
    scheduleRefreshSelection,
    clearScheduledRefreshSelection,
  } = args

  async function performReload(keepId?: string) {
    scheduleRefreshSelection(keepId ?? editor.selectedId ?? undefined, true)
    const ok = await resource.refresh()
    if (!ok) clearScheduledRefreshSelection()
    return ok
  }

  async function persistMutation(
    request:
      | RatesFlagsCreateOrUpdateMutation
      | { action: 'archive' | 'reactivate'; category: RatesFlagsEditableCategoryKey; rowId: string }
  ) {
    feedback.beginAction()
    try {
      await mutateRatesFlags(request as never)
      return true
    } catch (mutationError) {
      feedback.setErrorMessage(
        mutationError instanceof Error ? mutationError.message : 'Failed to save changes.'
      )
      return false
    } finally {
      feedback.finishAction()
    }
  }

  async function saveCurrent() {
    if (!activeCategory || !editor.draft || !validationOk) return

    const adapter = getRatesFlagsDraftAdapter(activeCategory.key as RatesFlagsEditableCategoryKey)
    const request = adapter.toMutationRequest({
      action: editor.isCreating ? 'create' : 'update',
      draft: editor.draft as never,
      draftActive: editor.draftActive,
      originalId: editor.isCreating ? undefined : selectedRow?.id,
    }) as RatesFlagsCreateOrUpdateMutation
    const keepId =
      typeof editor.draft.id === 'string' && editor.draft.id ? editor.draft.id : editor.selectedId

    const ok = await persistMutation(request)
    if (!ok) return

    const reloaded = await performReload(keepId || undefined)
    if (!reloaded) return

    feedback.setSuccessNotice(`${editor.isCreating ? 'Created' : 'Saved'} ${activeCategory.label}.`)
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (!activeCategory || !selectedRow) return false

    const adapter = getRatesFlagsDraftAdapter(activeCategory.key as RatesFlagsEditableCategoryKey)
    const request = adapter.toArchiveRequest({
      action: nextActive ? 'reactivate' : 'archive',
      rowId: selectedRow.id,
    })
    const ok = await persistMutation(request)
    if (!ok) return false

    const reloaded = await performReload(selectedRow.id)
    if (!reloaded) return false

    feedback.setSuccessNotice(nextActive ? 'Reactivated row.' : 'Archived row.')
    return true
  }

  return {
    performReload,
    saveCurrent,
    archiveOrReactivate,
  }
}
