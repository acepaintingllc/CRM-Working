'use client'

import type { NotesDashboardResponse } from '@/lib/notes/types'
import { useCallback, useEffect, useState } from 'react'
import { notesFetchJson } from './core'

export function useNotesDashboard() {
  const [data, setData] = useState<NotesDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await notesFetchJson<NotesDashboardResponse>(
      '/api/notes/dashboard',
      { cache: 'no-store' },
      'Unable to load dashboard.'
    )
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }
    setData(result.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
