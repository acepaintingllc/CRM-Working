'use client'

import { useEffect, useReducer } from 'react'
import {
  loadEstimateV2RatesFlagsPayload,
  type EstimateV2RatesFlagsLoadResult,
} from '@/lib/estimates/v2/client'
import {
  parseRollerCoverOptionsStateFromRatesFlags,
  type DetailsRollerOptionsState,
} from '../_lib/estimateV2DetailsVm'

export const initialRollerOptionsState: DetailsRollerOptionsState = {
  status: 'loading',
  options: [],
  message: 'Loading roller and applicator options.',
}

export type RollerOptionsLoadAction =
  | {
      type: 'loading'
    }
  | {
      type: 'loaded'
      result: EstimateV2RatesFlagsLoadResult
    }
  | {
      type: 'failed'
      message?: string
    }

export function reduceRollerOptionsLoadState(
  _state: DetailsRollerOptionsState,
  action: RollerOptionsLoadAction
): DetailsRollerOptionsState {
  if (action.type === 'loading') return initialRollerOptionsState

  if (action.type === 'failed') {
    return {
      status: 'unavailable',
      options: [],
      message: action.message ?? 'Roller and applicator options failed to load.',
    }
  }

  if (!action.result.ok) {
    return {
      status: 'unavailable',
      options: [],
      message: action.result.message,
    }
  }

  return parseRollerCoverOptionsStateFromRatesFlags(action.result.payload)
}

export function useEstimateV2DetailsRollerOptions() {
  const [rollerOptionsState, dispatch] = useReducer(
    reduceRollerOptionsLoadState,
    initialRollerOptionsState
  )

  useEffect(() => {
    let active = true
    async function loadRollerOptions() {
      dispatch({ type: 'loading' })
      try {
        const result = await loadEstimateV2RatesFlagsPayload()
        if (!active) return
        dispatch({ type: 'loaded', result })
      } catch {
        if (!active) return
        dispatch({ type: 'failed' })
      }
    }
    void loadRollerOptions()
    return () => {
      active = false
    }
  }, [])

  return rollerOptionsState
}
