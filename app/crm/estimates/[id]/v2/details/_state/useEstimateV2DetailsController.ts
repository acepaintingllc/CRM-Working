'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { EstimateRouteFamily } from '../../../estimateRouteFamily'
import type { EstimateV2DetailsVm } from '../_lib/estimateV2DetailsVm'
import type { EstimateV2DetailsMutations } from './useEstimateV2DetailsMutations'

type SaveEstimateV2Details = () => Promise<boolean>

export function useEstimateV2DetailsController(params: {
  estimateId: string
  routeFamily: EstimateRouteFamily
  vm: EstimateV2DetailsVm
  dirty: boolean
  saveEstimate: SaveEstimateV2Details
  mutations: EstimateV2DetailsMutations
}) {
  const { estimateId, routeFamily, vm, dirty, saveEstimate, mutations } = params
  const router = useRouter()

  const confirmNavigation = useCallback(() => {
    if (!dirty) return true
    return window.confirm('You have unsaved changes. Leave this workspace?')
  }, [dirty])

  const returnToEditor = useCallback(() => {
    if (!confirmNavigation()) return false
    router.push(routeFamily.editorHref(estimateId))
    return true
  }, [confirmNavigation, estimateId, routeFamily, router])

  const saveDraft = useCallback(() => saveEstimate(), [saveEstimate])

  const continueToSummary = useCallback(async () => {
    if (!vm.canContinueToSummary) return false

    const saved = await saveEstimate()
    if (!saved) return false

    router.push(routeFamily.summaryHref(estimateId))
    return true
  }, [estimateId, routeFamily, router, saveEstimate, vm.canContinueToSummary])

  return {
    actions: useMemo(
      () => ({
        returnToEditor,
        saveDraft,
        continueToSummary,
        ...mutations,
      }),
      [continueToSummary, mutations, returnToEditor, saveDraft]
    ),
  }
}
