'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type { NotesTaskRow, NotesTasksResponse } from '@/lib/notes/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { notesFetchJson, useNotesMutation } from './core'

type StatusFilter = 'active' | 'completed' | 'archived'
type DueFilter = 'all' | 'overdue' | 'today' | 'upcoming'
type PriorityFilter = 'all' | 'low' | 'medium' | 'high'

type TaskListFilters = {
  status: StatusFilter
  due: DueFilter
  priority: PriorityFilter
  starredOnly: boolean
  search: string
}

export function useTaskList(initialFilters?: Partial<TaskListFilters>) {
  const [status, setStatus] = useState<StatusFilter>(initialFilters?.status ?? 'active')
  const [due, setDue] = useState<DueFilter>(initialFilters?.due ?? 'all')
  const [priority, setPriority] = useState<PriorityFilter>(initialFilters?.priority ?? 'all')
  const [starredOnly, setStarredOnly] = useState(initialFilters?.starredOnly ?? false)
  const [search, setSearch] = useState(initialFilters?.search ?? '')
  const [tasks, setTasks] = useState<NotesTaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { saving, runMutation } = useNotesMutation()

  const buildQuery = useCallback(() => {
    const query = new URLSearchParams()
    query.set('status', status)
    if (status === 'active') query.set('due', due)
    if (priority !== 'all') query.set('priority', priority)
    if (starredOnly) query.set('starred', 'true')
    if (search.trim()) query.set('search', search.trim())
    return query.toString()
  }, [due, priority, search, starredOnly, status])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await notesFetchJson<NotesTasksResponse>(
      `/api/notes/tasks?${buildQuery()}`,
      { cache: 'no-store' },
      'Unable to load tasks.'
    )
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }
    setTasks(result.data.tasks)
    setLoading(false)
  }, [buildQuery])

  useEffect(() => {
    if (search.trim()) return
    void refresh()
  }, [due, priority, refresh, search, starredOnly, status])

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 250)
    return () => clearTimeout(timeout)
  }, [refresh, search])

  const mutate = useCallback(
    async (path: string, method: 'POST' | 'DELETE' = 'POST', body?: Record<string, unknown>) => {
      setError(null)
      const result = await runMutation<unknown>(
        () =>
          authedFetch(path, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          }),
        {
          fallbackMessage: 'Action failed.',
          refresh,
          refreshRoute: true,
          onError: setError,
        }
      )
      return result.ok
    },
    [refresh, runMutation]
  )

  const filters = useMemo(
    () => ({ status, due, priority, starredOnly, search }),
    [status, due, priority, starredOnly, search]
  )

  return {
    tasks,
    loading,
    saving,
    error,
    filters,
    setStatus,
    setDue,
    setPriority,
    setStarredOnly,
    setSearch,
    refresh,
    completeTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}/complete`),
    reopenTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}/reopen`),
    archiveTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}/archive`),
    unarchiveTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}/unarchive`),
    snoozeTask: (taskId: string, action: 'later_today' | 'tomorrow' | 'next_week') =>
      mutate(`/api/notes/tasks/${taskId}/snooze`, 'POST', { action }),
    deleteTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}`, 'DELETE'),
  }
}
