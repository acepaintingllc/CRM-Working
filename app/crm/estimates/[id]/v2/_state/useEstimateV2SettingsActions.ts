'use client'

import { useCallback, useEffect, useRef } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'

export function useEstimateV2SettingsActions(params: {
  estimateId?: string
  meta: EstimateV2EditorMetaState
}) {
  const { estimateId, meta } = params
  const customerSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const policySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateJobSettings = useCallback(
    (patch: Partial<typeof meta.jobSettingsDraft>) => {
      meta.setJobSettingsDraft((prev) => {
        const next = { ...prev, ...patch }
        if (policySaveTimerRef.current) clearTimeout(policySaveTimerRef.current)
        policySaveTimerRef.current = setTimeout(async () => {
          if (!estimateId) return
          await authedFetch(`/api/estimates/${estimateId}`, {
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
      meta.setDebugMeta((prev) => ({ ...prev, dirtySource: 'job-settings' }))
    },
    [estimateId, meta]
  )

  const flushCustomerSave = useCallback(() => {
    if (customerSaveTimerRef.current) clearTimeout(customerSaveTimerRef.current)
    customerSaveTimerRef.current = setTimeout(async () => {
      const draft = meta.customerDraft
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
  }, [meta.customerDraft])

  const updateCustomer = useCallback(
    (patch: Partial<typeof meta.customerDraft>) => {
      meta.setCustomerDraft((prev) => {
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
      meta.setDebugMeta((prev) => ({ ...prev, dirtySource: 'customer' }))
    },
    [meta]
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
