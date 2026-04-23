import test from 'node:test'
import assert from 'node:assert/strict'
import { getJobWorkflowActions } from '../types.ts'

test('job workflow detail actions no longer include field camera', () => {
  const actions = getJobWorkflowActions('detail', {
    id: 'job-1',
    status: 'scheduled',
    linked_estimate_id: 'estimate-1',
    scheduled_date: '2026-04-22T14:00:00.000Z',
    scheduled_end_date: '2026-04-22T18:00:00.000Z',
  })
  const actionIds = actions.map((action) => action.id)

  assert.equal(actionIds.includes('open_field_camera' as never), false)
  assert.deepEqual(
    actionIds,
    ['edit_send_quote', 'open_quote', 'schedule_job', 'send_scheduled_email', 'mark_completed']
  )
})
