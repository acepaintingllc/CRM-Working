'use client'

import { useCallback, useEffect, useRef } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import type {
  EstimateV2EditorStoreApi,
  EstimateV2EditorStoreState,
} from '@/lib/estimates/v2/store/estimateV2Store'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'

export function useEstimateV2SettingsActions(params: {
  estimateId?: string
  routeFamily: EstimateRouteFamily
  store: EstimateV2EditorStoreApi
}) {
  const { estimateId, routeFamily, store } = params
  const customerSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const policySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateJobSettings = useCallback(
    (patch: Partial<EstimateV2EditorStoreState['meta']['jobSettingsDraft']>) => {
      store.getState().setJobSettingsDraft((prev) => {
        const next = { ...prev, ...patch }
        if (policySaveTimerRef.current) clearTimeout(policySaveTimerRef.current)
        policySaveTimerRef.current = setTimeout(async () => {
          if (!estimateId) return
          await authedFetch(routeFamily.estimateApiHref(estimateId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobsettings: {
                labor_day_policy_enabled: next.laborDayEnabled,
                dayhours: next.dayhours,
                rounding_increment_hours: next.roundingIncrementHours,
                override_labor_rate: next.laborRate,
                job_minimum_enabled: next.jobMinEnabled,
                job_minimum_amount: next.jobMinAmount,
                walls_paint_id: next.wallPaintProductId || null,
                walls_primer_id: next.wallPrimerProductId || null,
                ceiling_paint_id: next.ceilingPaintProductId || null,
                ceiling_primer_id: next.ceilingPrimerProductId || null,
                trim_paint_id: next.trimPaintProductId || null,
                trim_primer_id: next.trimPrimerProductId || null,
                standard_door_deduction_sf: next.standardDoorDeductionSf,
                standard_window_deduction_sf: next.standardWindowDeductionSf,
                baseboard_opening_deduction_lf: next.baseboardOpeningDeductionLf,
                primer_id:
                  next.wallPrimerProductId ||
                  next.ceilingPrimerProductId ||
                  next.trimPrimerProductId ||
                  null,
              },
            }),
          })
        }, 900)
        return next
      })
      store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'job-settings' }))
    },
    [estimateId, routeFamily, store]
  )

  const flushCustomerSave = useCallback(() => {
    if (customerSaveTimerRef.current) clearTimeout(customerSaveTimerRef.current)
    customerSaveTimerRef.current = setTimeout(async () => {
      const draft = store.getState().meta.customerDraft
      if (!draft.customerId) return
      await authedFetch(`/api/customers/${draft.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name || 'Unknown',
          email: draft.email || null,
          phone: draft.phone || null,
          address: draft.address || null,
        }),
      })
    }, 0)
  }, [store])

  const updateCustomer = useCallback(
    (patch: Partial<EstimateV2EditorStoreState['meta']['customerDraft']>) => {
      store.getState().setCustomerDraft((prev) => {
        const next = { ...prev, ...patch }
        if (customerSaveTimerRef.current) clearTimeout(customerSaveTimerRef.current)
        customerSaveTimerRef.current = setTimeout(async () => {
          if (!next.customerId) return
          await authedFetch(`/api/customers/${next.customerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: next.name || 'Unknown',
              email: next.email || null,
              phone: next.phone || null,
              address: next.address || null,
            }),
          })
        }, 900)
        return next
      })
      store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'customer' }))
    },
    [store]
  )

  useEffect(
    () => () => {
      if (customerSaveTimerRef.current) clearTimeout(customerSaveTimerRef.current)
      if (policySaveTimerRef.current) clearTimeout(policySaveTimerRef.current)
    },
    []
  )

  return {
    updateJobSettings,
    updateCustomer,
    flushCustomerSave,
  }
}
