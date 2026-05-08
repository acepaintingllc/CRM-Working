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

test('completed workflow links actuals when accepted quote snapshot is missing', () => {
  const actions = getJobWorkflowActions('detail', {
    id: 'job-1',
    status: 'completed',
    linked_estimate_id: 'estimate-1',
    accepted_estimate: { estimate_snapshot_id: null },
  })

  const actuals = actions.find((action) => action.id === 'open_job_actuals')
  const review = actions.find((action) => action.id === 'open_estimate_review')

  assert.equal(actuals?.kind, 'navigate')
  assert.equal(actuals?.href, '/crm/jobs/job-1/actuals')
  assert.equal(actuals?.disabledReason, undefined)
  assert.equal(review?.kind, 'message')
  assert.equal(review?.disabledReason, 'Submit job actuals before quote review.')
})

test('completed workflow links review with missing snapshot after actuals are submitted', () => {
  const actions = getJobWorkflowActions('detail', {
    id: 'job-1',
    status: 'completed',
    linked_estimate_id: 'estimate-1',
    accepted_estimate: { estimate_snapshot_id: null },
    job_actuals_status: 'submitted',
  })

  const review = actions.find((action) => action.id === 'open_estimate_review')

  assert.equal(review?.kind, 'navigate')
  assert.equal(review?.href, '/crm/jobs/job-1/review')
  assert.equal(review?.disabledReason, undefined)
})

test('completed workflow blocks actuals and review without an accepted estimate', () => {
  const actions = getJobWorkflowActions('detail', {
    id: 'job-1',
    status: 'completed',
    linked_estimate_id: 'legacy-navigation-estimate',
    estimate_navigation_id: 'legacy-navigation-estimate',
    accepted_estimate: null,
    job_actuals_status: 'submitted',
  })

  const actuals = actions.find((action) => action.id === 'open_job_actuals')
  const review = actions.find((action) => action.id === 'open_estimate_review')

  assert.equal(actuals?.kind, 'message')
  assert.equal(actuals?.disabledReason, 'Accept a quote before entering job actuals.')
  assert.equal(review?.kind, 'message')
  assert.equal(review?.disabledReason, 'Accept a quote before reviewing the quote.')
})

test('quote navigation can use an explicit non-canonical fallback estimate id', () => {
  const actions = getJobWorkflowActions('detail', {
    id: 'job-1',
    status: 'estimate_scheduled',
    linked_estimate_id: null,
    estimate_navigation_id: 'draft-estimate',
  })

  const quote = actions.find((action) => action.id === 'open_quote')

  assert.equal(quote?.kind, 'navigate')
  assert.equal(quote?.href, '/crm/quotes/draft-estimate')
})

test('quote navigation uses the explicit navigation contract instead of operational accepted-estimate fields', () => {
  const actions = getJobWorkflowActions('detail', {
    id: 'job-1',
    status: 'completed',
    linked_estimate_id: 'linked-estimate',
    estimate_navigation_id: 'draft-estimate',
    accepted_estimate: {
      estimate_id: 'accepted-estimate',
      estimate_snapshot_id: 'snapshot-1',
    },
  })

  const quote = actions.find((action) => action.id === 'open_quote')

  assert.equal(quote?.href, '/crm/quotes/draft-estimate')
})

test('completed workflow blocks review until actuals are submitted or locked', () => {
  const draftActions = getJobWorkflowActions('detail', {
    id: 'job-1',
    status: 'completed',
    linked_estimate_id: 'estimate-1',
    accepted_estimate: { estimate_snapshot_id: 'snapshot-1' },
    job_actuals_status: 'draft',
  })
  const lockedActions = getJobWorkflowActions('detail', {
    id: 'job-1',
    status: 'completed',
    linked_estimate_id: 'estimate-1',
    accepted_estimate: { estimate_snapshot_id: null },
    job_actuals_status: 'locked',
  })

  const draftReview = draftActions.find((action) => action.id === 'open_estimate_review')
  const lockedReview = lockedActions.find((action) => action.id === 'open_estimate_review')

  assert.equal(draftReview?.kind, 'message')
  assert.equal(draftReview?.disabledReason, 'Submit job actuals before quote review.')
  assert.equal(lockedReview?.kind, 'navigate')
  assert.equal(lockedReview?.href, '/crm/jobs/job-1/review')
})
