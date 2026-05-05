'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { useCrmBeforeUnloadGuard } from '@/app/crm/_hooks/useCrmBeforeUnloadGuard'
import { useCrmIntentGuard } from '@/app/crm/_hooks/useCrmIntentGuard'
import {
  loadJobReview,
  lockJobReview,
  saveJobReview,
} from '@/lib/jobs/client'
import type { JobDetail } from '@/types/jobs/api'
import type { JobReviewReadModel } from '@/types/jobs/feedback'
import {
  areJobReviewFormStatesEqual,
  buildJobReviewFormState,
  type JobReviewFormState,
} from '@/lib/estimate-feedback/forms'
import { lockJobReviewFlow, saveJobReviewFlow } from '../_lib/jobReviewController'
import { buildJobReviewVm } from '../_lib/jobReviewVm'
import {
  loadAcceptedEstimateFeedbackResource,
  useAcceptedEstimateSnapshotRepair,
} from '../../../_hooks/useAcceptedEstimateFeedbackResource'

type JobReviewPageResource = {
  job: JobDetail | null
  model: JobReviewReadModel | null
  form: JobReviewFormState
}

const emptyJobReviewPageResource: JobReviewPageResource = {
  job: null,
  model: null,
  form: buildJobReviewFormState(null),
}

function getJobReviewErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to load job review.'
}

export function useJobReviewPage() {
  const params = useParams()
  const router = useRouter()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const backHref = id && typeof id === 'string' ? `/crm/jobs/${id}` : '/crm/jobs'

  const [reviewing, setReviewing] = useState(false)
  const [locking, setLocking] = useState(false)

  const resource = useEditableResource<JobReviewPageResource>({
    initialData: emptyJobReviewPageResource,
    load: () =>
      loadAcceptedEstimateFeedbackResource<JobReviewReadModel, JobReviewPageResource>({
        jobId: id,
        missingJobIdError: 'Missing job id in URL.',
        loadFeedback: loadJobReview,
        buildMissingSnapshotResource: (job) => ({
          job,
          model: null,
          form: buildJobReviewFormState(null),
        }),
        buildLoadedResource: ({ job, feedback }) => ({
          job,
          model: feedback,
          form: buildJobReviewFormState(feedback),
        }),
      }),
    save: async (current) => {
      if (!id || typeof id !== 'string') {
        throw new Error('Missing job id in URL.')
      }
      const estimateSnapshotId = current.job?.accepted_quote?.estimate_snapshot_id ?? null
      if (!estimateSnapshotId) {
        throw new Error('Accepted estimate snapshot is missing.')
      }

      const result = await saveJobReviewFlow({
        jobId: id,
        estimateSnapshotId,
        form: current.form,
        saveReview: saveJobReview,
      }, 'draft')
      return {
        data: {
          job: current.job,
          model: result.model,
          form: buildJobReviewFormState(result.model),
        },
        notice: result.notice,
      }
    },
    getErrorMessage: getJobReviewErrorMessage,
    isDirty: (current, snapshot) =>
      !areJobReviewFormStatesEqual(current.form, snapshot.form),
    resetOnLoadError: true,
  })

  const { job, model, form } = resource.data
  const snapshotId = job?.accepted_quote?.estimate_snapshot_id ?? null
  const isReadOnly = model?.review?.status === 'locked'
  const loading = resource.loading
  const error = resource.error
  const notice = resource.notice

  const load = useCallback(async () => {
    const result = await resource.reload()
    return result.ok
  }, [resource])

  const { repairingSnapshot, repairSnapshot } = useAcceptedEstimateSnapshotRepair({
    jobId: id,
    resource,
  })

  const setField = useCallback(<TField extends keyof JobReviewFormState>(
    field: TField,
    value: JobReviewFormState[TField]
  ) => {
    resource.setData((current) => ({
      ...current,
      form: { ...current.form, [field]: value },
    }))
  }, [resource])

  const runSave = useCallback(
    async (status: 'draft' | 'reviewed') => {
      if (!id || typeof id !== 'string' || !snapshotId || isReadOnly) return false
      if (status === 'reviewed') {
        setReviewing(true)
      }
      try {
        const result = await resource.runSaveAction(
          async (current) => {
            const saveResult = await saveJobReviewFlow({
              jobId: id,
              estimateSnapshotId: snapshotId,
              form: current.form,
              saveReview: saveJobReview,
            }, status)
            return {
              data: {
                job: current.job,
                model: saveResult.model,
                form: buildJobReviewFormState(saveResult.model),
              },
              notice: saveResult.notice,
            }
          },
          { trackSaving: status === 'draft' }
        )
        return result.ok
      } finally {
        if (status === 'reviewed') {
          setReviewing(false)
        }
      }
    },
    [id, isReadOnly, resource, snapshotId]
  )

  const runLock = useCallback(async () => {
    if (!id || typeof id !== 'string' || !snapshotId || isReadOnly) return false
    setLocking(true)
    try {
      const result = await resource.runSaveAction(
        async (current) => {
          const lockResult = await lockJobReviewFlow({
            jobId: id,
            estimateSnapshotId: snapshotId,
            form: current.form,
            saveReview: saveJobReview,
            lockReview: lockJobReview,
          })
          return {
            data: {
              job: current.job,
              model: lockResult.model,
              form: buildJobReviewFormState(lockResult.model),
            },
            notice: lockResult.notice,
          }
        },
        { trackSaving: false }
      )
      return result.ok
    } finally {
      setLocking(false)
    }
  }, [id, isReadOnly, resource, snapshotId])

  const vm = useMemo(() => buildJobReviewVm({ job, model, form }), [form, job, model])
  const dirty = !loading && !isReadOnly && resource.dirty
  const intentGuard = useCrmIntentGuard<'backToJob'>({
    hasUnsavedChanges: dirty,
    getIntentType: (intent) => intent,
  })
  useCrmBeforeUnloadGuard({ loading, dirty })

  const navigateBack = useCallback(() => {
    router.push(backHref)
    return true
  }, [backHref, router])

  const backToJob = useCallback(() => {
    return intentGuard.requestIntent('backToJob', {
      changed: dirty,
      run: navigateBack,
    })
  }, [dirty, intentGuard, navigateBack])

  const confirmBackToJob = useCallback(() => {
    return intentGuard.confirmDiscard((intent) => {
      if (intent !== 'backToJob') return false
      return navigateBack()
    })
  }, [intentGuard, navigateBack])

  return {
    id,
    backHref,
    job,
    model,
    form,
    dirty,
    vm,
    loading,
    saving: resource.saving,
    reviewing,
    locking,
    repairingSnapshot,
    error,
    notice,
    isReadOnly,
    load,
    setField,
    saveDraft: () => runSave('draft'),
    markReviewed: () => runSave('reviewed'),
    lock: runLock,
    repairSnapshot,
    backToJob,
    confirmBackToJob,
    cancelDiscard: intentGuard.cancelDiscard,
    discardVm: intentGuard.discardVm,
  }
}
