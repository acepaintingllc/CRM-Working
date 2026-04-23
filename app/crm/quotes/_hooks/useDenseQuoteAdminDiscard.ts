'use client'

import { useEffect, useRef, useState } from 'react'

type Options<TTransition> = {
  isDirty: boolean
}

export function useDenseQuoteAdminDiscard<TTransition>({ isDirty }: Options<TTransition>) {
  const [pendingDiscardTransition, setPendingDiscardTransition] = useState<TTransition | null>(null)
  const pendingDiscardTransitionRef = useRef<TTransition | null>(null)
  const hasPendingMutationRef = useRef(false)

  useEffect(() => {
    if (!isDirty) {
      setPendingDiscardTransition(null)
      pendingDiscardTransitionRef.current = null
      hasPendingMutationRef.current = false
    }
  }, [isDirty])

  function queueDiscardTransition(transition: TTransition) {
    if (pendingDiscardTransitionRef.current) return false
    pendingDiscardTransitionRef.current = transition
    setPendingDiscardTransition(transition)
    return true
  }

  function cancelDiscard() {
    setPendingDiscardTransition(null)
    pendingDiscardTransitionRef.current = null
  }

  function consumePendingDiscardTransition() {
    const transition = pendingDiscardTransitionRef.current
    setPendingDiscardTransition(null)
    pendingDiscardTransitionRef.current = null
    return transition
  }

  function markPendingMutation() {
    hasPendingMutationRef.current = true
  }

  function hasUnsavedChanges() {
    return isDirty || hasPendingMutationRef.current
  }

  function shouldGuardTransition(changed: boolean) {
    return hasUnsavedChanges() && changed
  }

  return {
    queueDiscardTransition,
    cancelDiscard,
    consumePendingDiscardTransition,
    markPendingMutation,
    hasUnsavedChanges,
    shouldGuardTransition,
    discardVm: {
      isOpen: Boolean(pendingDiscardTransition),
      transitionType: pendingDiscardTransition,
    },
  }
}
