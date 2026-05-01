'use client'

import { useMemo } from 'react'
import {
  type EstimateV2EditorStoreApi,
  useEstimateV2Store,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  buildEstimateV2DetailsVm,
  type DetailsRollerOptionsState,
  extractEstimateV2DetailsCalculationRows,
} from '../_lib/estimateV2DetailsVm'
import {
  parseConditionModifiers,
  emptyConditionSelections,
} from '../_lib/estimateV2DetailsConditions'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

export function useEstimateV2DetailsVm(params: {
  store: EstimateV2EditorStoreApi
  rollerOptionsState: DetailsRollerOptionsState
  ratesFlagsPayload: RatesFlagsPayload | null
}) {
  const state = useEstimateV2Store(params.store, (current) => ({
    rooms: current.collections.rooms,
    wallScopes: current.collections.scopes,
    ceilingScopes: current.collections.ceilingScopes,
    trimScopes: current.collections.trimScopes,
    accessFees: current.collections.accessFees,
    rollers: current.collections.rollers ?? [],
    loading: current.meta.loading,
    saving: current.meta.saving,
    error: current.meta.error,
    estimate: current.meta.estimate,
    job: current.meta.job,
    catalogs: current.meta.catalogs,
    wallCalculations: current.meta.wallCalculations,
    ceilingCalculations: current.meta.ceilingCalculations,
    trimCalculations: current.meta.trimCalculations,
    pricingSummary: current.meta.pricingSummary,
    crewSize: current.meta.jobSettingsDraft.crewSize,
    conditionSelections: current.meta.jobSettingsDraft.conditionSelections,
    saveStatus: current.meta.saveStatus,
  }))

  const calculationRows = useMemo(
    () =>
      extractEstimateV2DetailsCalculationRows({
        wallCalculations: state.wallCalculations,
        ceilingCalculations: state.ceilingCalculations,
        trimCalculations: state.trimCalculations,
      }),
    [state.ceilingCalculations, state.trimCalculations, state.wallCalculations]
  )

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

  const conditionModifiers = useMemo(
    () => (params.ratesFlagsPayload ? parseConditionModifiers(params.ratesFlagsPayload) : []),
    [params.ratesFlagsPayload]
  )

  const vm = useMemo(
    () =>
      buildEstimateV2DetailsVm({
        rooms: state.rooms,
        wallScopes: state.wallScopes,
        ceilingScopes: state.ceilingScopes,
        trimScopes: state.trimScopes,
        wallCalculations: calculationRows.wallCalculationRows,
        ceilingCalculations: calculationRows.ceilingCalculationRows,
        trimCalculations: calculationRows.trimCalculationRows,
        pricingSummary: state.pricingSummary,
        crewSize: state.crewSize,
        paintProductLabelById,
        colorLabelById,
        rollerOptions: params.rollerOptionsState.options,
        rollerOptionsState: params.rollerOptionsState,
        rollers: state.rollers,
        accessFees: state.accessFees,
        accessFeeCatalog: state.catalogs.access_fees ?? [],
        conditionModifiers,
        conditionSelections: state.conditionSelections ?? emptyConditionSelections(),
      }),
    [
      calculationRows.ceilingCalculationRows,
      calculationRows.trimCalculationRows,
      calculationRows.wallCalculationRows,
      colorLabelById,
      conditionModifiers,
      paintProductLabelById,
      params.rollerOptionsState,
      state.rollers,
      state.accessFees,
      state.ceilingScopes,
      state.conditionSelections,
      state.rooms,
      state.pricingSummary,
      state.crewSize,
      state.catalogs.access_fees,
      state.trimScopes,
      state.wallScopes,
    ]
  )

  return { state, vm }
}
