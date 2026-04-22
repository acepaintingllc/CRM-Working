'use client'

import { useCallback, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { loadCustomerTimeline, saveCustomerTimelineNote } from '@/lib/customers/client'
import type { CustomerTimelineEvent } from '@/lib/customers/types'

const emptyTimelineEvents: CustomerTimelineEvent[] = []

export function useCustomerTimeline(customerId: string | undefined) {
  const timelineResource = useLoadableResource<CustomerTimelineEvent[]>({
    initialData: emptyTimelineEvents,
    load: async () => {
      if (typeof customerId !== 'string' || !customerId) return []
      return loadCustomerTimeline(customerId)
    },
    getErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Failed to load customer timeline.',
    reloadKey: customerId,
  })
  const [noteBody, setNoteBody] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const { refresh: loadTimeline, setError: setTimelineError } = timelineResource

  const saveNote = useCallback(async () => {
    if (!noteBody.trim() || typeof customerId !== 'string' || !customerId) return false

    setNoteSaving(true)
    setTimelineError(null)
    try {
      await saveCustomerTimelineNote(customerId, noteBody.trim())
      setNoteBody('')
      await loadTimeline()
      return true
    } catch (error: unknown) {
      setTimelineError(error instanceof Error ? error.message : 'Failed to save customer note.')
      return false
    } finally {
      setNoteSaving(false)
    }
  }, [customerId, loadTimeline, noteBody, setTimelineError])

  return {
    timelineEvents: timelineResource.data,
    timelineLoading: timelineResource.loading,
    timelineError: timelineResource.error,
    noteBody,
    setNoteBody,
    noteSaving,
    loadTimeline,
    saveNote,
  }
}
