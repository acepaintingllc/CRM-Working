'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createEstimateV2Store,
  estimateV2StoreSelectors,
  useEstimateV2Store,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  estimateRouteFamily,
  type EstimateRouteFamily,
} from '../../../estimateRouteFamily'
import { useEstimateV2EditorDerivedSections } from '../../_state/useEstimateV2EditorDerivedSections'
import { useEstimateV2EditorLoader } from '../../_state/useEstimateV2EditorLoader'
import { useEstimateV2SaveController } from '../../_state/useEstimateV2SaveController'
import { useEstimateV2DetailsMutations } from './useEstimateV2DetailsMutations'
import { useEstimateV2DetailsRollerOptions } from './useEstimateV2DetailsRollerOptions'
import { useEstimateV2DetailsVm } from './useEstimateV2DetailsVm'

export function useEstimateV2DetailsPage({
  estimateId,
  routeFamily = estimateRouteFamily,
}: {
  estimateId: string
  routeFamily?: EstimateRouteFamily
}) {
  const router = useRouter()
  const [store] = useState(() => createEstimateV2Store())
  const [submitted, setSubmitted] = useState(false)
  const rollerOptionsState = useEstimateV2DetailsRollerOptions()

  useEstimateV2EditorLoader({ estimateId, routeFamily, store })
  const derived = useEstimateV2EditorDerivedSections({ store })
  const effectiveJobProductDefaults = useEstimateV2Store(
    store,
    estimateV2StoreSelectors.effectiveJobProductDefaults
  )
  const { state, vm } = useEstimateV2DetailsVm({ store, rollerOptionsState })

  const saveController = useEstimateV2SaveController({
    estimateId,
    routeFamily,
    store,
    currentSnapshot: derived.calculation.currentSnapshot,
    dirty: derived.calculation.dirty,
    effectiveJobProductDefaults,
  })

  const detailMutations = useEstimateV2DetailsMutations({
    store,
    rollerOptions: rollerOptionsState.options,
  })

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
    dirty: derived.calculation.dirty,
    saveStatus: state.saveStatus,
    estimate: state.estimate,
    job: state.job,
    saveStatusText: derived.save.saveStatusText,
    showValidation: submitted || vm.validationIssues.length > 0,
    routeFamily,
    actions: {
      saveDraft,
      continueToSummary,
      ...detailMutations,
    },
  }
}
