'use client'

import { useMemo } from 'react'
import { formatDateTime } from '../_lib/estimateV2EditorNormalize'
import { getSaveStatusText } from '@/lib/estimator/v2WallsAutosave'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { EstimateV2EditorCollections } from './estimateV2EditorTypes'
import {
  deriveEstimateV2PreparedSaveValidation,
  filterNonBlockingEstimateV2ValidationIssues,
  formatEstimateV2ValidationIssues,
} from './estimateV2EditorSaveOrchestration'

export function useEstimateV2SaveDerived(params: {
  collections: EstimateV2EditorCollections
  meta: Pick<
    EstimateV2EditorMetaState,
    'saving' | 'saveStatus' | 'autoSaveHint' | 'error' | 'estimate' | 'jobSettingsDraft' | 'validationIssues'
  >
  dirty: boolean
}) {
  const { collections, meta, dirty } = params

  const blockingIssues = useMemo(
    () =>
      deriveEstimateV2PreparedSaveValidation({
        collections,
        jobSettingsDraft: meta.jobSettingsDraft,
        trigger: 'manual',
      }).issues,
    [collections, meta.jobSettingsDraft]
  )
  const savedBlockingIssues = useMemo(
    () =>
      !dirty && meta.saveStatus === 'blocked'
        ? formatEstimateV2ValidationIssues({
            issues: filterNonBlockingEstimateV2ValidationIssues(meta.validationIssues),
            collections,
          })
        : [],
    [collections, dirty, meta.saveStatus, meta.validationIssues]
  )
  const blockedReason = blockingIssues[0] ?? savedBlockingIssues[0] ?? meta.autoSaveHint ?? null
  const effectiveSaveStatus =
    blockingIssues.length > 0 || savedBlockingIssues.length > 0
      ? 'blocked'
      : meta.saveStatus === 'blocked'
        ? 'idle'
        : meta.saveStatus
  const visibleValidationIssues = useMemo(
    () =>
      dirty
        ? blockingIssues
        : formatEstimateV2ValidationIssues({
            issues: filterNonBlockingEstimateV2ValidationIssues(meta.validationIssues),
            collections,
          }),
    [blockingIssues, collections, dirty, meta.validationIssues]
  )

  const saveStatusText = useMemo(
    () =>
      getSaveStatusText({
        saving: meta.saving,
        saveStatus: effectiveSaveStatus,
        dirty,
        blockedReason,
        error: null,
        updatedAt: meta.estimate?.updated_at ?? null,
        formatDateTime,
      }),
    [
      blockedReason,
      dirty,
      effectiveSaveStatus,
      meta.estimate?.updated_at,
      meta.saving,
    ]
  )
  const saveStatusColor =
    effectiveSaveStatus === 'error'
      ? '#fecaca'
      : dirty || effectiveSaveStatus === 'blocked'
        ? '#f9e2b7'
        : 'var(--v2-ink-3)'

  return {
    blockingIssues,
    blockedReason,
    visibleValidationIssues,
    canManualSave: dirty && blockingIssues.length === 0,
    saveStatusText,
    saveStatusColor,
  }
}
