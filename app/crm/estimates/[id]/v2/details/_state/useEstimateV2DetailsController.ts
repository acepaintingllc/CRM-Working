'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { EstimateRouteFamily } from '../../../estimateRouteFamily'
import type { EstimateV2DetailsVm } from '../_lib/estimateV2DetailsVm'
import type { EstimateV2DetailsMutations } from './useEstimateV2DetailsMutations'

type SaveEstimateV2Details = () => Promise<boolean>
export type EstimateV2DetailsPendingIntent = 'returnToEditor'
export type EstimateV2DetailsPendingIntentGuard = {
  requestIntent: <TResult>(
    intent: EstimateV2DetailsPendingIntent,
    options: { changed: boolean; run: () => TResult | Promise<TResult> }
  ) => TResult | Promise<TResult> | false
  confirmDiscard: <TResult>(
    applyIntent: (intent: EstimateV2DetailsPendingIntent) => TResult | Promise<TResult>
  ) => TResult | Promise<TResult> | false
  cancelDiscard: () => void
}

export const DETAILS_UNSAVED_CHANGES_MESSAGE =
  'You have unsaved changes. Discard and return to editor?'

export function useEstimateV2DetailsController(params: {
  estimateId: string
  routeFamily: EstimateRouteFamily
  vm: EstimateV2DetailsVm
  dirty: boolean
  saveEstimate: SaveEstimateV2Details
  mutations: EstimateV2DetailsMutations
  intentGuard: EstimateV2DetailsPendingIntentGuard
}) {
  const { estimateId, routeFamily, vm, dirty, saveEstimate, mutations, intentGuard } = params
  const router = useRouter()

  const navigateToEditor = useCallback(() => {
    router.push(routeFamily.editorHref(estimateId))
    return true
  }, [estimateId, routeFamily, router])

  const returnToEditor = useCallback(() => {
    return intentGuard.requestIntent('returnToEditor', {
      changed: dirty,
      run: navigateToEditor,
    })
  }, [dirty, intentGuard, navigateToEditor])

  const confirmReturnToEditor = useCallback(() => {
    return intentGuard.confirmDiscard((intent) => {
      if (intent !== 'returnToEditor') return false
      return navigateToEditor()
    })
  }, [intentGuard, navigateToEditor])

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
        confirmReturnToEditor,
        cancelDiscard: intentGuard.cancelDiscard,
        saveDraft,
        continueToSummary,
        ...mutations,
      }),
      [
        confirmReturnToEditor,
        continueToSummary,
        intentGuard.cancelDiscard,
        mutations,
        returnToEditor,
        saveDraft,
      ]
    ),
  }
}
