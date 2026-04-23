'use client'

import { useEffect, useRef, useState } from 'react'

type Options = {
  isDirty: boolean
}

export type GuardedEditorWorkflowPhase = 'idle' | 'confirming-discard' | 'replaying-transition'

type WorkflowState<TTransition> = {
  phase: GuardedEditorWorkflowPhase
  pendingTransition: TTransition | null
  hasPendingMutation: boolean
}

type RunGuardedOptions<TResult> = {
  changed: boolean
  run: () => TResult | Promise<TResult>
}

type GuardedActionBuilderOptions<TTransition, TArgs extends unknown[], TResult> = {
  getTransition: (...args: TArgs) => TTransition
  changed: (...args: TArgs) => boolean
  run?: (...args: TArgs) => TResult | Promise<TResult>
}

function getPendingTransitionType<TTransition>(transition: TTransition | null) {
  if (transition == null) return null
  if (
    typeof transition === 'object' &&
    'type' in transition &&
    typeof transition.type === 'string'
  ) {
    return transition.type
  }
  return transition
}

export function useGuardedEditorWorkflow<TTransition>({ isDirty }: Options) {
  const [state, setState] = useState<WorkflowState<TTransition>>({
    phase: 'idle',
    pendingTransition: null,
    hasPendingMutation: false,
  })
  const stateRef = useRef(state)
  const replayingRef = useRef(false)

  const hasUnsavedChanges = isDirty || state.hasPendingMutation

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!isDirty) {
      if (stateRef.current.hasPendingMutation || stateRef.current.pendingTransition) {
        setState({
          phase: 'idle',
          pendingTransition: null,
          hasPendingMutation: false,
        })
        stateRef.current = {
          phase: 'idle',
          pendingTransition: null,
          hasPendingMutation: false,
        }
      }
    }
  }, [isDirty])

  function runGuarded<TResult>(
    transition: TTransition,
    { changed, run }: RunGuardedOptions<TResult>
  ) {
    const hasUnsavedChangesNow = isDirty || stateRef.current.hasPendingMutation
    if (hasUnsavedChangesNow && changed) {
      if (!stateRef.current.pendingTransition) {
        stateRef.current = {
          ...stateRef.current,
          phase: 'confirming-discard',
          pendingTransition: transition,
        }
        setState(stateRef.current)
      }
      return false
    }

    return run()
  }

  function confirmDiscard<TResult>(
    replayTransition: (transition: TTransition) => TResult | Promise<TResult>
  ): TResult | Promise<TResult> | false {
    const transition = stateRef.current.pendingTransition
    if (!transition || replayingRef.current) return false

    replayingRef.current = true

    stateRef.current = {
      ...stateRef.current,
      phase: 'replaying-transition',
      pendingTransition: transition,
    }
    setState(stateRef.current)

    const finishReplay = () => {
      setState((current) => ({
        ...current,
        phase: 'idle',
        pendingTransition: null,
      }))
      replayingRef.current = false
      stateRef.current = {
        ...stateRef.current,
        phase: 'idle',
        pendingTransition: null,
      }
    }

    try {
      const result = replayTransition(transition)
      if (
        typeof result === 'object' &&
        result !== null &&
        'then' in result &&
        typeof (result as { then: unknown }).then === 'function'
      ) {
        return Promise.resolve(result).finally(finishReplay)
      }

      finishReplay()
      return result
    } catch (error) {
      finishReplay()
      throw error
    }
  }

  function createGuardedAction<TArgs extends unknown[], TResult>(
    replayTransition: (transition: TTransition) => TResult | Promise<TResult>,
    options: GuardedActionBuilderOptions<TTransition, TArgs, TResult>
  ) {
    return (...args: TArgs) => {
      const transition = options.getTransition(...args)
      const run = () => {
        if (options.run) {
          return options.run(...args)
        }

        return replayTransition(transition)
      }

      return runGuarded(transition, {
        changed: options.changed(...args),
        run,
      })
    }
  }

  function cancelDiscard() {
    stateRef.current = {
      ...stateRef.current,
      phase: 'idle',
      pendingTransition: null,
    }
    setState(stateRef.current)
  }

  function markPendingMutation() {
    if (stateRef.current.hasPendingMutation) return
    stateRef.current = {
      ...stateRef.current,
      hasPendingMutation: true,
    }
    setState(stateRef.current)
  }

  function resetPendingMutation() {
    if (!stateRef.current.hasPendingMutation) return
    stateRef.current = {
      ...stateRef.current,
      hasPendingMutation: false,
    }
    setState(stateRef.current)
  }

  const pendingTransitionType = getPendingTransitionType(state.pendingTransition)

  return {
    runGuarded,
    confirmDiscard,
    createGuardedAction,
    cancelDiscard,
    markPendingMutation,
    resetPendingMutation,
    hasUnsavedChanges,
    workflowVm: {
      phase: state.phase,
      isOpen: state.phase === 'confirming-discard' && Boolean(state.pendingTransition),
      pendingTransition: state.pendingTransition,
      pendingTransitionType,
      transitionType: pendingTransitionType,
      hasPendingMutation: state.hasPendingMutation,
      hasUnsavedChanges,
    },
  }
}
