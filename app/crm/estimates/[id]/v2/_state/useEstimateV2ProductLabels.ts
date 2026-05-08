'use client'

import { useCallback, useMemo } from 'react'
import { asText } from '@/lib/estimator/parsing'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'

export type EstimateV2MissingProductConfigurationWarning = {
  title: string
  detail: string
  fixHint: string
  missingLabels: string[]
}

type RequiredDefaultProductIds = {
  wallPaintProductId?: string | null
  wallPrimerProductId?: string | null
  ceilingPaintProductId?: string | null
  ceilingPrimerProductId?: string | null
  trimPaintProductId?: string | null
  trimPrimerProductId?: string | null
}

const REQUIRED_DEFAULT_PRODUCT_FIELDS = [
  { key: 'wallPaintProductId', label: 'walls default paint' },
  { key: 'wallPrimerProductId', label: 'walls default primer' },
  { key: 'ceilingPaintProductId', label: 'ceilings default paint' },
  { key: 'ceilingPrimerProductId', label: 'ceilings default primer' },
  { key: 'trimPaintProductId', label: 'trim default paint' },
  { key: 'trimPrimerProductId', label: 'trim default primer' },
] as const satisfies ReadonlyArray<{
  key: keyof RequiredDefaultProductIds
  label: string
}>

function formatMissingLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

export function buildMissingProductConfigurationWarning(
  defaults: RequiredDefaultProductIds,
  fixHint: string
): EstimateV2MissingProductConfigurationWarning | null {
  const missingLabels = REQUIRED_DEFAULT_PRODUCT_FIELDS.filter(
    ({ key }) => !asText(defaults[key] ?? '')
  ).map(({ label }) => label)

  if (missingLabels.length === 0) return null

  const missingSummary = formatMissingLabels(missingLabels)

  return {
    title: 'Required paint defaults are missing',
    detail: `Missing ${missingSummary}. Pricing and send readiness stay blocked until every required paint and primer default is set.`,
    fixHint,
    missingLabels,
  }
}

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
  const configurationWarning = useMemo(
    () =>
      buildMissingProductConfigurationWarning(
        effectiveJobProductDefaults,
        'Expand the left sidebar and open Paint Defaults to set the missing defaults.'
      ),
    [effectiveJobProductDefaults]
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
    configurationWarning,
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
