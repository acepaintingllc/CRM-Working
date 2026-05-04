'use client'

import { useMemo } from 'react'
import { formatDateTime } from '../_lib/estimateV2EditorNormalize'
import { getSaveStatusText } from '@/lib/estimator/v2WallsAutosave'
import type { EstimateV2EditorMetaState } from './estimateV2EditorTypes'
import type { EstimateV2EditorCollections } from './estimateV2EditorTypes'
import { deriveEstimateV2PreparedSaveValidation } from './estimateV2EditorSaveOrchestration'

function dedupeIssues(issues: string[]) {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const issue of issues) {
    if (seen.has(issue)) continue
    seen.add(issue)
    deduped.push(issue)
  }
  return deduped
}

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
    () => (!dirty && meta.saveStatus === 'blocked' ? dedupeIssues(meta.validationIssues) : []),
    [dirty, meta.saveStatus, meta.validationIssues]
  )
  const blockedReason = blockingIssues[0] ?? savedBlockingIssues[0] ?? meta.autoSaveHint ?? null
  const effectiveSaveStatus =
    blockingIssues.length > 0 || savedBlockingIssues.length > 0
      ? 'blocked'
      : meta.saveStatus === 'blocked'
        ? 'idle'
        : meta.saveStatus
  const visibleValidationIssues = useMemo(
    () => (dirty ? blockingIssues : dedupeIssues(meta.validationIssues)),
    [blockingIssues, dirty, meta.validationIssues]
  )

  const saveStatusText = useMemo(
    () =>
      getSaveStatusText({
        saving: meta.saving,
        saveStatus: effectiveSaveStatus,
        dirty,
        blockedReason,
        error: meta.error?.message ?? null,
        updatedAt: meta.estimate?.updated_at ?? null,
        formatDateTime,
      }),
    [
      blockedReason,
      dirty,
      effectiveSaveStatus,
      meta.error?.message,
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
