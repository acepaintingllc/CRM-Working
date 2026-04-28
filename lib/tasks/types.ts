export type TaskStatus = 'open' | 'done'
export type TaskDueFilter = 'all' | 'today' | 'overdue'

export type TaskRow = {
  id: string
  org_id: string
  title: string
  description: string | null
  status: TaskStatus
  due_at: string | null
  customer_id: string | null
  job_id: string | null
  estimate_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type TasksListFilters = {
  status: TaskStatus | 'all'
  due: TaskDueFilter
  search: string
}

export type TasksListResponse = {
  data: {
    tasks: TaskRow[]
    filters: TasksListFilters
  }
}

export type TaskResponse = {
  data: {
    task: TaskRow
  }
}

export type TaskOkResponse = {
  data: {
    ok: true
  }
}
