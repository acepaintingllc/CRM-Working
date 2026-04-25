'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authedFetch } from '@/lib/auth/authedFetch'
import { getApiPayloadData, parseApiResponse } from '@/lib/client/api'
import {
  createEstimateV2Store,
  estimateV2StoreSelectors,
  useEstimateV2Store,
} from '@/lib/estimates/v2/store/estimateV2Store'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'
import {
  estimateRouteFamily,
  type EstimateRouteFamily,
} from '../../../estimateRouteFamily'
import { useEstimateV2EditorDerivedSections } from '../../_state/useEstimateV2EditorDerivedSections'
import { useEstimateV2EditorLoader } from '../../_state/useEstimateV2EditorLoader'
import { useEstimateV2SaveController } from '../../_state/useEstimateV2SaveController'
import {
  buildEstimateV2DetailsVm,
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  parseRollerCoverOptionsFromRatesFlags,
  type DetailsOverrideReasons,
  type DetailsRollerState,
} from '../_lib/estimateV2DetailsVm'

export function useEstimateV2DetailsPage({
  estimateId,
  routeFamily = estimateRouteFamily,
}: {
  estimateId: string
  routeFamily?: EstimateRouteFamily
}) {
  const router = useRouter()
  const [store] = useState(() => createEstimateV2Store())
  const [rollerState, setRollerState] = useState<DetailsRollerState>({})
  const [overrideReasons, setOverrideReasons] = useState<DetailsOverrideReasons>({})
  const [submitted, setSubmitted] = useState(false)
  const [rollerOptionsPayload, setRollerOptionsPayload] = useState<RatesFlagsPayload | null>(null)

  useEstimateV2EditorLoader({ estimateId, routeFamily, store })
  const derived = useEstimateV2EditorDerivedSections({ store })
  const effectiveJobProductDefaults = useEstimateV2Store(
    store,
    estimateV2StoreSelectors.effectiveJobProductDefaults
  )
  const state = useEstimateV2Store(store, (current) => ({
    rooms: current.collections.rooms,
    wallScopes: current.collections.scopes,
    ceilingScopes: current.collections.ceilingScopes,
    trimScopes: current.collections.trimScopes,
    loading: current.meta.loading,
    saving: current.meta.saving,
    error: current.meta.error,
    estimate: current.meta.estimate,
    job: current.meta.job,
    catalogs: current.meta.catalogs,
    wallCalculationRows: current.meta.wallCalculations?.scopes ?? null,
    ceilingCalculationRows:
      current.meta.ceilingCalculations &&
      typeof current.meta.ceilingCalculations === 'object' &&
      Array.isArray((current.meta.ceilingCalculations as { scopes?: unknown }).scopes)
        ? ((current.meta.ceilingCalculations as { scopes: Record<string, unknown>[] }).scopes)
        : null,
    trimCalculationRows:
      current.meta.trimCalculations &&
      typeof current.meta.trimCalculations === 'object' &&
      Array.isArray((current.meta.trimCalculations as { scopes?: unknown }).scopes)
        ? ((current.meta.trimCalculations as { scopes: Record<string, unknown>[] }).scopes)
        : null,
    pricingSummary: current.meta.pricingSummary,
  }))

  const saveController = useEstimateV2SaveController({
    estimateId,
    routeFamily,
    store,
    currentSnapshot: derived.calculation.currentSnapshot,
    dirty: derived.calculation.dirty,
    effectiveJobProductDefaults,
  })

  useEffect(() => {
    let active = true
    async function loadRollerOptions() {
      const response = await authedFetch('/api/estimates/v2/rates-flags', { cache: 'no-store' })
      const parsed = await parseApiResponse(response)
      const payload = getApiPayloadData<RatesFlagsPayload>(parsed.json)
      if (active && response.ok && payload) setRollerOptionsPayload(payload)
    }
    void loadRollerOptions()
    return () => {
      active = false
    }
  }, [])

  const paintProductLabelById = useMemo(
    () =>
      new Map(
        state.catalogs.paint_products.map((product) => [
          product.id,
          product.label || product.id,
        ])
      ),
    [state.catalogs.paint_products]
  )

  const colorLabelById = useMemo(
    () => new Map(state.catalogs.color_codes.map((color) => [color.id, color.label])),
    [state.catalogs.color_codes]
  )

  const rollerOptions = useMemo(
    () => parseRollerCoverOptionsFromRatesFlags(rollerOptionsPayload),
    [rollerOptionsPayload]
  )

  const vm = useMemo(
    () =>
      buildEstimateV2DetailsVm({
        rooms: state.rooms,
        wallScopes: state.wallScopes,
        ceilingScopes: state.ceilingScopes,
        trimScopes: state.trimScopes,
        wallCalculations: state.wallCalculationRows,
        ceilingCalculations: state.ceilingCalculationRows,
        trimCalculations: state.trimCalculationRows,
        pricingSummary: state.pricingSummary,
        paintProductLabelById,
        colorLabelById,
        rollerOptions,
        rollerState,
        overrideReasons,
      }),
    [
      colorLabelById,
      overrideReasons,
      paintProductLabelById,
      rollerOptions,
      rollerState,
      state.ceilingCalculationRows,
      state.ceilingScopes,
      state.rooms,
      state.pricingSummary,
      state.trimCalculationRows,
      state.trimScopes,
      state.wallCalculationRows,
      state.wallScopes,
    ]
  )

  const setRollerRow = useCallback((rowId: string, patch: Partial<DetailsRollerState[string]>) => {
    setRollerState((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? { coverId: '', quantity: '', notes: '' }), ...patch },
    }))
  }, [])

  const markDirty = useCallback(() => {
    store.getState().setDebugMeta((prev) => ({ ...prev, dirtySource: 'details-overrides' }))
  }, [store])

  const setWallOverride = useCallback(
    (colorId: string, value: string) => {
      store.getState().setScopes((prev) => {
        return applyWallGroupGallonOverride(prev, colorId, value)
      })
      markDirty()
    },
    [markDirty, store]
  )

  const setCeilingOverride = useCallback(
    (value: string) => {
      store.getState().setCeilingScopes((prev) => {
        return applyCeilingGallonOverride(prev, value)
      })
      markDirty()
    },
    [markDirty, store]
  )

  const setTrimOverride = useCallback(
    (value: string) => {
      store.getState().setTrimScopes((prev) => {
        return applyTrimGallonOverride(prev, value)
      })
      markDirty()
    },
    [markDirty, store]
  )

  const setOverrideReason = useCallback((key: string, value: string) => {
    setOverrideReasons((prev) => ({ ...prev, [key]: value }))
  }, [])

  const saveDraft = useCallback(() => saveController.save('manual'), [saveController])

  const continueToSummary = useCallback(async () => {
    setSubmitted(true)
    if (vm.validationIssues.length > 0) return false
    const ok = await saveController.save('manual')
    if (ok) router.push(routeFamily.summaryHref(estimateId))
    return ok
  }, [estimateId, routeFamily, router, saveController, vm.validationIssues.length])

  return {
    vm,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    estimate: state.estimate,
    job: state.job,
    saveStatusText: derived.save.saveStatusText,
    showValidation: submitted || vm.validationIssues.length > 0,
    routeFamily,
    actions: {
      saveDraft,
      continueToSummary,
      setRollerRow,
      setWallOverride,
      setCeilingOverride,
      setTrimOverride,
      setOverrideReason,
    },
  }
}
