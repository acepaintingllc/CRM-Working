'use client'

import { useState } from 'react'
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
import { useEstimateV2BeforeUnload } from '../../_state/useEstimateV2BeforeUnload'
import { useEstimateV2SaveController } from '../../_state/useEstimateV2SaveController'
import { useEstimateV2DetailsController } from './useEstimateV2DetailsController'
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
  const [store] = useState(() => createEstimateV2Store())
  const rollerOptionsState = useEstimateV2DetailsRollerOptions()

  useEstimateV2EditorLoader({ estimateId, routeFamily, store })
  const derived = useEstimateV2EditorDerivedSections({ store })
  const effectiveJobProductDefaults = useEstimateV2Store(
    store,
    estimateV2StoreSelectors.effectiveJobProductDefaults
  )
  const { state, vm } = useEstimateV2DetailsVm({ store, rollerOptionsState })
  const dirty = derived.calculation.dirty

  useEstimateV2BeforeUnload({ loading: state.loading, dirty })

  const { save: saveEstimateV2 } = useEstimateV2SaveController({
    estimateId,
    routeFamily,
    store,
    currentSnapshot: derived.calculation.currentSnapshot,
    dirty,
    effectiveJobProductDefaults,
  })

  const detailMutations = useEstimateV2DetailsMutations({
    store,
    rollerOptions: rollerOptionsState.options,
    vm,
  })

  const controller = useEstimateV2DetailsController({
    estimateId,
    routeFamily,
    vm,
    dirty,
    saveEstimate: saveEstimateV2,
    mutations: detailMutations,
  })

  return {
    vm,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    dirty,
    saveStatus: state.saveStatus,
    estimate: state.estimate,
    job: state.job,
    saveStatusText: derived.save.saveStatusText,
    routeFamily,
    actions: controller.actions,
  }
}
