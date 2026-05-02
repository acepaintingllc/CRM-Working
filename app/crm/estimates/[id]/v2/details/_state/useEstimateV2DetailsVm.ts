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
import { buildPaintOptionsByScope } from '../../_lib/estimateV2EditorDerived'

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
    jobSettingsDraft: current.meta.jobSettingsDraft,
    orgJobProductDefaults: current.meta.orgJobProductDefaults,
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

  const wallPaintOptions = useMemo(
    () => buildPaintOptionsByScope(state.catalogs.paint_products, 'Walls'),
    [state.catalogs.paint_products]
  )

  const paintProductCoverageById = useMemo(
    () =>
      new Map(
        state.catalogs.paint_products.map((product) => [
          product.id,
          product.coverage_sqft_per_gal_per_coat ?? null,
        ])
      ),
    [state.catalogs.paint_products]
  )

  const ceilingPaintOptions = useMemo(
    () => buildPaintOptionsByScope(state.catalogs.paint_products, 'Ceilings'),
    [state.catalogs.paint_products]
  )

  const trimPaintOptions = useMemo(
    () => buildPaintOptionsByScope(state.catalogs.paint_products, 'Trim'),
    [state.catalogs.paint_products]
  )

  const effectiveJobProductDefaults = useMemo(
    () => ({
      wallPaintProductId:
        state.jobSettingsDraft.wallPaintProductId ||
        state.orgJobProductDefaults.wallPaintProductId,
      wallPrimerProductId:
        state.jobSettingsDraft.wallPrimerProductId ||
        state.orgJobProductDefaults.wallPrimerProductId,
      ceilingPaintProductId:
        state.jobSettingsDraft.ceilingPaintProductId ||
        state.orgJobProductDefaults.ceilingPaintProductId,
      ceilingPrimerProductId:
        state.jobSettingsDraft.ceilingPrimerProductId ||
        state.orgJobProductDefaults.ceilingPrimerProductId,
      trimPaintProductId:
        state.jobSettingsDraft.trimPaintProductId ||
        state.orgJobProductDefaults.trimPaintProductId,
      trimPrimerProductId:
        state.jobSettingsDraft.trimPrimerProductId ||
        state.orgJobProductDefaults.trimPrimerProductId,
    }),
    [state.jobSettingsDraft, state.orgJobProductDefaults]
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
        paintProductCoverageById,
        productDefaults: effectiveJobProductDefaults,
        wallPaintOptions,
        ceilingPaintOptions,
        trimPaintOptions,
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
      ceilingPaintOptions,
      conditionModifiers,
      effectiveJobProductDefaults,
      paintProductLabelById,
      paintProductCoverageById,
      params.rollerOptionsState,
      state.rollers,
      state.accessFees,
      state.ceilingScopes,
      state.conditionSelections,
      state.rooms,
      state.pricingSummary,
      state.crewSize,
      state.catalogs.access_fees,
      state.catalogs.paint_products,
      state.trimScopes,
      state.wallScopes,
      trimPaintOptions,
      wallPaintOptions,
    ]
  )

  return { state, vm }
}
