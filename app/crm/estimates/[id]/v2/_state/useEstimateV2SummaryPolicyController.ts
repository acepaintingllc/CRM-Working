'use client'

import { useCallback, useEffect, useRef } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { getApiErrorMessage, parseApiResponse } from '@/lib/client/api'
import { createEstimateV2Error, type EstimateV2Error } from '@/lib/estimator/errors'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'

export type SummaryPolicyDraft = {
  laborDayEnabled: boolean
  dayhours: number
  roundIncrement: number
  laborRate: number
  jobMinEnabled: boolean
  jobMinAmount: number
}

export function useEstimateV2SummaryPolicyController(params: {
  estimateId: string
  routeFamily: EstimateRouteFamily
  refreshPricing: () => Promise<void>
  setError: (value: EstimateV2Error | null) => void
  setPolicySaving: (value: boolean) => void
}) {
  const { estimateId, routeFamily, refreshPricing, setError, setPolicySaving } = params
  const policyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const savePolicyDebounced = useCallback(
    (settings: SummaryPolicyDraft) => {
      if (policyTimerRef.current) clearTimeout(policyTimerRef.current)
      policyTimerRef.current = setTimeout(async () => {
        if (!estimateId) return
        setPolicySaving(true)
        try {
          const response = await authedFetch(routeFamily.estimateApiHref(estimateId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobsettings: {
                labor_day_policy_enabled: settings.laborDayEnabled,
                dayhours: settings.dayhours,
                rounding_increment_hours: settings.roundIncrement,
                override_labor_rate: settings.laborRate,
                job_minimum_enabled: settings.jobMinEnabled,
                job_minimum_amount: settings.jobMinAmount,
              },
            }),
          })
          const parsed = await parseApiResponse(response)
          if (!response.ok) {
            const message = getApiErrorMessage(response, parsed, 'Failed to save pricing policy')
            console.error('Estimate V2 summary policy save failed', {
              estimateId,
              operation: 'savePolicyDebounced',
              status: response.status,
              message,
            })
            setError(createEstimateV2Error(message, { retryable: true }))
            return
          }
          setError(null)
          await refreshPricing()
        } catch (error) {
          console.error('Estimate V2 summary policy save crashed', {
            estimateId,
            operation: 'savePolicyDebounced',
            error,
          })
          setError(createEstimateV2Error('Failed to save pricing policy', { retryable: true }))
        } finally {
          setPolicySaving(false)
        }
      }, 800)
    },
    [estimateId, refreshPricing, routeFamily, setError, setPolicySaving]
  )

  useEffect(
    () => () => {
      if (policyTimerRef.current) clearTimeout(policyTimerRef.current)
    },
    []
  )

  return { savePolicyDebounced }
}
