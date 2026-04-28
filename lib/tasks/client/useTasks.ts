'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type { TaskDueFilter, TaskRow, TaskStatus, TasksListResponse } from '@/lib/tasks/types'
import { useCallback, useEffect, useMemo, useState } from 'react'

type TaskListStatus = TaskStatus | 'all'

type TaskCreateInput = {
  title: string
  description: string
  due_at: string
  customer_id: string
  job_id: string
  estimate_id: string
}

async function readJson<T>(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      ok: false as const,
      error: typeof payload?.error === 'string' ? payload.error : fallback,
    }
  }
  return { ok: true as const, data: payload as T }
}

export function useTasks() {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [status, setStatus] = useState<TaskListStatus>('open')
  const [due, setDue] = useState<TaskDueFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    params.set('status', status)
    params.set('due', due)
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [due, search, status])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await authedFetch(`/api/tasks?${query}`, { cache: 'no-store' })
    const result = await readJson<TasksListResponse>(response, 'Unable to load tasks.')
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }
    setTasks(result.data.data.tasks)
    setLoading(false)
  }, [query])

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), search.trim() ? 250 : 0)
    return () => clearTimeout(timeout)
  }, [refresh, search])

  const mutate = useCallback(async (path: string, init?: RequestInit) => {
    setSaving(true)
    setError(null)
    const response = await authedFetch(path, init)
    const result = await readJson(response, 'Task action failed.')
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    await refresh()
    return true
  }, [refresh])

  const createTask = useCallback((input: TaskCreateInput) => mutate('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      due_at: input.due_at,
      customer_id: input.customer_id,
      job_id: input.job_id,
      estimate_id: input.estimate_id,
    }),
  }), [mutate])

  return {
    tasks,
    filters: { status, due, search },
    loading,
    saving,
    error,
    setStatus,
    setDue,
    setSearch,
    refresh,
    createTask,
    completeTask: (taskId: string) => mutate(`/api/tasks/${taskId}/complete`, { method: 'POST' }),
    reopenTask: (taskId: string) => mutate(`/api/tasks/${taskId}/reopen`, { method: 'POST' }),
    deleteTask: (taskId: string) => mutate(`/api/tasks/${taskId}`, { method: 'DELETE' }),
  }
}
