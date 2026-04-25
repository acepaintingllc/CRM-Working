'use client'

import { useMemo } from 'react'
import {
  type EstimateV2EditorStoreApi,
  useEstimateV2Store,
} from '@/lib/estimates/v2/store/estimateV2Store'
import {
  buildEstimateV2DetailsVm,
  type DetailsRollerOptionsState,
} from '../_lib/estimateV2DetailsVm'

export function useEstimateV2DetailsVm(params: {
  store: EstimateV2EditorStoreApi
  rollerOptionsState: DetailsRollerOptionsState
}) {
  const state = useEstimateV2Store(params.store, (current) => ({
    rooms: current.collections.rooms,
    wallScopes: current.collections.scopes,
    ceilingScopes: current.collections.ceilingScopes,
    trimScopes: current.collections.trimScopes,
    rollers: current.collections.rollers,
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
    saveStatus: current.meta.saveStatus,
  }))

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
        rollerOptions: params.rollerOptionsState.options,
        rollerOptionsState: params.rollerOptionsState,
        rollers: state.rollers,
      }),
    [
      colorLabelById,
      paintProductLabelById,
      params.rollerOptionsState,
      state.rollers,
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

  return { state, vm }
}
