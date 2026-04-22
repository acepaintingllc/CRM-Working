'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type { NotesCursorPage, NotesTaskRow, NotesTasksResponse } from '@/lib/notes/types'
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<NotesCursorPage>({
    next_cursor: null,
    has_more: false,
    limit: 24,
  })
  const { saving, runMutation } = useNotesMutation()

  const buildQuery = useCallback((cursor?: string | null) => {
    const query = new URLSearchParams()
    query.set('status', status)
    if (status === 'active') query.set('due', due)
    if (priority !== 'all') query.set('priority', priority)
    if (starredOnly) query.set('starred', 'true')
    if (search.trim()) query.set('search', search.trim())
    query.set('limit', String(page.limit))
    if (cursor) query.set('cursor', cursor)
    return query.toString()
  }, [due, page.limit, priority, search, starredOnly, status])

  const loadTasks = useCallback(async (mode: 'reset' | 'append', cursor?: string | null) => {
    if (mode === 'append') {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError(null)
    const result = await notesFetchJson<NotesTasksResponse>(
      `/api/notes/tasks?${buildQuery(cursor ?? null)}`,
      { cache: 'no-store' },
      'Unable to load tasks.'
    )
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      setLoadingMore(false)
      return
    }
    setTasks((current) => (mode === 'append' ? [...current, ...result.data.tasks] : result.data.tasks))
    setPage(result.data.page ?? { next_cursor: null, has_more: false, limit: page.limit })
    setLoading(false)
    setLoadingMore(false)
  }, [buildQuery, page.limit])

  const refresh = useCallback(async () => {
    await loadTasks('reset')
  }, [loadTasks])

  useEffect(() => {
    if (search.trim()) return
    void refresh()
  }, [due, priority, refresh, search, starredOnly, status])

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 250)
    return () => clearTimeout(timeout)
  }, [refresh, search])

  const loadMore = useCallback(async () => {
    if (!page.has_more || !page.next_cursor || loadingMore) return
    await loadTasks('append', page.next_cursor)
  }, [loadTasks, loadingMore, page.has_more, page.next_cursor])

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
    loadingMore,
    saving,
    error,
    hasMore: page.has_more,
    filters,
    setStatus,
    setDue,
    setPriority,
    setStarredOnly,
    setSearch,
    refresh,
    loadMore,
    completeTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}/complete`),
    reopenTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}/reopen`),
    archiveTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}/archive`),
    unarchiveTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}/unarchive`),
    snoozeTask: (taskId: string, action: 'later_today' | 'tomorrow' | 'next_week') =>
      mutate(`/api/notes/tasks/${taskId}/snooze`, 'POST', { action }),
    deleteTask: (taskId: string) => mutate(`/api/notes/tasks/${taskId}`, 'DELETE'),
  }
}
