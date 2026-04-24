'use client'

import { useCallback, useRef, useState } from 'react'
import { type QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'

export type QuoteHomeDeleteStatus = 'idle' | 'confirming' | 'deleting' | 'failed'

export type QuoteHomeDeleteState = {
  status: QuoteHomeDeleteStatus
  confirmingDelete: QuoteHomeJobVersionItemReadModel | null
  deletingId: string | null
  error: string | null
  canCancel: boolean
  canConfirm: boolean
}

type InternalQuoteHomeDeleteState = {
  status: QuoteHomeDeleteStatus
  estimate: QuoteHomeJobVersionItemReadModel | null
  error: string | null
}

const IDLE_DELETE_STATE: InternalQuoteHomeDeleteState = {
  status: 'idle',
  estimate: null,
  error: null,
}

function toPublicDeleteState(
  state: InternalQuoteHomeDeleteState
): QuoteHomeDeleteState {
  const deletingId =
    state.status === 'deleting' ? state.estimate?.estimate_id ?? null : null
  const hasConfirmedEstimate = Boolean(state.estimate)

  return {
    status: state.status,
    confirmingDelete: state.estimate,
    deletingId,
    error: state.error,
    canCancel: state.status !== 'deleting',
    canConfirm:
      hasConfirmedEstimate &&
      (state.status === 'confirming' || state.status === 'failed'),
  }
}

export function useQuotesHomeDelete() {
  const stateRef = useRef<InternalQuoteHomeDeleteState>(IDLE_DELETE_STATE)
  const [state, setState] =
    useState<InternalQuoteHomeDeleteState>(IDLE_DELETE_STATE)

  const transition = useCallback((nextState: InternalQuoteHomeDeleteState) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const requestDeleteVersion = useCallback((estimate: QuoteHomeJobVersionItemReadModel) => {
    if (stateRef.current.status === 'deleting') {
      return false
    }

    transition({
      status: 'confirming',
      estimate,
      error: null,
    })
    return true
  }, [transition])

  const cancelDelete = useCallback(() => {
    if (stateRef.current.status === 'deleting') {
      return false
    }

    transition(IDLE_DELETE_STATE)
    return true
  }, [transition])

  const beginDelete = useCallback(() => {
    const currentState = stateRef.current
    if (
      !currentState.estimate ||
      (currentState.status !== 'confirming' && currentState.status !== 'failed')
    ) {
      return null
    }

    transition({
      status: 'deleting',
      estimate: currentState.estimate,
      error: null,
    })
    return currentState.estimate
  }, [transition])

  const completeDelete = useCallback(() => {
    transition(IDLE_DELETE_STATE)
  }, [transition])

  const failDelete = useCallback((message: string) => {
    const currentState = stateRef.current

    transition({
      status: 'failed',
      estimate: currentState.estimate,
      error: message,
    })
  }, [transition])

  const deleteState = toPublicDeleteState(state)

  return {
    ...deleteState,
    requestDeleteVersion,
    cancelDelete,
    beginDelete,
    completeDelete,
    failDelete,
  }
}
