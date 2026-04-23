'use client'

import { useEffect, useRef, useState } from 'react'

type Options<TIntent> = {
  hasUnsavedChanges: boolean
  getHasUnsavedChanges?: () => boolean
  getIntentType: (intent: TIntent) => string | null
}

export type QuoteAdminIntentGuardStatus = 'idle' | 'confirming' | 'applying'

type GuardState<TIntent> = {
  status: QuoteAdminIntentGuardStatus
  pendingIntent: TIntent | null
}

type RequestIntentOptions<TResult> = {
  changed: boolean
  run: () => TResult | Promise<TResult>
}

export function useQuoteAdminIntentGuard<TIntent>({
  hasUnsavedChanges,
  getHasUnsavedChanges,
  getIntentType,
}: Options<TIntent>) {
  const [state, setState] = useState<GuardState<TIntent>>({
    status: 'idle',
    pendingIntent: null,
  })
  const stateRef = useRef(state)
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  const applyingRef = useRef(false)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
    if (
      !hasUnsavedChanges &&
      !(getHasUnsavedChanges?.() ?? false) &&
      stateRef.current.pendingIntent
    ) {
      const nextState: GuardState<TIntent> = {
        status: 'idle',
        pendingIntent: null,
      }
      stateRef.current = nextState
      setState(nextState)
    }
  }, [hasUnsavedChanges, getHasUnsavedChanges])

  function requestIntent<TResult>(
    intent: TIntent,
    { changed, run }: RequestIntentOptions<TResult>
  ) {
    if (!changed) {
      return run()
    }

    if ((getHasUnsavedChanges?.() ?? hasUnsavedChangesRef.current) || hasUnsavedChangesRef.current) {
      if (!stateRef.current.pendingIntent) {
        const nextState: GuardState<TIntent> = {
          status: 'confirming',
          pendingIntent: intent,
        }
        stateRef.current = nextState
        setState(nextState)
      }
      return false
    }

    return run()
  }

  function cancelDiscard() {
    const nextState: GuardState<TIntent> = {
      status: 'idle',
      pendingIntent: null,
    }
    stateRef.current = nextState
    setState(nextState)
  }

  function confirmDiscard<TResult>(
    applyIntent: (intent: TIntent) => TResult | Promise<TResult>
  ): TResult | Promise<TResult> | false {
    const pendingIntent = stateRef.current.pendingIntent
    if (!pendingIntent || applyingRef.current) return false

    applyingRef.current = true
    const applyingState: GuardState<TIntent> = {
      status: 'applying',
      pendingIntent,
    }
    stateRef.current = applyingState
    setState(applyingState)

    const finish = () => {
      applyingRef.current = false
      const nextState: GuardState<TIntent> = {
        status: 'idle',
        pendingIntent: null,
      }
      stateRef.current = nextState
      setState(nextState)
    }

    try {
      const result = applyIntent(pendingIntent)
      if (
        typeof result === 'object' &&
        result !== null &&
        'then' in result &&
        typeof (result as { then: unknown }).then === 'function'
      ) {
        return Promise.resolve(result).finally(finish)
      }

      finish()
      return result
    } catch (error) {
      finish()
      throw error
    }
  }

  return {
    requestIntent,
    confirmDiscard,
    cancelDiscard,
    discardVm: {
      status: state.status,
      isOpen: state.status === 'confirming' && Boolean(state.pendingIntent),
      intent: state.pendingIntent,
      intentType: state.pendingIntent ? getIntentType(state.pendingIntent) : null,
    },
  }
}
