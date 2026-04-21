'use client'

import { useCallback, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { authedFetch } from '@/lib/auth/authedFetch'
import type { CustomerTimelineEvent } from '@/lib/customers/types'
import { readJsonResponse } from '../_lib/http'

const emptyTimelineEvents: CustomerTimelineEvent[] = []

export function useCustomerTimeline(customerId: string | undefined) {
  const timelineResource = useLoadableResource<CustomerTimelineEvent[]>({
    initialData: emptyTimelineEvents,
    load: async () => {
      if (typeof customerId !== 'string' || !customerId) return []

      const response = await authedFetch(`/api/customers/${customerId}/timeline`, { cache: 'no-store' })
      const payload = await readJsonResponse<{ events?: CustomerTimelineEvent[]; error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload?.error ?? response.statusText)
      }

      return payload?.events ?? []
    },
    getErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Failed to load customer timeline.',
    reloadKey: customerId,
  })
  const [noteBody, setNoteBody] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const loadTimeline = timelineResource.refresh

  const saveNote = useCallback(async () => {
    if (!noteBody.trim() || typeof customerId !== 'string' || !customerId) return false

    setNoteSaving(true)
    timelineResource.setError(null)
    try {
      const response = await authedFetch(`/api/customers/${customerId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteBody.trim() }),
      })
      const payload = await readJsonResponse<{ error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload?.error ?? response.statusText)
      }

      setNoteBody('')
      await loadTimeline()
      return true
    } catch (error: unknown) {
      timelineResource.setError(
        error instanceof Error ? error.message : 'Failed to save customer note.'
      )
      return false
    } finally {
      setNoteSaving(false)
    }
  }, [customerId, loadTimeline, noteBody])

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
