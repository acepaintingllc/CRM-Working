import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeV2CeilingsDrafts } from '../v2CeilingsSanitize.ts'

test('sanitize keeps only first RECT scope (by position) and drops all segments', () => {
  const result = sanitizeV2CeilingsDrafts({
    rooms: [{ roomId: 'R001', lengthIn: '120', widthIn: '144', position: 0 }],
    ceilingScopes: [
      { id: 'scope-a', roomId: 'R001', position: 1, mode: 'RECT', lengthIn: '200', widthIn: '180' },
      { id: 'scope-b', roomId: 'R001', position: 0, mode: 'RECT', lengthIn: '300', widthIn: '240' },
    ],
    ceilingSegments: [
      { id: 'seg-1', ceilingScopeId: 'scope-a', position: 0 },
      { id: 'seg-2', ceilingScopeId: 'scope-b', position: 0 },
    ],
  })

  assert.equal(result.ceilingScopes.length, 1)
  assert.equal(result.ceilingScopes[0].id, 'scope-b')
  assert.equal(result.ceilingScopes[0].position, 0)
  assert.equal(result.ceilingSegments.length, 0)
  assert.equal(result.changed, true)
})

test('sanitize auto-fills lengthIn/widthIn from room dims when blank', () => {
  // Room is 10ft x 12ft (120in x 144in)
  const result = sanitizeV2CeilingsDrafts({
    rooms: [{ roomId: 'R001', lengthIn: '120', widthIn: '144', position: 0 }],
    ceilingScopes: [
      { id: 'scope-rect', roomId: 'R001', position: 0, mode: 'RECT', lengthIn: '', widthIn: '' },
    ],
    ceilingSegments: [],
  })

  assert.equal(result.ceilingScopes.length, 1)
  assert.equal(result.ceilingScopes[0].lengthIn, '120')
  assert.equal(result.ceilingScopes[0].widthIn, '144')
  assert.equal(result.changed, true)
})

test('sanitize does not overwrite lengthIn/widthIn already set', () => {
  const result = sanitizeV2CeilingsDrafts({
    rooms: [{ roomId: 'R001', lengthIn: '120', widthIn: '144', position: 0 }],
    ceilingScopes: [
      { id: 'scope-rect', roomId: 'R001', position: 0, mode: 'RECT', lengthIn: '200', widthIn: '180' },
    ],
    ceilingSegments: [],
  })

  assert.equal(result.ceilingScopes[0].lengthIn, '200')
  assert.equal(result.ceilingScopes[0].widthIn, '180')
  assert.equal(result.changed, false)
})

test('sanitize reindexes SEG scopes/segments and drops orphan segments', () => {
  const result = sanitizeV2CeilingsDrafts({
    rooms: [{ roomId: 'R010', lengthIn: '', widthIn: '', position: 0 }],
    ceilingScopes: [
      { id: 'seg-scope-2', roomId: 'R010', position: 8, mode: 'SEG', lengthIn: '', widthIn: '' },
      { id: 'seg-scope-1', roomId: 'R010', position: 2, mode: 'SEG', lengthIn: '', widthIn: '' },
    ],
    ceilingSegments: [
      { id: 'seg-1b', ceilingScopeId: 'seg-scope-1', position: 2 },
      { id: 'seg-1a', ceilingScopeId: 'seg-scope-1', position: 0 },
      { id: 'seg-2a', ceilingScopeId: 'seg-scope-2', position: 7 },
      { id: 'seg-orphan', ceilingScopeId: 'unknown-scope', position: 1 },
    ],
  })

  assert.equal(result.ceilingScopes.length, 2)
  assert.deepEqual(result.ceilingScopes.map((s) => [s.id, s.position]), [
    ['seg-scope-1', 0],
    ['seg-scope-2', 1],
  ])
  assert.equal(result.ceilingSegments.length, 3)
  assert.deepEqual(result.ceilingSegments.map((s) => [s.id, s.ceilingScopeId, s.position]), [
    ['seg-1a', 'seg-scope-1', 0],
    ['seg-1b', 'seg-scope-1', 1],
    ['seg-2a', 'seg-scope-2', 0],
  ])
  assert.equal(result.changed, true)
})

test('sanitize reports changed=false when input is already normalized', () => {
  const result = sanitizeV2CeilingsDrafts({
    rooms: [{ roomId: 'R020', lengthIn: '', widthIn: '', position: 0 }],
    ceilingScopes: [
      { id: 'scope-seg', roomId: 'R020', position: 0, mode: 'SEG', lengthIn: '', widthIn: '' },
    ],
    ceilingSegments: [{ id: 'seg-1', ceilingScopeId: 'scope-seg', position: 0 }],
  })

  assert.equal(result.changed, false)
  assert.equal(result.ceilingScopes.length, 1)
  assert.equal(result.ceilingSegments.length, 1)
  assert.equal(result.ceilingScopes[0].position, 0)
  assert.equal(result.ceilingSegments[0].position, 0)
})
