'use client'

import type { EstimateV2EditorSaveVm } from './estimateV2EditorTypes'

export function shouldGuardEstimateV2Navigation(params: {
  loading?: boolean
  saving: boolean
  saveVm: Pick<EstimateV2EditorSaveVm, 'dirty' | 'debugMeta'>
}) {
  if (params.loading) return false
  if (params.saveVm.dirty) return true

  return params.saving && params.saveVm.debugMeta.lastSaveTrigger !== null
}
