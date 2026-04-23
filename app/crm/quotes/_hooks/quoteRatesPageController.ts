'use client'

import { useEffect, useMemo, useReducer, useRef } from 'react'
import {
  areRatesFlagsDraftSnapshotsEqual,
  buildRatesFlagsSearchableText,
  categoryByKey,
  createRatesFlagsDraftSnapshot,
  valueFromRatesFlagsRow,
} from '@/lib/quotes/ratesFlagsForm'
import { mutateRatesFlags } from '@/lib/quotes/client'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsActivationMutationRequest,
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsCreateOrUpdateMutation,
  RatesFlagsDraft,
  RatesFlagsDraftValidationResult,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsPayload,
  RatesFlagsRow,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'
import type {
  FlagsSectionKey,
  RateSectionKey,
  RoomDefaultsSectionKey,
  StatusFilter,
} from './quoteRatesPageConfig'
import { RATE_SUBGROUPS } from './quoteRatesPageConfig'
import {
  findReconciledRatesRow,
  reconcileRatesFlagsPayload,
} from './quoteRatesMutationReconciliation'
import { useQuoteRatesData } from './useQuoteRatesData'

export type QuoteRatesNavigationState = {
  activeTab: RatesFlagsTab
  rateSection: RateSectionKey
  rateCategory: RatesFlagsCategoryKey
  flagsSection: FlagsSectionKey
  roomDefaultsSection: RoomDefaultsSectionKey
  statusFilter: StatusFilter
  search: string
}

export type QuoteRatesPendingTransition =
  | { type: 'setActiveTab'; activeTab: RatesFlagsTab }
  | { type: 'setRateSection'; rateSection: RateSectionKey }
  | { type: 'setRateCategory'; rateCategory: string }
  | { type: 'setFlagsSection'; flagsSection: FlagsSectionKey }
  | { type: 'setRoomDefaultsSection'; roomDefaultsSection: RoomDefaultsSectionKey }
  | { type: 'setStatusFilter'; statusFilter: StatusFilter }
  | { type: 'setSearch'; search: string }
  | { type: 'setSelectedId'; selectedId: string }
  | { type: 'startCreate' }
  | { type: 'startDuplicate' }
  | { type: 'reload'; keepId?: string }
  | { type: 'archiveOrReactivate'; nextActive: boolean }

type QuoteRatesActionStatus = 'idle' | 'saving' | 'reloading' | 'archiving'
type QuoteRatesEditorMode = 'selection' | 'create'
type QuoteRatesDiscardStatus = 'idle' | 'confirming' | 'applying'
type QuoteRatesDraftSnapshot = ReturnType<typeof createRatesFlagsDraftSnapshot>

type QuoteRatesWorkflowState = {
  navigation: QuoteRatesNavigationState
  selectedId: string
  editorMode: QuoteRatesEditorMode
  draft: RatesFlagsDraft | null
  draftActive: boolean
  cleanSnapshot: QuoteRatesDraftSnapshot
  cleanDraftActive: boolean
  pendingTransition: QuoteRatesPendingTransition | null
  discardStatus: QuoteRatesDiscardStatus
  actionStatus: QuoteRatesActionStatus
  notice: string | null
  noticeTone: 'success' | 'warning' | null
  actionError: string | null
  refreshSelectionId: string | null
  forceRefreshRehydrate: boolean
}

type QuoteRatesControllerAction =
  | { type: 'applyNavigation'; navigation: QuoteRatesNavigationState; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | { type: 'selectRow'; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | { type: 'startCreate'; draft: RatesFlagsDraft }
  | { type: 'startDuplicate'; draft: RatesFlagsDraft; draftActive: boolean }
  | { type: 'cancelEdit'; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | { type: 'discardCurrentChanges'; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | {
      type: 'updateDraftField'
      category: RatesFlagsCategory
      fieldKey: string
      rawInput: string
    }
  | { type: 'setDraftActive'; draftActive: boolean }
  | { type: 'openDiscard'; intent: QuoteRatesPendingTransition }
  | { type: 'setDiscardStatus'; status: QuoteRatesDiscardStatus }
  | { type: 'clearDiscard' }
  | { type: 'beginAction'; status: QuoteRatesActionStatus }
  | { type: 'finishAction' }
  | { type: 'setNotice'; notice: string | null; tone?: 'success' | 'warning' | null }
  | { type: 'setActionError'; error: string | null }
  | { type: 'clearFeedback' }
  | { type: 'scheduleRefreshRehydrate'; selectedId: string | null; force: boolean }
  | { type: 'clearRefreshRehydrate' }
  | { type: 'commitMutation'; selectedId: string; editor: QuoteRatesEditorSnapshot }
  | { type: 'reconcileFromResource'; editor: QuoteRatesEditorSnapshot; selectedId: string; preserveCreateDraft: boolean }

type QuoteRatesEditorSnapshot = {
  selectedId: string
  editorMode: QuoteRatesEditorMode
  draft: RatesFlagsDraft | null
  draftActive: boolean
  cleanSnapshot: QuoteRatesDraftSnapshot
  cleanDraftActive: boolean
}

const emptyDraftSnapshot = createRatesFlagsDraftSnapshot(null)

export const DEFAULT_QUOTE_RATES_NAVIGATION: QuoteRatesNavigationState = {
  activeTab: 'rates',
  rateSection: 'production',
  rateCategory: 'production_rates_walls',
  flagsSection: 'condition_modifiers',
  roomDefaultsSection: 'room_types',
  statusFilter: 'active',
  search: '',
}

function emptyEditorSnapshot(): QuoteRatesEditorSnapshot {
  return {
    selectedId: '',
    editorMode: 'selection',
    draft: null,
    draftActive: true,
    cleanSnapshot: emptyDraftSnapshot,
    cleanDraftActive: true,
  }
}

function createInitialWorkflowState(): QuoteRatesWorkflowState {
  return {
    navigation: DEFAULT_QUOTE_RATES_NAVIGATION,
    ...emptyEditorSnapshot(),
    pendingTransition: null,
    discardStatus: 'idle',
    actionStatus: 'idle',
    notice: null,
    noticeTone: null,
    actionError: null,
    refreshSelectionId: null,
    forceRefreshRehydrate: false,
  }
}

export function getDefaultRateCategory(rateSection: RateSectionKey): RatesFlagsCategoryKey {
  return RATE_SUBGROUPS[rateSection][0]?.key ?? 'production_rates_walls'
}

export function resolveActiveCategoryKey(
  navigation: QuoteRatesNavigationState
): RatesFlagsCategoryKey {
  if (navigation.activeTab === 'rates') return navigation.rateCategory
  if (navigation.activeTab === 'flags') return navigation.flagsSection
  return navigation.roomDefaultsSection
}

export function resolveActiveCategory(
  payload: RatesFlagsPayload,
  navigation: QuoteRatesNavigationState
): RatesFlagsCategory | null {
  return categoryByKey(payload.categories, resolveActiveCategoryKey(navigation))
}

export function getFilteredRows(
  activeCategory: RatesFlagsCategory | null,
  navigation: Pick<QuoteRatesNavigationState, 'search' | 'statusFilter'>
): RatesFlagsRow[] {
  if (!activeCategory) return []

  const query = navigation.search.trim().toLowerCase()
  return activeCategory.rows.filter((row) => {
    const statusMatch =
      navigation.statusFilter === 'all' ||
      (navigation.statusFilter === 'active' && row.active) ||
      (navigation.statusFilter === 'archived' && !row.active)
    if (!statusMatch) return false
    if (!query) return true
    return buildRatesFlagsSearchableText(activeCategory, row).includes(query)
  })
}

export function getNextSelectedId(rows: RatesFlagsRow[], preferredId?: string): string {
  if (!rows.length) return ''
  if (preferredId && rows.some((row) => row.id === preferredId)) return preferredId
  return rows[0]?.id ?? ''
}

function getCategoryContext(data: RatesFlagsPayload, navigation: QuoteRatesNavigationState) {
  const activeCategory = resolveActiveCategory(data, navigation)
  const filteredRows = getFilteredRows(activeCategory, navigation)
  return { activeCategory, filteredRows }
}

function buildEditorSnapshotFromSelection(
  category: RatesFlagsCategory | null,
  selectedId: string
): QuoteRatesEditorSnapshot {
  if (!category || !selectedId) return emptyEditorSnapshot()

  const selectedRow = category.rows.find((row) => row.id === selectedId) ?? null
  if (!selectedRow) return emptyEditorSnapshot()

  const adapter = getRatesFlagsDraftAdapter(category.key as RatesFlagsEditableCategoryKey)
  const draft = adapter.rowToDraft(
    category as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
    selectedRow
  )

  return {
    selectedId: selectedRow.id,
    editorMode: 'selection',
    draft,
    draftActive: selectedRow.active,
    cleanSnapshot: createRatesFlagsDraftSnapshot(draft),
    cleanDraftActive: selectedRow.active,
  }
}

function buildSelectionSnapshot(
  data: RatesFlagsPayload,
  navigation: QuoteRatesNavigationState,
  preferredId?: string
) {
  const { activeCategory, filteredRows } = getCategoryContext(data, navigation)
  const selectedId = getNextSelectedId(filteredRows, preferredId)
  return {
    activeCategory,
    filteredRows,
    selectedId,
    editor: buildEditorSnapshotFromSelection(activeCategory, selectedId),
  }
}

function buildMutationSnapshot(
  data: RatesFlagsPayload,
  navigation: QuoteRatesNavigationState,
  selectedId: string
) {
  const activeCategory = resolveActiveCategory(data, navigation)
  const editor = buildEditorSnapshotFromSelection(activeCategory, selectedId)
  return {
    selectedId: editor.selectedId,
    editor,
  }
}

function quoteRatesWorkflowReducer(
  state: QuoteRatesWorkflowState,
  action: QuoteRatesControllerAction
): QuoteRatesWorkflowState {
  switch (action.type) {
    case 'applyNavigation':
      return {
        ...state,
        navigation: action.navigation,
        selectedId: action.selectedId,
        editorMode: action.editor.editorMode,
        draft: action.editor.draft,
        draftActive: action.editor.draftActive,
        cleanSnapshot: action.editor.cleanSnapshot,
        cleanDraftActive: action.editor.cleanDraftActive,
      }
    case 'selectRow':
    case 'cancelEdit':
    case 'discardCurrentChanges':
      return {
        ...state,
        selectedId: action.selectedId,
        editorMode: action.editor.editorMode,
        draft: action.editor.draft,
        draftActive: action.editor.draftActive,
        cleanSnapshot: action.editor.cleanSnapshot,
        cleanDraftActive: action.editor.cleanDraftActive,
      }
    case 'startCreate':
      return {
        ...state,
        selectedId: '',
        editorMode: 'create',
        draft: action.draft,
        draftActive: true,
        cleanSnapshot: createRatesFlagsDraftSnapshot(action.draft),
        cleanDraftActive: true,
        notice: null,
        actionError: null,
      }
    case 'startDuplicate':
      return {
        ...state,
        selectedId: '',
        editorMode: 'create',
        draft: action.draft,
        draftActive: action.draftActive,
        cleanSnapshot: createRatesFlagsDraftSnapshot(action.draft),
        cleanDraftActive: action.draftActive,
        notice: null,
        actionError: null,
      }
    case 'updateDraftField': {
      if (!state.draft) return state
      const adapter = getRatesFlagsDraftAdapter(
        action.category.key as RatesFlagsEditableCategoryKey
      )
      return {
        ...state,
        draft: adapter.updateDraftField(
          action.category as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>,
          state.draft as never,
          action.fieldKey,
          action.rawInput
        ),
      }
    }
    case 'setDraftActive':
      return {
        ...state,
        draftActive: action.draftActive,
      }
    case 'openDiscard':
      return state.pendingTransition
        ? state
        : {
            ...state,
            pendingTransition: action.intent,
            discardStatus: 'confirming',
          }
    case 'setDiscardStatus':
      return {
        ...state,
        discardStatus: action.status,
      }
    case 'clearDiscard':
      return {
        ...state,
        pendingTransition: null,
        discardStatus: 'idle',
      }
    case 'beginAction':
      return {
        ...state,
        actionStatus: action.status,
        notice: null,
        noticeTone: null,
        actionError: null,
      }
    case 'finishAction':
      return {
        ...state,
        actionStatus: 'idle',
      }
    case 'setNotice':
      return {
        ...state,
        notice: action.notice,
        noticeTone: action.tone ?? null,
        actionError: null,
      }
    case 'setActionError':
      return {
        ...state,
        actionError: action.error,
        notice: null,
        noticeTone: null,
      }
    case 'clearFeedback':
      return {
        ...state,
        notice: null,
        noticeTone: null,
        actionError: null,
      }
    case 'scheduleRefreshRehydrate':
      return {
        ...state,
        refreshSelectionId: action.selectedId,
        forceRefreshRehydrate: action.force,
      }
    case 'clearRefreshRehydrate':
      return {
        ...state,
        refreshSelectionId: null,
        forceRefreshRehydrate: false,
      }
    case 'commitMutation':
      return {
        ...state,
        selectedId: action.selectedId,
        editorMode: action.editor.editorMode,
        draft: action.editor.draft,
        draftActive: action.editor.draftActive,
        cleanSnapshot: action.editor.cleanSnapshot,
        cleanDraftActive: action.editor.cleanDraftActive,
      }
    case 'reconcileFromResource':
      if (action.preserveCreateDraft) {
        return {
          ...state,
          refreshSelectionId: null,
          forceRefreshRehydrate: false,
        }
      }
      return {
        ...state,
        selectedId: action.selectedId,
        editorMode: action.editor.editorMode,
        draft: action.editor.draft,
        draftActive: action.editor.draftActive,
        cleanSnapshot: action.editor.cleanSnapshot,
        cleanDraftActive: action.editor.cleanDraftActive,
        refreshSelectionId: null,
        forceRefreshRehydrate: false,
      }
    default:
      return state
  }
}

function transitionNeedsDiscardReset(intent: QuoteRatesPendingTransition) {
  return intent.type === 'reload' || intent.type === 'archiveOrReactivate'
}

export function useQuoteRatesPageController() {
  const resource = useQuoteRatesData()
  const [state, dispatch] = useReducer(quoteRatesWorkflowReducer, undefined, createInitialWorkflowState)

  const { activeCategory, filteredRows } = useMemo(
    () => getCategoryContext(resource.data, state.navigation),
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
    dirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    pendingTransitionRef.current = state.pendingTransition
  }, [state.pendingTransition])

  useEffect(() => {
    const selection = buildSelectionSnapshot(
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
        dispatch({ type: 'reconcileFromResource', ...selection, preserveCreateDraft })
      }
      return
    }

    dispatch({ type: 'reconcileFromResource', ...selection, preserveCreateDraft })
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
    if (!changed) {
      return executeTransition(intent)
    }
    if (dirtyRef.current || isDirty) {
      pendingTransitionRef.current = intent
      dispatch({ type: 'openDiscard', intent })
      return false
    }
    return executeTransition(intent)
  }

  function applyNavigation(navigation: QuoteRatesNavigationState, preferredId?: string) {
    const selection = buildSelectionSnapshot(resource.data, navigation, preferredId)
    dirtyRef.current = false
    dispatch({
      type: 'applyNavigation',
      navigation,
      selectedId: selection.selectedId,
      editor: selection.editor,
    })
    return true
  }

  function applySelection(selectedId: string) {
    const editor = buildEditorSnapshotFromSelection(activeCategory, selectedId)
    dirtyRef.current = false
    dispatch({ type: 'selectRow', selectedId: editor.selectedId, editor })
    return true
  }

  function startCreate() {
    if (!activeCategory || !adapter) return false
    const draft = adapter.createEmptyDraft(
      activeCategory as RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>
    )
    dirtyRef.current = false
    dispatch({ type: 'startCreate', draft })
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
    dispatch({
      type: 'startDuplicate',
      draft,
      draftActive: selectedRow.active,
    })
    return true
  }

  function discardCurrentChanges() {
    const editor = buildEditorSnapshotFromSelection(activeCategory, state.selectedId)
    dirtyRef.current = false
    dispatch({ type: 'discardCurrentChanges', selectedId: editor.selectedId, editor })
  }

  async function performReload(keepId?: string) {
    dispatch({
      type: 'scheduleRefreshRehydrate',
      selectedId: (keepId ?? state.selectedId) || null,
      force: true,
    })
    dispatch({ type: 'beginAction', status: 'reloading' })
    const result = await resource.attemptRefresh({
      preserveDataOnError: true,
      reportError: true,
    })
    const ok = result.ok
    if (!ok) {
      dispatch({ type: 'clearRefreshRehydrate' })
    }
    dispatch({ type: 'finishAction' })
    return ok
  }

  async function persistMutation(
    request: RatesFlagsCreateOrUpdateMutation | RatesFlagsActivationMutationRequest,
    status: QuoteRatesActionStatus
  ) {
    dispatch({ type: 'beginAction', status })
    try {
      await mutateRatesFlags(request as never)
      return true
    } catch (mutationError) {
      dispatch({
        type: 'setActionError',
        error:
          mutationError instanceof Error ? mutationError.message : 'Failed to save changes.',
      })
      return false
    }
  }

  async function verifyMutationRefresh() {
    return resource.attemptRefresh({
      preserveDataOnError: true,
      reportError: false,
    })
  }

  async function saveCurrent() {
    if (!activeCategory || !state.draft || !validationResult?.ok) return

    const currentAdapter = getRatesFlagsDraftAdapter(
      activeCategory.key as RatesFlagsEditableCategoryKey
    )
    const request = currentAdapter.toMutationRequest({
      action: state.editorMode === 'create' ? 'create' : 'update',
      draft: state.draft as never,
      draftActive: state.draftActive,
      originalId: state.editorMode === 'create' ? undefined : selectedRow?.id,
    }) as RatesFlagsCreateOrUpdateMutation
    const keepId =
      typeof state.draft.id === 'string' && state.draft.id ? state.draft.id : state.selectedId

    const ok = await persistMutation(request, 'saving')
    if (!ok) {
      dispatch({ type: 'finishAction' })
      return
    }

    const nextPayload = reconcileRatesFlagsPayload(resource.data, request)
    resource.setData(nextPayload)

    const mutationSnapshot = buildMutationSnapshot(nextPayload, state.navigation, keepId || '')
    dirtyRef.current = false
    dispatch({
      type: 'commitMutation',
      selectedId: mutationSnapshot.selectedId,
      editor: mutationSnapshot.editor,
    })

    const verification = await verifyMutationRefresh()
    dispatch({
      type: 'setNotice',
      notice: verification.ok
        ? `${state.editorMode === 'create' ? 'Created' : 'Saved'} ${activeCategory.label}.`
        : `${state.editorMode === 'create' ? 'Created' : 'Saved'} ${activeCategory.label}, but refresh failed. Showing locally updated data.${verification.error ? ` ${verification.error}` : ''}`,
      tone: verification.ok ? 'success' : 'warning',
    })
    dispatch({ type: 'finishAction' })
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (!activeCategory || !selectedRow) return false

    const currentAdapter = getRatesFlagsDraftAdapter(
      activeCategory.key as RatesFlagsEditableCategoryKey
    )
    const request = currentAdapter.toArchiveRequest({
      action: nextActive ? 'reactivate' : 'archive',
      rowId: selectedRow.id,
    })
    const ok = await persistMutation(request, 'archiving')
    if (!ok) {
      dispatch({ type: 'finishAction' })
      return false
    }

    const nextPayload = reconcileRatesFlagsPayload(resource.data, request)
    resource.setData(nextPayload)

    const preferredRow =
      findReconciledRatesRow(nextPayload, request.category, selectedRow.id) ?? selectedRow
    const mutationSnapshot = buildMutationSnapshot(nextPayload, state.navigation, preferredRow.id)
    dirtyRef.current = false
    dispatch({
      type: 'commitMutation',
      selectedId: mutationSnapshot.selectedId,
      editor: mutationSnapshot.editor,
    })

    const verification = await verifyMutationRefresh()
    dispatch({
      type: 'setNotice',
      notice: verification.ok
        ? nextActive
          ? 'Reactivated row.'
          : 'Archived row.'
        : `${nextActive ? 'Reactivated' : 'Archived'} row, but refresh failed. Showing locally updated data.${verification.error ? ` ${verification.error}` : ''}`,
      tone: verification.ok ? 'success' : 'warning',
    })
    dispatch({ type: 'finishAction' })
    return true
  }

  function cancelEdit() {
    const editor = buildEditorSnapshotFromSelection(activeCategory, state.selectedId)
    dirtyRef.current = false
    pendingTransitionRef.current = null
    dispatch({ type: 'cancelEdit', selectedId: editor.selectedId, editor })
    dispatch({ type: 'clearDiscard' })
    dispatch({ type: 'clearFeedback' })
  }

  function updateDraftValue(fieldKey: string, rawInput: string) {
    if (!activeCategory || !adapter || !state.draft) return
    dirtyRef.current = true
    dispatch({
      type: 'updateDraftField',
      category: activeCategory,
      fieldKey,
      rawInput,
    })
  }

  function setDraftActive(nextActive: boolean) {
    dirtyRef.current = true
    dispatch({ type: 'setDraftActive', draftActive: nextActive })
  }

  function executeTransition(intent: QuoteRatesPendingTransition): boolean | Promise<boolean> {
    switch (intent.type) {
      case 'setActiveTab':
        return applyNavigation(
          {
            ...state.navigation,
            activeTab: intent.activeTab,
          },
          state.selectedId || undefined
        )
      case 'setRateSection':
        return applyNavigation({
          ...state.navigation,
          activeTab: 'rates',
          rateSection: intent.rateSection,
          rateCategory: getDefaultRateCategory(intent.rateSection),
        })
      case 'setRateCategory':
        return applyNavigation({
          ...state.navigation,
          activeTab: 'rates',
          rateCategory: intent.rateCategory as QuoteRatesNavigationState['rateCategory'],
        })
      case 'setFlagsSection':
        return applyNavigation({
          ...state.navigation,
          activeTab: 'flags',
          flagsSection: intent.flagsSection,
        })
      case 'setRoomDefaultsSection':
        return applyNavigation({
          ...state.navigation,
          activeTab: 'room_defaults',
          roomDefaultsSection: intent.roomDefaultsSection,
        })
      case 'setStatusFilter':
        return applyNavigation(
          {
            ...state.navigation,
            statusFilter: intent.statusFilter,
          },
          state.selectedId || undefined
        )
      case 'setSearch':
        return applyNavigation(
          {
            ...state.navigation,
            search: intent.search,
          },
          state.selectedId || undefined
        )
      case 'setSelectedId':
        return applySelection(intent.selectedId)
      case 'startCreate':
        return startCreate()
      case 'startDuplicate':
        return startDuplicate()
      case 'reload':
        return performReload(intent.keepId)
      case 'archiveOrReactivate':
        return archiveOrReactivate(intent.nextActive)
      default:
        return false
    }
  }

  async function confirmDiscard(): Promise<boolean> {
    const pending = pendingTransitionRef.current
    if (!pending) return false

    dispatch({ type: 'setDiscardStatus', status: 'applying' })
    if (transitionNeedsDiscardReset(pending)) {
      discardCurrentChanges()
    }

    try {
      const result = await Promise.resolve(executeTransition(pending))
      pendingTransitionRef.current = null
      dispatch({ type: 'clearDiscard' })
      return Boolean(result)
    } catch (error) {
      pendingTransitionRef.current = null
      dispatch({ type: 'clearDiscard' })
      throw error
    }
  }

  function cancelDiscard() {
    pendingTransitionRef.current = null
    dispatch({ type: 'clearDiscard' })
  }

  return {
    resource,
    valueFromRow: valueFromRatesFlagsRow,
    workflowState: state,
    derived: {
      activeCategory,
      adapter,
      filteredRows,
      selectedRow,
      validationResult,
      validationError,
      isDirty,
    },
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
