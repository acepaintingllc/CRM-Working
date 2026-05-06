'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import type {
  StageEmailSentResult,
  StageEmailStage,
} from '@/app/crm/jobs/_components/StageEmailModal'
import {
  addScheduleRow,
  addSchedulesToCalendar,
  deleteScheduleRow,
} from '@/lib/jobs/client'
import {
  addLocalDateTimeHours,
  next8amLocalDateTimeValue,
} from '@/lib/jobs/dateHelpers'
import type { JobScheduleMeta } from '@/types/jobs/api'
import {
  buildJobScheduleListItems,
  emptyJobSchedulePageResource,
  getJobSchedulePageErrorMessage,
  invalidateJobScheduleResources,
  loadJobSchedulePageResource,
  mutationNotice,
} from '../_lib/jobSchedulePageResource'

type JobScheduleDraft = {
  startLocal: string
  endLocal: string
  notes: string
}

function getSchedulePageId(params: ReturnType<typeof useParams>) {
  const rawId = (params as { id?: string } | null | undefined)?.id
  return Array.isArray(rawId) ? rawId[0] : rawId
}

function createDefaultDraft(): JobScheduleDraft {
  const startLocal = next8amLocalDateTimeValue()
  return {
    startLocal,
    endLocal: addLocalDateTimeHours(startLocal, 8),
    notes: '',
  }
}

export function useJobSchedulePage() {
  const params = useParams()
  const id = getSchedulePageId(params)
  const backHref = id && typeof id === 'string' ? `/crm/jobs/${id}` : '/crm/jobs'

  const [draft, setDraft] = useState<JobScheduleDraft>(() => createDefaultDraft())
  const [addingCalendar, setAddingCalendar] = useState(false)
  const [emailStage, setEmailStage] = useState<StageEmailStage | null>(null)

  const resource = useEditableResource({
    initialData: emptyJobSchedulePageResource,
    load: () => loadJobSchedulePageResource(id),
    save: async (current) => ({ data: current }),
    getErrorMessage: getJobSchedulePageErrorMessage,
    isDirty: () => false,
    resetOnLoadError: true,
  })

  const load = useCallback(async () => {
    const result = await resource.reload()
    return result.ok
  }, [resource])

  const clearFeedback = useCallback(() => {
    resource.clearFeedback()
  }, [resource])

  const setStartLocal = useCallback((value: string) => {
    clearFeedback()
    setDraft((current) => ({ ...current, startLocal: value }))
  }, [clearFeedback])

  const setEndLocal = useCallback((value: string) => {
    clearFeedback()
    setDraft((current) => ({ ...current, endLocal: value }))
  }, [clearFeedback])

  const setNotes = useCallback((value: string) => {
    clearFeedback()
    setDraft((current) => ({ ...current, notes: value }))
  }, [clearFeedback])

  const addSchedule = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      resource.setError('Missing job id in URL.')
      return false
    }

    const result = await resource.runSaveAction(async () => {
      const created = await addScheduleRow(id, {
        start_at: draft.startLocal,
        end_at: draft.endLocal,
        notes: draft.notes.trim() || null,
      })
      const nextData = await loadJobSchedulePageResource(id)
      return {
        data: nextData,
        notice: mutationNotice(created, 'Schedule added.'),
      }
    })

    if (!result.ok) return false

    setDraft((current) => ({ ...current, notes: '' }))
    await invalidateJobScheduleResources(id)
    return true
  }, [draft.endLocal, draft.notes, draft.startLocal, id, resource])

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    if (!id || typeof id !== 'string') {
      resource.setError('Missing job id in URL.')
      return false
    }
    if (!window.confirm('Delete this scheduled block?')) return false

    const result = await resource.runSaveAction(
      async () => {
        const deleted = await deleteScheduleRow(id, scheduleId)
        const nextData = await loadJobSchedulePageResource(id)
        return {
          data: nextData,
          notice: mutationNotice(deleted, 'Schedule deleted.'),
        }
      },
      { trackSaving: false }
    )

    if (!result.ok) return false

    await invalidateJobScheduleResources(id)
    return true
  }, [id, resource])

  const addToCalendar = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      resource.setError('Missing job id in URL.')
      return false
    }

    setAddingCalendar(true)
    try {
      const result = await resource.runSaveAction(
        async () => {
          const added = await addSchedulesToCalendar(id)
          const nextData = await loadJobSchedulePageResource(id)
          return {
            data: nextData,
            notice: mutationNotice(added, 'Added schedules to calendar.'),
          }
        },
        { trackSaving: false }
      )

      if (!result.ok) return false

      await invalidateJobScheduleResources(id)
      return true
    } finally {
      setAddingCalendar(false)
    }
  }, [id, resource])

  const openScheduledEmail = useCallback(() => {
    clearFeedback()
    setEmailStage('scheduled')
  }, [clearFeedback])

  const closeStageEmail = useCallback(() => {
    setEmailStage(null)
  }, [])

  const handleStageEmailSent = useCallback((result: StageEmailSentResult) => {
    clearFeedback()
    if (result.job) {
      const patch = result.job as Partial<JobScheduleMeta>
      resource.setData((current) => ({
        ...current,
        jobMeta: current.jobMeta ? { ...current.jobMeta, ...patch } : current.jobMeta,
      }))
      if (id && typeof id === 'string') {
        void invalidateJobScheduleResources(id)
      }
    }
    resource.setNotice(result.notice ?? result.warning ?? 'Email sent')
  }, [clearFeedback, id, resource])

  const rows = useMemo(() => buildJobScheduleListItems(resource.data.rows), [resource.data.rows])

  return {
    id,
    backHref,
    form: draft,
    rows,
    hasSchedules: rows.length > 0,
    loading: resource.loading,
    error: resource.error,
    notice: resource.notice,
    saving: resource.saving,
    addingCalendar,
    jobMeta: resource.data.jobMeta,
    email: {
      jobId: typeof id === 'string' ? id : null,
      stage: emailStage,
      open: emailStage != null,
    },
    actions: {
      setStartLocal,
      setEndLocal,
      setNotes,
      refresh: load,
      addSchedule,
      deleteSchedule,
      addToCalendar,
      openScheduledEmail,
      closeStageEmail,
      handleStageEmailSent,
    },
  }
}
