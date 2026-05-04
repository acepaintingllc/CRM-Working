import assert from 'node:assert/strict'
import test from 'node:test'
import { createSaveRequestTracker, getSaveStatusText, shouldQueueAutosave } from '../v2WallsAutosave.ts'

test('shouldQueueAutosave only when dirty and idle', () => {
  assert.equal(shouldQueueAutosave({ loading: false, saving: false, dirty: true }), true)
  assert.equal(shouldQueueAutosave({ loading: true, saving: false, dirty: true }), false)
  assert.equal(shouldQueueAutosave({ loading: false, saving: true, dirty: true }), false)
  assert.equal(shouldQueueAutosave({ loading: false, saving: false, dirty: false }), false)
})

test('createSaveRequestTracker marks only latest request as current', () => {
  const tracker = createSaveRequestTracker()
  const first = tracker.start()
  const second = tracker.start()
  assert.equal(first, 1)
  assert.equal(second, 2)
  assert.equal(tracker.isLatest(1), false)
  assert.equal(tracker.isLatest(2), true)
  assert.equal(tracker.latest(), 2)
})

test('getSaveStatusText prioritizes saving, errors, blocked, dirty, then saved state', () => {
  const fmt = (value: string | null) => value ?? '(never)'
  assert.equal(
    getSaveStatusText({
      saving: true,
      saveStatus: 'autosaving',
      dirty: true,
      blockedReason: null,
      error: null,
      updatedAt: null,
      formatDateTime: fmt,
    }),
    'Autosaving draft...'
  )
  assert.equal(
    getSaveStatusText({
      saving: false,
      saveStatus: 'error',
      dirty: false,
      blockedReason: null,
      error: 'bad save',
      updatedAt: null,
      formatDateTime: fmt,
    }),
    'bad save'
  )
  assert.equal(
    getSaveStatusText({
      saving: false,
      saveStatus: 'blocked',
      dirty: true,
      blockedReason: 'R001 missing height',
      error: null,
      updatedAt: null,
      formatDateTime: fmt,
    }),
    'Unsaved changes - save blocked: R001 missing height'
  )
  assert.equal(
    getSaveStatusText({
      saving: false,
      saveStatus: 'blocked',
      dirty: false,
      blockedReason: 'R001 missing height',
      error: null,
      updatedAt: '2026-04-18T00:00:00.000Z',
      formatDateTime: fmt,
    }),
    'Unsaved changes - save blocked: R001 missing height'
  )
  assert.equal(
    getSaveStatusText({
      saving: false,
      saveStatus: 'idle',
      dirty: true,
      blockedReason: null,
      error: null,
      updatedAt: null,
      formatDateTime: fmt,
    }),
    'Unsaved changes - ready to save'
  )
  assert.equal(
    getSaveStatusText({
      saving: false,
      saveStatus: 'saved',
      dirty: false,
      blockedReason: null,
      error: null,
      updatedAt: '2026-04-18T00:00:00.000Z',
      formatDateTime: fmt,
    }),
    'Saved 2026-04-18T00:00:00.000Z'
  )
})
