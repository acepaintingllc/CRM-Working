'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'

type MaybePromise<T> = T | Promise<T>

type DiscardStatus = 'idle' | 'confirming' | 'applying'

type DiscardConfig<State, Action, Intent> = {
  getPendingIntent: (state: State) => Intent | null
  queue: (intent: Intent) => Action
  setStatus: (status: DiscardStatus) => Action
  clear: () => Action
}

type Options<State, Action, Intent, ResourceData> = {
  reducer: (state: State, action: Action) => State
  initialState: State
  initializer?: (initialState: State) => State
  resourceData?: ResourceData
  getResourceSyncAction?: (state: State, resourceData: ResourceData) => Action | null
  hasUnsavedChanges: (state: State) => boolean
  discard: DiscardConfig<State, Action, Intent>
}

export function useDenseQuoteAdminOrchestrator<State, Action, Intent, ResourceData = never>({
  reducer,
  initialState,
  initializer,
  resourceData,
  getResourceSyncAction,
  hasUnsavedChanges,
  discard,
}: Options<State, Action, Intent, ResourceData>) {
  const reducerInitializer = initializer ?? ((value: State) => value)
  const [state, dispatch] = useReducer(reducer, initialState, reducerInitializer)
  const stateRef = useRef(state)
  const getResourceSyncActionRef = useRef(getResourceSyncAction)

  const applyAction = useCallback((action: Action) => {
    stateRef.current = reducer(stateRef.current, action)
    dispatch(action)
  }, [reducer])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    getResourceSyncActionRef.current = getResourceSyncAction
  }, [getResourceSyncAction])

  useEffect(() => {
    if (!getResourceSyncActionRef.current || resourceData === undefined) return

    const nextAction = getResourceSyncActionRef.current(stateRef.current, resourceData)
    if (nextAction) {
      applyAction(nextAction)
    }
  }, [applyAction, resourceData])

  function requestTransition<TResult>(
    intent: Intent,
    options: {
      changed: boolean
      run: () => MaybePromise<TResult>
    }
  ) {
    const { changed, run } = options

    if (!changed) {
      return run()
    }

    if (discard.getPendingIntent(stateRef.current)) {
      return false
    }

    if (hasUnsavedChanges(stateRef.current)) {
      applyAction(discard.queue(intent))
      return false
    }

    return run()
  }

  function cancelDiscard() {
    applyAction(discard.clear())
  }

  function confirmDiscard<TResult>(applyIntent: (intent: Intent) => MaybePromise<TResult>) {
    const pendingIntent = discard.getPendingIntent(stateRef.current)
    if (!pendingIntent) return false

    applyAction(discard.setStatus('applying'))

    try {
      const result = applyIntent(pendingIntent)
      if (result && typeof result === 'object' && 'then' in result) {
        return Promise.resolve(result).finally(() => {
          applyAction(discard.clear())
        })
      }

      applyAction(discard.clear())
      return result
    } catch (error) {
      applyAction(discard.clear())
      throw error
    }
  }

  return {
    state,
    stateRef,
    applyAction,
    requestTransition,
    confirmDiscard,
    cancelDiscard,
  }
}
