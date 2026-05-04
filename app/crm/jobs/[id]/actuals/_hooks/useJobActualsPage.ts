'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { useCrmBeforeUnloadGuard } from '@/app/crm/_hooks/useCrmBeforeUnloadGuard'
import { useCrmIntentGuard } from '@/app/crm/_hooks/useCrmIntentGuard'
import {
  loadJobActuals,
  repairAcceptedEstimateSnapshot,
  saveDraftJobActuals,
  submitJobActuals,
  loadJobRecord,
} from '@/lib/jobs/client'
import type { JobDetail } from '@/types/jobs/api'
import type { JobActualsRecord } from '@/types/jobs/feedback'
import {
  areJobActualsFormStatesEqual,
  buildJobActualsFormState,
  type JobActualsFormState,
  validateJobActualsForm,
} from '@/lib/estimate-feedback/forms'
import {
  saveJobActualsDraftFlow,
  submitJobActualsFlow,
} from '../_lib/jobActualsController'
import { buildJobActualsVm } from '../_lib/jobActualsVm'

type JobActualsPageResource = {
  job: JobDetail | null
  actuals: JobActualsRecord | null
  form: JobActualsFormState
}

const emptyJobActualsPageResource: JobActualsPageResource = {
  job: null,
  actuals: null,
  form: buildJobActualsFormState(null),
}

function getJobActualsErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to load job actuals.'
}

export function useJobActualsPage() {
  const params = useParams()
  const router = useRouter()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const backHref = id && typeof id === 'string' ? `/crm/jobs/${id}` : '/crm/jobs'

  const [submitting, setSubmitting] = useState(false)
  const [repairingSnapshot, setRepairingSnapshot] = useState(false)

  const resource = useEditableResource<JobActualsPageResource>({
    initialData: emptyJobActualsPageResource,
    load: async () => {
      if (!id || typeof id !== 'string') {
        throw new Error('Missing job id in URL.')
      }

      const loadedJob = await loadJobRecord(id)
      const acceptedSnapshotId = loadedJob?.accepted_quote?.estimate_snapshot_id ?? null
      if (!acceptedSnapshotId) {
        return {
          job: loadedJob,
          actuals: null,
          form: buildJobActualsFormState(null),
        }
      }

      const loadedActuals = await loadJobActuals(id, acceptedSnapshotId)
      return {
        job: loadedJob,
        actuals: loadedActuals,
        form: buildJobActualsFormState(loadedActuals),
      }
    },
    save: async (current) => {
      if (!id || typeof id !== 'string') {
        throw new Error('Missing job id in URL.')
      }
      const estimateSnapshotId = current.job?.accepted_quote?.estimate_snapshot_id ?? null
      if (!estimateSnapshotId) {
        throw new Error('Accepted estimate snapshot is missing.')
      }

      const result = await saveJobActualsDraftFlow({
        jobId: id,
        estimateSnapshotId,
        form: current.form,
        saveDraft: saveDraftJobActuals,
        submit: submitJobActuals,
      })
      return {
        data: {
          job: current.job,
          actuals: result.actuals,
          form: buildJobActualsFormState(result.actuals),
        },
        notice: result.notice,
      }
    },
    getErrorMessage: getJobActualsErrorMessage,
    isDirty: (current, snapshot) =>
      !areJobActualsFormStatesEqual(current.form, snapshot.form),
    resetOnLoadError: true,
  })

  const { job, actuals, form } = resource.data
  const snapshotId = job?.accepted_quote?.estimate_snapshot_id ?? null
  const isReadOnly = actuals?.status === 'submitted' || actuals?.status === 'locked'
  const loading = resource.loading
  const error = resource.error
  const notice = resource.notice

  const load = useCallback(async () => {
    const result = await resource.reload()
    return result.ok
  }, [resource])

  const setField = useCallback((field: keyof JobActualsFormState, value: string) => {
    resource.setData((current) => ({
      ...current,
      form: { ...current.form, [field]: value },
    }))
  }, [resource])

  const runDraftSave = useCallback(async () => {
    if (!id || typeof id !== 'string' || !snapshotId) return false
    const result = await resource.saveChanges()
    return result.ok
  }, [id, resource, snapshotId])

  const runSubmit = useCallback(async () => {
    if (!id || typeof id !== 'string' || !snapshotId) return false
    setSubmitting(true)
    try {
      const result = await resource.runSaveAction(
        async (current) => {
          const submitResult = await submitJobActualsFlow({
            jobId: id,
            estimateSnapshotId: snapshotId,
            form: current.form,
            saveDraft: saveDraftJobActuals,
            submit: submitJobActuals,
          })
          return {
            data: {
              job: current.job,
              actuals: submitResult.actuals,
              form: buildJobActualsFormState(submitResult.actuals),
            },
            notice: submitResult.notice,
            error: submitResult.ok
              ? null
              : submitResult.submitError instanceof Error
                ? submitResult.submitError.message
                : 'Failed to submit job actuals.',
          }
        },
        { trackSaving: false }
      )
      return result.ok
    } finally {
      setSubmitting(false)
    }
  }, [id, resource, snapshotId])

  const repairSnapshot = useCallback(async () => {
    if (!id || typeof id !== 'string') return false
    setRepairingSnapshot(true)
    resource.clearFeedback()
    try {
      const result = await repairAcceptedEstimateSnapshot(id)
      const loaded = await load()
      if (loaded) resource.setNotice(result.notice ?? 'Accepted estimate snapshot repaired.')
      return loaded
    } catch (repairError) {
      resource.setError(
        repairError instanceof Error
          ? repairError.message
          : 'Failed to repair accepted estimate snapshot.'
      )
      return false
    } finally {
      setRepairingSnapshot(false)
    }
  }, [id, load, resource])

  const vm = useMemo(() => buildJobActualsVm({ job, form }), [form, job])
  const validation = useMemo(() => validateJobActualsForm(form), [form])
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
    actuals,
    form,
    dirty,
    validation,
    vm,
    loading,
    saving: resource.saving,
    submitting,
    repairingSnapshot,
    error,
    notice,
    isReadOnly,
    load,
    setField,
    saveDraft: runDraftSave,
    submit: runSubmit,
    repairSnapshot,
    backToJob,
    confirmBackToJob,
    cancelDiscard: intentGuard.cancelDiscard,
    discardVm: intentGuard.discardVm,
  }
}
