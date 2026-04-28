import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TasksPage from '../page'

const mockUseTasks = vi.hoisted(() => vi.fn())
const mockFetchJobList = vi.hoisted(() => vi.fn())

vi.mock('@/lib/tasks/client/useTasks', () => ({
  useTasks: mockUseTasks,
}))

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList: mockFetchJobList,
}))

describe('TasksPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mockFetchJobList.mockResolvedValue([
      {
        id: 'job-current',
        customer_id: 'customer-current',
        customer_name: 'Ada Home',
        customer_address: '12 Current St',
        title: 'Interior repaint',
        description: null,
        status: 'scheduled',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: '2026-05-01T14:00:00.000Z',
        completed_at: null,
        linked_estimate_id: 'estimate-current',
      },
      {
        id: 'job-completed',
        customer_id: 'customer-completed',
        customer_name: 'Done Customer',
        customer_address: null,
        title: 'Completed repaint',
        description: null,
        status: 'completed',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        completed_at: '2026-04-20T14:00:00.000Z',
        linked_estimate_id: 'estimate-completed',
      },
    ])
    mockUseTasks.mockReturnValue({
      tasks: [
        {
          id: 'task-1',
          title: 'Call customer',
          description: 'Ask about color choice',
          status: 'open',
          due_at: '2026-04-28T15:00:00.000Z',
          customer_id: 'customer-1',
          job_id: null,
          estimate_id: null,
        },
      ],
      filters: { status: 'open', due: 'all', search: '' },
      loading: false,
      saving: false,
      error: null,
      setStatus: vi.fn(),
      setDue: vi.fn(),
      setSearch: vi.fn(),
      createTask: vi.fn().mockResolvedValue(true),
      completeTask: vi.fn().mockResolvedValue(true),
      reopenTask: vi.fn().mockResolvedValue(true),
      deleteTask: vi.fn().mockResolvedValue(true),
    })
  })

  it('renders a simple task list without notes UI', () => {
    render(<TasksPage />)

    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeTruthy()
    expect(screen.getByText('Call customer')).toBeTruthy()
    expect(screen.getByText('Ask about color choice')).toBeTruthy()
    expect(screen.getByText('Customer linked')).toBeTruthy()
    expect(screen.queryByText('Notes')).toBeNull()
    expect(screen.queryByText('Priority')).toBeNull()
    expect(screen.queryByText('Recurrence')).toBeNull()
  })

  it('creates a task from the quick form', async () => {
    const createTask = vi.fn().mockResolvedValue(true)
    mockUseTasks.mockReturnValue({
      ...mockUseTasks(),
      createTask,
    })

    render(<TasksPage />)

    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Order paint' } })
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-04-29' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({
        title: 'Order paint',
        description: '',
        due_at: '2026-04-29',
        customer_id: '',
        job_id: '',
        estimate_id: '',
      })
    })
  })

  it('links tasks to current Job Center jobs instead of raw IDs', async () => {
    const createTask = vi.fn().mockResolvedValue(true)
    mockUseTasks.mockReturnValue({
      ...mockUseTasks(),
      createTask,
    })

    render(<TasksPage />)

    const relatedJob = await screen.findByLabelText('Related job')
    expect(screen.getByRole('option', { name: /Interior repaint/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Completed repaint/ })).toBeNull()
    expect(screen.queryByLabelText('Customer ID')).toBeNull()
    expect(screen.queryByLabelText('Job ID')).toBeNull()
    expect(screen.queryByLabelText('Estimate ID')).toBeNull()

    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Confirm start time' } })
    fireEvent.change(relatedJob, { target: { value: 'job-current' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({
        title: 'Confirm start time',
        description: '',
        due_at: '',
        customer_id: 'customer-current',
        job_id: 'job-current',
        estimate_id: 'estimate-current',
      })
    })
  })

  it('uses simple open and done actions', async () => {
    const completeTask = vi.fn().mockResolvedValue(true)
    mockUseTasks.mockReturnValue({
      ...mockUseTasks(),
      completeTask,
    })

    render(<TasksPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Complete Call customer' }))

    await waitFor(() => {
      expect(completeTask).toHaveBeenCalledWith('task-1')
    })
  })
})
