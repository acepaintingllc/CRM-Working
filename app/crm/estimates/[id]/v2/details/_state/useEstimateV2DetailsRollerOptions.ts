'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { getApiErrorMessage, getApiPayloadData, parseApiResponse } from '@/lib/client/api'
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
      try {
        const response = await authedFetch('/api/estimates/v2/rates-flags', { cache: 'no-store' })
        if (!active) return

        const parsed = await parseApiResponse(response)
        if (!active) return

        if (!response.ok) {
          setRollerOptionsState({
            status: 'unavailable',
            options: [],
            message: getApiErrorMessage(
              response,
              parsed,
              'Roller and applicator options failed to load.'
            ),
          })
          return
        }

        const payload = getApiPayloadData<unknown>(parsed.json)
        if (!payload) {
          setRollerOptionsState({
            status: 'unavailable',
            options: [],
            message: 'Roller and applicator options response was malformed.',
          })
          return
        }

        setRollerOptionsState(parseRollerCoverOptionsStateFromRatesFlags(payload))
      } catch {
        if (!active) return
        setRollerOptionsState({
          status: 'unavailable',
          options: [],
          message: 'Roller and applicator options failed to load.',
        })
      }
    }
    void loadRollerOptions()
    return () => {
      active = false
    }
  }, [])

  return rollerOptionsState
}
