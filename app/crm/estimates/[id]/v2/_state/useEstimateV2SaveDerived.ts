'use client'

import { useMemo } from 'react'
import { formatDateTime } from '../_lib/estimateV2EditorNormalize'
import { getSaveStatusText } from '@/lib/estimator/v2WallsAutosave'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'

export function useEstimateV2SaveDerived(params: {
  meta: Pick<
    EstimateV2EditorMetaState,
    'saving' | 'saveStatus' | 'autoSaveHint' | 'error' | 'estimate'
  >
  dirty: boolean
}) {
  const { meta, dirty } = params

  const saveStatusText = useMemo(
    () =>
      getSaveStatusText({
        saving: meta.saving,
        saveStatus: meta.saveStatus,
        dirty,
        autoSaveHint: meta.autoSaveHint,
        error: meta.error?.message ?? null,
        updatedAt: meta.estimate?.updated_at ?? null,
        formatDateTime,
      }),
    [
      dirty,
      meta.autoSaveHint,
      meta.error?.message,
      meta.estimate?.updated_at,
      meta.saveStatus,
      meta.saving,
    ]
  )
  const saveStatusColor =
    meta.saveStatus === 'error'
      ? '#fecaca'
      : dirty || meta.saveStatus === 'blocked'
        ? '#f9e2b7'
        : 'var(--v2-ink-3)'

  return {
    saveStatusText,
    saveStatusColor,
  }
}
