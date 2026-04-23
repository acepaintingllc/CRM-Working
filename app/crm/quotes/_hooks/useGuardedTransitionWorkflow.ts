'use client'

import { useRef } from 'react'
import {
  useGuardedEditorWorkflow,
  type GuardedEditorWorkflowPhase,
} from './useGuardedEditorWorkflow'

type TransitionWithType = {
  type: string
}

type Options = {
  isDirty: boolean
}

type GuardedTransitionReplay<TTransition extends TransitionWithType> = (
  transition: TTransition
) => boolean | Promise<boolean>

type RunTransitionOptions<TTransition extends TransitionWithType, TResult> = {
  transition: TTransition
  changed: boolean
  run: () => TResult | Promise<TResult>
  replay: GuardedTransitionReplay<TTransition>
}

export function useGuardedTransitionWorkflow<TTransition extends TransitionWithType>({
  isDirty,
}: Options) {
  const workflow = useGuardedEditorWorkflow<TTransition>({ isDirty })
  const queuedTransitionType = useRef<string | null>(null)
  const replays = useRef<
    Map<string, GuardedTransitionReplay<TTransition>>
  >(
    new Map<string, GuardedTransitionReplay<TTransition>>()
  )

  function runTransition<TResult>({
    transition,
    changed,
    run,
    replay,
  }: RunTransitionOptions<TTransition, TResult>) {
    const result = workflow.runGuarded(transition, {
      changed,
      run,
    })

    if (changed && result === false && queuedTransitionType.current === null) {
      replays.current.set(transition.type, replay)
      queuedTransitionType.current = transition.type
    }

    return result
  }

  function clearQueuedTransition() {
    if (queuedTransitionType.current == null) return
    replays.current.delete(queuedTransitionType.current)
    queuedTransitionType.current = null
  }

  function confirmDiscard() {
    const result = workflow.confirmDiscard((transition) => {
      const replay = replays.current.get(transition.type)
      if (!replay) return false
      return replay(transition)
    })

    if (result !== null && typeof result === 'object' && 'finally' in result) {
      return result.finally(clearQueuedTransition)
    }

    clearQueuedTransition()
    return result
  }

  return {
    runTransition,
    confirmDiscard,
    cancelDiscard: () => {
      clearQueuedTransition()
      return workflow.cancelDiscard()
    },
    markPendingMutation: workflow.markPendingMutation,
    resetPendingMutation: workflow.resetPendingMutation,
    hasUnsavedChanges: workflow.hasUnsavedChanges,
    workflowVm: {
      phase: workflow.workflowVm.phase as GuardedEditorWorkflowPhase,
      isOpen: workflow.workflowVm.isOpen,
      pendingTransitionType: workflow.workflowVm.pendingTransitionType,
      transitionType: workflow.workflowVm.transitionType,
      hasPendingMutation: workflow.workflowVm.hasPendingMutation,
      hasUnsavedChanges: workflow.workflowVm.hasUnsavedChanges,
    },
  }
}
