'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  areRatesFlagsDraftSnapshotsEqual,
  createRatesFlagsDraftSnapshot,
} from '@/lib/quotes/ratesFlagsForm'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsCategory,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'
import { getNextSelectedId } from './quoteRatesPageController'
import {
  buildQuoteRatesEditorStateFromSelection,
  emptyQuoteRatesEditorState,
  type QuoteRatesEditorState,
} from './quoteRatesPageEditorState'

export function useQuoteRatesEditor(args: {
  activeCategory: RatesFlagsCategory | null
  filteredRows: RatesFlagsRow[]
}) {
  const { activeCategory, filteredRows } = args
  const [editor, setEditor] = useState<QuoteRatesEditorState>(emptyQuoteRatesEditorState)

  const pendingRefreshSelectionRef = useRef<string | undefined>(undefined)
  const forceRehydrateRef = useRef(false)

  const selectedRow = useMemo(() => {
    if (!activeCategory || !editor.selectedId) return null
    return activeCategory.rows.find((row) => row.id === editor.selectedId) ?? null
  }, [activeCategory, editor.selectedId])

  const adapter = useMemo(
    () =>
      activeCategory
        ? getRatesFlagsDraftAdapter(activeCategory.key as RatesFlagsEditableCategoryKey)
        : null,
    [activeCategory]
  )

  const validationResult =
    activeCategory && adapter && editor.draft
      ? adapter.validateDraft(
          activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
          editor.draft as never
        )
      : null
  const validationError = validationResult && !validationResult.ok ? validationResult.error : null

  const draftSnapshot = useMemo(() => createRatesFlagsDraftSnapshot(editor.draft), [editor.draft])
  const isDirty = useMemo(
    () =>
      !areRatesFlagsDraftSnapshotsEqual(draftSnapshot, editor.cleanSnapshot) ||
      editor.draftActive !== editor.cleanDraftActive,
    [draftSnapshot, editor.cleanDraftActive, editor.cleanSnapshot, editor.draftActive]
  )

  const isDirtyRef = useRef(isDirty)
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    const preferredId = pendingRefreshSelectionRef.current
    const force = forceRehydrateRef.current
    const nextSelectedId = getNextSelectedId(filteredRows, preferredId ?? editor.selectedId)

    if (!(editor.isCreating && !force)) {
      if (!activeCategory || !nextSelectedId) {
        isDirtyRef.current = false
        setEditor(emptyQuoteRatesEditorState())
      } else if (force || editor.selectedId !== nextSelectedId || !editor.draft) {
        isDirtyRef.current = false
        setEditor(
          buildQuoteRatesEditorStateFromSelection({
            category: activeCategory,
            selectedId: nextSelectedId,
          })
        )
      }
    }

    pendingRefreshSelectionRef.current = undefined
    forceRehydrateRef.current = false
  }, [activeCategory, editor.draft, editor.isCreating, editor.selectedId, filteredRows])

  function setSelectionState(category: RatesFlagsCategory | null, selectedId: string) {
    isDirtyRef.current = false
    setEditor(buildQuoteRatesEditorStateFromSelection({ category, selectedId }))
  }

  function beginCreate() {
    if (!activeCategory || !adapter) return false
    const draft = adapter.createEmptyDraft(
      activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>
    )
    isDirtyRef.current = false
    setEditor({
      selectedId: '',
      isCreating: true,
      draft,
      draftActive: true,
      cleanSnapshot: createRatesFlagsDraftSnapshot(draft),
      cleanDraftActive: true,
    })
    return true
  }

  function beginDuplicate() {
    if (!activeCategory || !adapter || !selectedRow) return false
    const duplicateDraft = adapter.withDuplicateId(
      adapter.rowToDraft(
        activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
        selectedRow
      ) as never,
      selectedRow.id
    )
    isDirtyRef.current = false
    setEditor({
      selectedId: '',
      isCreating: true,
      draft: duplicateDraft,
      draftActive: selectedRow.active,
      cleanSnapshot: createRatesFlagsDraftSnapshot(duplicateDraft),
      cleanDraftActive: selectedRow.active,
    })
    return true
  }

  function cancelEdit() {
    isDirtyRef.current = false
    if (activeCategory && selectedRow) {
      setEditor(
        buildQuoteRatesEditorStateFromSelection({
          category: activeCategory,
          selectedId: selectedRow.id,
        })
      )
      return
    }
    setEditor(emptyQuoteRatesEditorState())
  }

  function scheduleRefreshSelection(selectedId?: string, force = true) {
    pendingRefreshSelectionRef.current = selectedId
    forceRehydrateRef.current = force
  }

  function clearScheduledRefreshSelection() {
    pendingRefreshSelectionRef.current = undefined
    forceRehydrateRef.current = false
  }

  function setDraftActive(nextActive: boolean) {
    isDirtyRef.current = true
    setEditor((current) => ({
      ...current,
      draftActive: nextActive,
    }))
  }

  function updateDraftValue(fieldKey: string, rawInput: string) {
    if (!activeCategory || !adapter) return
    isDirtyRef.current = true
    setEditor((current) => ({
      ...current,
      draft: current.draft
        ? adapter.updateDraftField(
            activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
            current.draft as never,
            fieldKey,
            rawInput
          )
        : current.draft,
    }))
  }

  return {
    editor,
    setEditor,
    selectedRow,
    adapter,
    validationResult,
    validationError,
    isDirty,
    isDirtyRef,
    setSelectionState,
    beginCreate,
    beginDuplicate,
    cancelEdit,
    scheduleRefreshSelection,
    clearScheduledRefreshSelection,
    setDraftActive,
    updateDraftValue,
  }
}
