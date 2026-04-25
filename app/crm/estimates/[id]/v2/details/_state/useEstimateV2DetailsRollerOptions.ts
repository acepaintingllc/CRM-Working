'use client'

import { useEffect, useState } from 'react'
import { loadEstimateV2RatesFlagsPayload } from '@/lib/estimates/v2/client'
import {
  parseRollerCoverOptionsStateFromRatesFlags,
  type DetailsRollerOptionsState,
} from '../_lib/estimateV2DetailsVm'

const initialRollerOptionsState: DetailsRollerOptionsState = {
  status: 'loading',
  options: [],
  message: 'Loading roller and applicator options.',
}

export function useEstimateV2DetailsRollerOptions() {
  const [rollerOptionsState, setRollerOptionsState] =
    useState<DetailsRollerOptionsState>(initialRollerOptionsState)

  useEffect(() => {
    let active = true
    async function loadRollerOptions() {
      const result = await loadEstimateV2RatesFlagsPayload()
      if (!active) return

      if (!result.ok) {
        setRollerOptionsState({
          status: 'unavailable',
          options: [],
          message: result.message,
        })
        return
      }

      setRollerOptionsState(parseRollerCoverOptionsStateFromRatesFlags(result.payload))
    }
    void loadRollerOptions()
    return () => {
      active = false
    }
  }, [])

  return rollerOptionsState
}
