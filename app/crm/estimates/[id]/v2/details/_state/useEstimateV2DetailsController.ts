'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EstimateRouteFamily } from '../../../estimateRouteFamily'
import type { EstimateV2DetailsVm } from '../_lib/estimateV2DetailsVm'
import type { EstimateV2DetailsMutations } from './useEstimateV2DetailsMutations'

type SaveEstimateV2Details = (trigger: 'manual') => Promise<boolean>

export function useEstimateV2DetailsController(params: {
  estimateId: string
  routeFamily: EstimateRouteFamily
  vm: EstimateV2DetailsVm
  saveEstimate: SaveEstimateV2Details
  mutations: EstimateV2DetailsMutations
}) {
  const { estimateId, routeFamily, vm, saveEstimate, mutations } = params
  const router = useRouter()
  const [submitted, setSubmitted] = useState(false)

  const saveDraft = useCallback(
    () => saveEstimate('manual'),
    [saveEstimate]
  )

  const continueToSummary = useCallback(async () => {
    setSubmitted(true)
    if (!vm.canContinueToSummary) return false

    const ok = await saveEstimate('manual')
    if (ok) router.push(routeFamily.summaryHref(estimateId))
    return ok
  }, [estimateId, routeFamily, router, saveEstimate, vm.canContinueToSummary])

  return {
    showValidation: submitted || vm.validationIssues.length > 0,
    actions: useMemo(
      () => ({
        saveDraft,
        continueToSummary,
        ...mutations,
      }),
      [continueToSummary, mutations, saveDraft]
    ),
  }
}
