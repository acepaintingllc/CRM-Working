'use client'

import { useCallback, useMemo } from 'react'
import { asText } from '@/lib/estimator/parsing'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'

export function resolveDefaultProductLabel(
  productId: string,
  labelForId: (value: string) => string,
  fallback: string
) {
  const resolvedId = asText(productId)
  if (!resolvedId) return fallback
  return labelForId(resolvedId) || resolvedId
}

export function resolveScopeProductStateLabel(params: {
  productId: string
  defaultProductId: string
  labelForId: (value: string) => string
}) {
  const selectedId = asText(params.productId)
  const defaultId = asText(params.defaultProductId)
  if (!selectedId || selectedId === defaultId) {
    return resolveDefaultProductLabel(defaultId, params.labelForId, 'No Default')
  }
  return params.labelForId(selectedId) || selectedId
}

export function useEstimateV2ProductLabels(params: {
  meta: Pick<EstimateV2EditorMetaState, 'jobSettingsDraft' | 'orgJobProductDefaults'>
  productLabelById: Map<string, string>
  firstScope: { paintProductId: string; primerProductId: string } | null
  firstCeilingScope: { paintProductId: string; primerProductId: string } | null
  firstTrimScope: { paintProductId: string; primerProductId: string } | null
  firstDoorScope: { paintProductId: string; primerProductId: string } | null
}) {
  const { meta, productLabelById, firstScope, firstCeilingScope, firstTrimScope, firstDoorScope } = params

  const paintLabelForId = useCallback(
    (paintProductId: string) => productLabelById.get(paintProductId) ?? paintProductId,
    [productLabelById]
  )
  const primerLabelForId = useCallback(
    (primerProductId: string) => productLabelById.get(primerProductId) ?? primerProductId,
    [productLabelById]
  )
  const effectiveJobProductDefaults = useMemo(
    () => ({
      wallPaintProductId:
        meta.jobSettingsDraft.wallPaintProductId || meta.orgJobProductDefaults.wallPaintProductId,
      wallPrimerProductId:
        meta.jobSettingsDraft.wallPrimerProductId || meta.orgJobProductDefaults.wallPrimerProductId,
      ceilingPaintProductId:
        meta.jobSettingsDraft.ceilingPaintProductId ||
        meta.orgJobProductDefaults.ceilingPaintProductId,
      ceilingPrimerProductId:
        meta.jobSettingsDraft.ceilingPrimerProductId ||
        meta.orgJobProductDefaults.ceilingPrimerProductId,
      trimPaintProductId:
        meta.jobSettingsDraft.trimPaintProductId || meta.orgJobProductDefaults.trimPaintProductId,
      trimPrimerProductId:
        meta.jobSettingsDraft.trimPrimerProductId ||
        meta.orgJobProductDefaults.trimPrimerProductId,
    }),
    [meta.jobSettingsDraft, meta.orgJobProductDefaults]
  )

  const orgWallPaintLabel = resolveDefaultProductLabel(
    meta.orgJobProductDefaults.wallPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const orgWallPrimerLabel = resolveDefaultProductLabel(
    meta.orgJobProductDefaults.wallPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const orgCeilingPaintLabel = resolveDefaultProductLabel(
    meta.orgJobProductDefaults.ceilingPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const orgCeilingPrimerLabel = resolveDefaultProductLabel(
    meta.orgJobProductDefaults.ceilingPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const orgTrimPaintLabel = resolveDefaultProductLabel(
    meta.orgJobProductDefaults.trimPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const orgTrimPrimerLabel = resolveDefaultProductLabel(
    meta.orgJobProductDefaults.trimPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const effectiveWallPaintLabel = resolveDefaultProductLabel(
    effectiveJobProductDefaults.wallPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const effectiveWallPrimerLabel = resolveDefaultProductLabel(
    effectiveJobProductDefaults.wallPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const effectiveCeilingPaintLabel = resolveDefaultProductLabel(
    effectiveJobProductDefaults.ceilingPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const effectiveCeilingPrimerLabel = resolveDefaultProductLabel(
    effectiveJobProductDefaults.ceilingPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const effectiveTrimPaintLabel = resolveDefaultProductLabel(
    effectiveJobProductDefaults.trimPaintProductId,
    paintLabelForId,
    'No Default'
  )
  const effectiveTrimPrimerLabel = resolveDefaultProductLabel(
    effectiveJobProductDefaults.trimPrimerProductId,
    primerLabelForId,
    'No Default'
  )
  const wallPaintLabel = firstScope
    ? resolveScopeProductStateLabel({
        productId: firstScope.paintProductId,
        defaultProductId: effectiveJobProductDefaults.wallPaintProductId,
        labelForId: paintLabelForId,
      })
    : effectiveWallPaintLabel
  const wallPrimerLabel = firstScope
    ? resolveScopeProductStateLabel({
        productId: firstScope.primerProductId,
        defaultProductId: effectiveJobProductDefaults.wallPrimerProductId,
        labelForId: primerLabelForId,
      })
    : effectiveWallPrimerLabel
  const ceilingPaintLabel = firstCeilingScope
    ? resolveScopeProductStateLabel({
        productId: firstCeilingScope.paintProductId,
        defaultProductId: effectiveJobProductDefaults.ceilingPaintProductId,
        labelForId: paintLabelForId,
      })
    : effectiveCeilingPaintLabel
  const ceilingPrimerLabel = firstCeilingScope
    ? resolveScopeProductStateLabel({
        productId: firstCeilingScope.primerProductId,
        defaultProductId: effectiveJobProductDefaults.ceilingPrimerProductId,
        labelForId: primerLabelForId,
      })
    : effectiveCeilingPrimerLabel
  const trimPaintLabel = firstTrimScope
    ? resolveScopeProductStateLabel({
        productId: firstTrimScope.paintProductId,
        defaultProductId: effectiveJobProductDefaults.trimPaintProductId,
        labelForId: paintLabelForId,
      })
    : effectiveTrimPaintLabel
  const trimPrimerLabel = firstTrimScope
    ? resolveScopeProductStateLabel({
        productId: firstTrimScope.primerProductId,
        defaultProductId: effectiveJobProductDefaults.trimPrimerProductId,
        labelForId: primerLabelForId,
      })
    : effectiveTrimPrimerLabel
  const doorPaintLabel = firstDoorScope
    ? resolveScopeProductStateLabel({
        productId: firstDoorScope.paintProductId,
        defaultProductId: effectiveJobProductDefaults.trimPaintProductId,
        labelForId: paintLabelForId,
      })
    : effectiveTrimPaintLabel
  const doorPrimerLabel = firstDoorScope
    ? resolveScopeProductStateLabel({
        productId: firstDoorScope.primerProductId,
        defaultProductId: effectiveJobProductDefaults.trimPrimerProductId,
        labelForId: primerLabelForId,
      })
    : effectiveTrimPrimerLabel

  return {
    effectiveJobProductDefaults,
    orgWallPaintLabel,
    orgWallPrimerLabel,
    orgCeilingPaintLabel,
    orgCeilingPrimerLabel,
    orgTrimPaintLabel,
    orgTrimPrimerLabel,
    effectiveWallPaintLabel,
    effectiveWallPrimerLabel,
    effectiveCeilingPaintLabel,
    effectiveCeilingPrimerLabel,
    effectiveTrimPaintLabel,
    effectiveTrimPrimerLabel,
    wallPaintLabel,
    wallPrimerLabel,
    ceilingPaintLabel,
    ceilingPrimerLabel,
    trimPaintLabel,
    trimPrimerLabel,
    doorPaintLabel,
    doorPrimerLabel,
  }
}
