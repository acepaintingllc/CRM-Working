'use client'

import { useCallback, useEffect, useRef } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
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
  setPolicySaving: (value: boolean) => void
}) {
  const { estimateId, routeFamily, refreshPricing, setPolicySaving } = params
  const policyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const savePolicyDebounced = useCallback(
    (settings: SummaryPolicyDraft) => {
      if (policyTimerRef.current) clearTimeout(policyTimerRef.current)
      policyTimerRef.current = setTimeout(async () => {
        if (!estimateId) return
        setPolicySaving(true)
        try {
          await authedFetch(routeFamily.estimateApiHref(estimateId), {
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
          await refreshPricing()
        } finally {
          setPolicySaving(false)
        }
      }, 800)
    },
    [estimateId, refreshPricing, routeFamily, setPolicySaving]
  )

  useEffect(
    () => () => {
      if (policyTimerRef.current) clearTimeout(policyTimerRef.current)
    },
    []
  )

  return { savePolicyDebounced }
}
