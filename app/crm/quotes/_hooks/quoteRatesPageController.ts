'use client'

import { useEffect, useMemo, useReducer, useRef } from 'react'
import {
  areRatesFlagsDraftSnapshotsEqual,
  createRatesFlagsDraftSnapshot,
  valueFromRatesFlagsRow,
} from '@/lib/quotes/ratesFlagsForm'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsDraftValidationResult,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
} from '@/types/estimator/ratesFlags'
import {
  buildQuoteRatesEditorSnapshotFromSelection,
  buildQuoteRatesSelectionSnapshot,
  getQuoteRatesCategoryContext,
} from './quoteRatesPageNavigation'
import { executeQuoteRatesTransition } from './quoteRatesPageTransitions'
import {
  archiveOrReactivateQuoteRatesMutation,
  saveQuoteRatesMutation,
} from './quoteRatesPageMutations'
import {
  createInitialQuoteRatesWorkflowState,
  quoteRatesPageReducer,
  transitionNeedsDiscardReset,
  type QuoteRatesActionStatus,
  type QuoteRatesDerivedState,
  type QuoteRatesNavigationState,
  type QuoteRatesPendingTransition,
} from './quoteRatesPageState'
import { useQuoteRatesData } from './useQuoteRatesData'

export {
  DEFAULT_QUOTE_RATES_NAVIGATION,
  getDefaultRateCategory,
  type QuoteRatesControllerAction,
  type QuoteRatesDiscardStatus,
  type QuoteRatesDraftSnapshot,
  type QuoteRatesEditorMode,
  type QuoteRatesEditorSnapshot,
  type QuoteRatesNavigationState,
  type QuoteRatesPendingTransition,
  type QuoteRatesWorkflowState,
} from './quoteRatesPageState'
export {
  getFilteredRows,
  getNextSelectedId,
  resolveActiveCategory,
  resolveActiveCategoryKey,
} from './quoteRatesPageNavigation'

export function useQuoteRatesPageController() {
  const resource = useQuoteRatesData()
  const [state, dispatch] = useReducer(
    quoteRatesPageReducer,
    undefined,
    createInitialQuoteRatesWorkflowState
  )
  const stateRef = useRef(state)

  function applyAction(action: import('./quoteRatesPageState').QuoteRatesControllerAction) {
    stateRef.current = quoteRatesPageReducer(stateRef.current, action)
    dispatch(action)
  }

  const { activeCategory, filteredRows } = useMemo(
    () => getQuoteRatesCategoryContext(resource.data, state.navigation),
    [resource.data, state.navigation]
  )

  const selectedRow = useMemo(() => {
    if (!activeCategory || !state.selectedId) return null
    return activeCategory.rows.find((row) => row.id === state.selectedId) ?? null
  }, [activeCategory, state.selectedId])

  const adapter = useMemo(
    () =>
      activeCategory
        ? getRatesFlagsDraftAdapter(activeCategory.key as RatesFlagsEditableCategoryKey)
        : null,
    [activeCategory]
  )

  const validationResult: RatesFlagsDraftValidationResult | null =
    activeCategory && adapter && state.draft
      ? adapter.validateDraft(
          activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
          state.draft as never
        )
      : null
  const validationError = validationResult && !validationResult.ok ? validationResult.error : null

  const draftSnapshot = useMemo(() => createRatesFlagsDraftSnapshot(state.draft), [state.draft])
  const isDirty =
    !areRatesFlagsDraftSnapshotsEqual(draftSnapshot, state.cleanSnapshot) ||
    state.draftActive !== state.cleanDraftActive

  const dirtyRef = useRef(isDirty)
  const pendingTransitionRef = useRef<QuoteRatesPendingTransition | null>(state.pendingTransition)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    dirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    pendingTransitionRef.current = state.pendingTransition
  }, [state.pendingTransition])

  useEffect(() => {
    const selection = buildQuoteRatesSelectionSnapshot(
      resource.data,
      state.navigation,
      (state.refreshSelectionId ?? state.selectedId) || undefined
    )

    const preserveCreateDraft = state.editorMode === 'create' && !state.forceRefreshRehydrate
    const selectionChanged = selection.selectedId !== state.selectedId
    const missingDraft = !state.draft

    if (
      preserveCreateDraft ||
      (!state.forceRefreshRehydrate && !selectionChanged && !missingDraft)
    ) {
      if (state.refreshSelectionId !== null || state.forceRefreshRehydrate) {
        applyAction({ type: 'reconcileFromResource', ...selection, preserveCreateDraft })
      }
      return
    }

    applyAction({ type: 'reconcileFromResource', ...selection, preserveCreateDraft })
  }, [
    resource.data,
    state.navigation,
    state.selectedId,
    state.draft,
    state.editorMode,
    state.refreshSelectionId,
    state.forceRefreshRehydrate,
  ])

  function requestTransition(
    intent: QuoteRatesPendingTransition,
    changed: boolean
  ): boolean | Promise<boolean> {
    if (pendingTransitionRef.current) return false
    if (!changed) return runTransition(intent)
    if (dirtyRef.current || isDirty) {
      pendingTransitionRef.current = intent
      applyAction({ type: 'openDiscard', intent })
      return false
    }
    return runTransition(intent)
  }

  function applyNavigation(navigation: QuoteRatesNavigationState, preferredId?: string) {
    const selection = buildQuoteRatesSelectionSnapshot(resource.data, navigation, preferredId)
    dirtyRef.current = false
    applyAction({
      type: 'applyNavigation',
      navigation,
      selectedId: selection.selectedId,
      editor: selection.editor,
    })
    return true
  }

  function applySelection(selectedId: string) {
    const editor = buildQuoteRatesEditorSnapshotFromSelection(activeCategory, selectedId)
    dirtyRef.current = false
    applyAction({ type: 'selectRow', selectedId: editor.selectedId, editor })
    return true
  }

  function startCreate() {
    if (!activeCategory || !adapter) return false
    const draft = adapter.createEmptyDraft(
      activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>
    )
    dirtyRef.current = false
    applyAction({ type: 'startCreate', draft })
    return true
  }

  function startDuplicate() {
    if (!activeCategory || !adapter || !selectedRow) return false
    const draft = adapter.withDuplicateId(
      adapter.rowToDraft(
        activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
        selectedRow
      ) as never,
      selectedRow.id
    )
    dirtyRef.current = false
    applyAction({
      type: 'startDuplicate',
      draft,
      draftActive: selectedRow.active,
    })
    return true
  }

  function discardCurrentChanges() {
    const currentState = stateRef.current
    const editor = buildQuoteRatesEditorSnapshotFromSelection(activeCategory, currentState.selectedId)
    dirtyRef.current = false
    applyAction({ type: 'discardCurrentChanges', selectedId: editor.selectedId, editor })
  }

  async function performReload(keepId?: string) {
    const currentState = stateRef.current
    applyAction({
      type: 'scheduleRefreshRehydrate',
      selectedId: (keepId ?? currentState.selectedId) || null,
      force: true,
    })
    applyAction({ type: 'beginAction', status: 'reloading' })
    const result = await resource.attemptRefresh({
      preserveDataOnError: true,
      reportError: true,
    })
    if (!result.ok) {
      applyAction({ type: 'clearRefreshRehydrate' })
    }
    applyAction({ type: 'finishAction' })
    return result.ok
  }

  async function runMutationAction(
    status: Extract<QuoteRatesActionStatus, 'saving' | 'archiving'>,
    execute: () => ReturnType<typeof saveQuoteRatesMutation> | ReturnType<typeof archiveOrReactivateQuoteRatesMutation>
  ) {
    applyAction({ type: 'beginAction', status })
    const result = await execute()

    if (!result.ok) {
      applyAction({ type: 'setActionError', error: result.error })
      applyAction({ type: 'finishAction' })
      return false
    }

    dirtyRef.current = false
    applyAction({
      type: 'commitMutation',
      selectedId: result.selectedId,
      editor: result.editor,
    })
    applyAction({
      type: 'setNotice',
      notice: result.notice,
      tone: result.tone,
    })
    applyAction({ type: 'finishAction' })
    return true
  }

  async function saveCurrent() {
    const currentState = stateRef.current
    if (!activeCategory || !currentState.draft || !validationResult?.ok) return

    await runMutationAction('saving', () =>
      saveQuoteRatesMutation({
        resource,
        navigation: currentState.navigation,
        activeCategory:
          activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
        draft: currentState.draft as NonNullable<typeof currentState.draft>,
        draftActive: currentState.draftActive,
        editorMode: currentState.editorMode,
        selectedRowId: selectedRow?.id,
      })
    )
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (!activeCategory || !selectedRow) return false

    return runMutationAction('archiving', () =>
      archiveOrReactivateQuoteRatesMutation({
        resource,
        navigation: stateRef.current.navigation,
        categoryKey: activeCategory.key as RatesFlagsEditableCategoryKey,
        selectedRowId: selectedRow.id,
        nextActive,
      })
    )
  }

  function cancelEdit() {
    const currentState = stateRef.current
    const editor = buildQuoteRatesEditorSnapshotFromSelection(activeCategory, currentState.selectedId)
    dirtyRef.current = false
    pendingTransitionRef.current = null
    applyAction({ type: 'cancelEdit', selectedId: editor.selectedId, editor })
    applyAction({ type: 'clearDiscard' })
    applyAction({ type: 'clearFeedback' })
  }

  function updateDraftValue(fieldKey: string, rawInput: string) {
    const currentState = stateRef.current
    if (!activeCategory || !adapter || !currentState.draft) return
    dirtyRef.current = true
    const nextDraft = adapter.updateDraftField(
      activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
      currentState.draft as never,
      fieldKey,
      rawInput
    )
    applyAction({ type: 'setDraft', draft: nextDraft })
  }

  function setDraftActive(nextActive: boolean) {
    dirtyRef.current = true
    applyAction({ type: 'setDraftActive', draftActive: nextActive })
  }

  function runTransition(intent: QuoteRatesPendingTransition): boolean | Promise<boolean> {
    const currentState = stateRef.current
    return executeQuoteRatesTransition({
      intent,
      navigation: currentState.navigation,
      selectedId: currentState.selectedId,
      applyNavigation,
      applySelection,
      startCreate,
      startDuplicate,
      performReload,
      archiveOrReactivate,
    })
  }

  async function confirmDiscard(): Promise<boolean> {
    const pending = pendingTransitionRef.current
    if (!pending) return false

    applyAction({ type: 'setDiscardStatus', status: 'applying' })
    if (transitionNeedsDiscardReset(pending)) {
      discardCurrentChanges()
    }

    try {
      const result = await Promise.resolve(runTransition(pending))
      pendingTransitionRef.current = null
      applyAction({ type: 'clearDiscard' })
      return Boolean(result)
    } catch (error) {
      pendingTransitionRef.current = null
      applyAction({ type: 'clearDiscard' })
      throw error
    }
  }

  function cancelDiscard() {
    pendingTransitionRef.current = null
    applyAction({ type: 'clearDiscard' })
  }

  const derived: QuoteRatesDerivedState = {
    activeCategory,
    adapter,
    filteredRows,
    selectedRow,
    validationResult,
    validationError,
    isDirty,
  }

  return {
    resource,
    valueFromRow: valueFromRatesFlagsRow,
    workflowState: state,
    derived,
    actions: {
      requestTransition,
      setDraftActive,
      updateDraftValue,
      saveCurrent,
      cancelEdit,
      confirmDiscard,
      cancelDiscard,
    },
  }
}
