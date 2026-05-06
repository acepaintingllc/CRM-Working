import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobDetail, ScheduleRow } from '@/types/jobs/api'
import { useJobSchedulePage } from '../_hooks/useJobSchedulePage'

const mocks = vi.hoisted(() => ({
  addScheduleRow: vi.fn(),
  addSchedulesToCalendar: vi.fn(),
  deleteScheduleRow: vi.fn(),
  fetchJobSchedules: vi.fn(),
  invalidateSwrKey: vi.fn(),
  loadJobRecord: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
}))

vi.mock('@/lib/jobs/client', () => ({
  addScheduleRow: mocks.addScheduleRow,
  addSchedulesToCalendar: mocks.addSchedulesToCalendar,
  deleteScheduleRow: mocks.deleteScheduleRow,
  fetchJobSchedules: mocks.fetchJobSchedules,
  loadJobRecord: mocks.loadJobRecord,
}))

vi.mock('@/app/crm/_hooks/swrCache', () => ({
  invalidateSwrKey: mocks.invalidateSwrKey,
}))

const job = {
  id: 'job-1',
  title: 'Exterior repaint',
  scheduled_email_sent_at: null,
} as JobDetail

function schedule(overrides: Partial<ScheduleRow> = {}): ScheduleRow {
  return {
    id: 'schedule-1',
    start_at: '2026-05-02T13:00:00.000Z',
    end_at: '2026-05-02T21:00:00.000Z',
    notes: null,
    calendar_event_id: null,
    calendar_added_at: null,
    ...overrides,
  }
}

describe('useJobSchedulePage', () => {
  beforeEach(() => {
    mocks.addScheduleRow.mockReset()
    mocks.addSchedulesToCalendar.mockReset()
    mocks.deleteScheduleRow.mockReset()
    mocks.fetchJobSchedules.mockReset()
    mocks.invalidateSwrKey.mockReset()
    mocks.loadJobRecord.mockReset()

    mocks.fetchJobSchedules.mockResolvedValue([schedule()])
    mocks.loadJobRecord.mockResolvedValue(job)
    mocks.addSchedulesToCalendar.mockResolvedValue({
      data: [{ scheduleId: 'schedule-1', eventId: 'event-1', skipped: false }],
      notice: 'Added schedules to calendar.',
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('loads schedules and exposes render-ready rows sorted by start time', async () => {
    mocks.fetchJobSchedules.mockResolvedValue([
      schedule({
        id: 'schedule-late',
        start_at: '2026-05-03T13:00:00.000Z',
        end_at: '2026-05-03T21:00:00.000Z',
      }),
      schedule({
        id: 'schedule-early',
        start_at: '2026-05-01T13:00:00.000Z',
        end_at: '2026-05-01T21:00:00.000Z',
        calendar_event_id: 'event-early',
      }),
    ])

    const { result } = renderHook(() => useJobSchedulePage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mocks.fetchJobSchedules).toHaveBeenCalledWith('job-1')
    expect(mocks.loadJobRecord).toHaveBeenCalledWith('job-1')
    expect(result.current.rows.map((row) => row.id)).toEqual(['schedule-early', 'schedule-late'])
    expect(result.current.rows[0].rangeLabel).toContain('2026')
    expect(result.current.rows[0].calendarStatusLabel).toBe('Added to calendar')
  })

  it('adds a schedule from form state, reloads schedules and metadata, and invalidates job caches', async () => {
    const persistedSchedule = schedule({
      id: 'schedule-new',
      notes: 'Crew access',
    })
    mocks.fetchJobSchedules
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([persistedSchedule])
    mocks.addScheduleRow.mockResolvedValue({
      data: persistedSchedule,
      notice: 'Schedule added.',
    })
    mocks.loadJobRecord
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce({ ...job, scheduled_email_sent_at: null })

    const { result } = renderHook(() => useJobSchedulePage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.actions.setStartLocal('2026-05-02T08:00')
      result.current.actions.setEndLocal('2026-05-02T16:00')
      result.current.actions.setNotes(' Crew access ')
    })

    await act(async () => {
      await result.current.actions.addSchedule()
    })

    expect(mocks.addScheduleRow).toHaveBeenCalledWith('job-1', {
      start_at: '2026-05-02T08:00',
      end_at: '2026-05-02T16:00',
      notes: 'Crew access',
    })
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(2)
    expect(mocks.fetchJobSchedules).toHaveBeenCalledTimes(2)
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs/job-1')
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs')
    expect(result.current.rows[0].id).toBe('schedule-new')
    expect(result.current.form.notes).toBe('')
    expect(result.current.notice).toBe('Schedule added.')
  })

  it('surfaces canonical server validation errors instead of owning a parallel client contract', async () => {
    mocks.addScheduleRow.mockRejectedValue(new Error('end_at must be after start_at'))

    const { result } = renderHook(() => useJobSchedulePage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.actions.setStartLocal('2026-05-02T16:00')
      result.current.actions.setEndLocal('2026-05-02T16:00')
    })

    await act(async () => {
      await result.current.actions.addSchedule()
    })

    expect(mocks.addScheduleRow).toHaveBeenCalledWith('job-1', {
      start_at: '2026-05-02T16:00',
      end_at: '2026-05-02T16:00',
      notes: null,
    })
    expect(result.current.error).toBe('end_at must be after start_at')
  })

  it('refreshes schedules and job metadata after calendar sync and invalidates job caches', async () => {
    const persistedCalendarRow = schedule({
      calendar_event_id: 'event-1',
      calendar_added_at: '2026-05-02T14:00:00.000Z',
    })
    mocks.fetchJobSchedules
      .mockResolvedValueOnce([schedule()])
      .mockResolvedValueOnce([persistedCalendarRow])

    const { result } = renderHook(() => useJobSchedulePage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.actions.addToCalendar()
    })

    expect(mocks.addSchedulesToCalendar).toHaveBeenCalledWith('job-1')
    expect(mocks.fetchJobSchedules).toHaveBeenCalledTimes(2)
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(2)
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs/job-1')
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs')
    expect(result.current.rows[0].calendar_event_id).toBe('event-1')
    expect(result.current.rows[0].calendar_added_at).toBe('2026-05-02T14:00:00.000Z')
    expect(result.current.rows[0].calendarStatusLabel).toBe('Added to calendar')
    expect(result.current.notice).toBe('Added schedules to calendar.')
  })

  it('deletes a schedule, reloads schedules and metadata, and invalidates job caches', async () => {
    mocks.fetchJobSchedules
      .mockResolvedValueOnce([schedule()])
      .mockResolvedValueOnce([])
    mocks.deleteScheduleRow.mockResolvedValue({ data: { ok: true }, notice: 'Schedule deleted.' })

    const { result } = renderHook(() => useJobSchedulePage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.actions.deleteSchedule('schedule-1')
    })

    expect(window.confirm).toHaveBeenCalledWith('Delete this scheduled block?')
    expect(mocks.deleteScheduleRow).toHaveBeenCalledWith('job-1', 'schedule-1')
    expect(mocks.fetchJobSchedules).toHaveBeenCalledTimes(2)
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(2)
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs/job-1')
    expect(mocks.invalidateSwrKey).toHaveBeenCalledWith('/api/jobs')
    expect(result.current.rows).toHaveLength(0)
    expect(result.current.notice).toBe('Schedule deleted.')
  })

  it('updates scheduled email metadata from the stage email result', async () => {
    const { result } = renderHook(() => useJobSchedulePage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.actions.openScheduledEmail()
    })
    expect(result.current.email.stage).toBe('scheduled')

    act(() => {
      result.current.actions.handleStageEmailSent({
        stage: 'scheduled',
        status: 'sent',
        replayed: false,
        job: { scheduled_email_sent_at: '2026-05-02T15:00:00.000Z' },
      })
    })

    expect(result.current.jobMeta?.scheduled_email_sent_at).toBe('2026-05-02T15:00:00.000Z')
    expect(result.current.notice).toBe('Email sent')
  })

  it('retries through the shared resource reload lifecycle', async () => {
    mocks.fetchJobSchedules
      .mockResolvedValueOnce([schedule()])
      .mockResolvedValueOnce([
        schedule({
          id: 'schedule-reloaded',
          start_at: '2026-05-05T13:00:00.000Z',
          end_at: '2026-05-05T21:00:00.000Z',
        }),
      ])

    const { result } = renderHook(() => useJobSchedulePage())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.actions.refresh()
    })

    expect(mocks.fetchJobSchedules).toHaveBeenCalledTimes(2)
    expect(mocks.loadJobRecord).toHaveBeenCalledTimes(2)
    expect(result.current.rows[0].id).toBe('schedule-reloaded')
  })
})
