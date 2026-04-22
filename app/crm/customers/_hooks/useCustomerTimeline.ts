'use client'

import { useCallback, useState } from 'react'
import { useSwrResource } from '@/app/crm/_hooks/useSwrResource'
import { invalidateSwrKey } from '@/app/crm/_hooks/swrCache'
import { saveCustomerTimelineNote } from '@/lib/customers/client'
import type { CustomerTimelineEvent } from '@/lib/customers/types'

const emptyTimelineEvents: CustomerTimelineEvent[] = []

export function useCustomerTimeline(customerId: string | undefined) {
  const timelineKey =
    typeof customerId === 'string' && customerId
      ? `/api/customers/${customerId}/timeline`
      : null
  const timelineResource = useSwrResource<CustomerTimelineEvent[]>(timelineKey, {
    fallbackData: emptyTimelineEvents,
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
      if (timelineKey) {
        await invalidateSwrKey(timelineKey)
      }
      return true
    } catch (error: unknown) {
      setTimelineError(error instanceof Error ? error.message : 'Failed to save customer note.')
      return false
    } finally {
      setNoteSaving(false)
    }
  }, [customerId, noteBody, setTimelineError, timelineKey])

  return {
    timelineEvents: timelineResource.data ?? emptyTimelineEvents,
    timelineLoading: timelineResource.loading,
    timelineError: timelineResource.error,
    noteBody,
    setNoteBody,
    noteSaving,
    loadTimeline,
    saveNote,
  }
}
