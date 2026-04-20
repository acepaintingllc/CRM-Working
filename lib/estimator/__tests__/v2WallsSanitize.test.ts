import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeV2WallsDrafts } from '../v2WallsSanitize.ts'

test('sanitize keeps only first RECT scope per room and hydrates perimeter/height from room dimensions', () => {
  const result = sanitizeV2WallsDrafts({
    rooms: [{ roomId: 'R001', lengthIn: '120', widthIn: '144', heightIn: '96', position: 0 }],
    scopes: [
      { id: 'scope-a', roomId: 'R001', position: 1, mode: 'RECT', perimeterIn: '', heightIn: '' },
      { id: 'scope-b', roomId: 'R001', position: 0, mode: 'RECT', perimeterIn: '300', heightIn: '90' },
    ],
    segments: [
      { id: 'seg-dropped', wallScopeId: 'scope-a', position: 0 },
      { id: 'seg-dropped-2', wallScopeId: 'scope-b', position: 1 },
    ],
  })

  assert.equal(result.scopes.length, 1)
  assert.equal(result.scopes[0].id, 'scope-b')
  assert.equal(result.scopes[0].position, 0)
  assert.equal(result.scopes[0].perimeterIn, '300')
  assert.equal(result.scopes[0].heightIn, '90')
  assert.equal(result.segments.length, 0)
  assert.equal(result.changed, true)
})

test('sanitize reindexes SEG scopes/segments and drops orphan segments', () => {
  const result = sanitizeV2WallsDrafts({
    rooms: [{ roomId: 'R010', lengthIn: '', widthIn: '', heightIn: '', position: 0 }],
    scopes: [
      { id: 'seg-scope-2', roomId: 'R010', position: 8, mode: 'SEG', perimeterIn: '', heightIn: '' },
      { id: 'seg-scope-1', roomId: 'R010', position: 2, mode: 'SEG', perimeterIn: '', heightIn: '' },
    ],
    segments: [
      { id: 'seg-1b', wallScopeId: 'seg-scope-1', position: 2 },
      { id: 'seg-1a', wallScopeId: 'seg-scope-1', position: 0 },
      { id: 'seg-2a', wallScopeId: 'seg-scope-2', position: 7 },
      { id: 'seg-orphan', wallScopeId: 'unknown-scope', position: 1 },
    ],
  })

  assert.equal(result.scopes.length, 2)
  assert.deepEqual(result.scopes.map((scope) => [scope.id, scope.position]), [
    ['seg-scope-1', 0],
    ['seg-scope-2', 1],
  ])
  assert.equal(result.segments.length, 3)
  assert.deepEqual(result.segments.map((segment) => [segment.id, segment.wallScopeId, segment.position]), [
    ['seg-1a', 'seg-scope-1', 0],
    ['seg-1b', 'seg-scope-1', 1],
    ['seg-2a', 'seg-scope-2', 0],
  ])
  assert.equal(result.changed, true)
})

test('sanitize reports unchanged when input is already normalized', () => {
  const result = sanitizeV2WallsDrafts({
    rooms: [{ roomId: 'R020', lengthIn: '', widthIn: '', heightIn: '', position: 0 }],
    scopes: [{ id: 'scope-seg', roomId: 'R020', position: 0, mode: 'SEG', perimeterIn: '', heightIn: '' }],
    segments: [{ id: 'seg-1', wallScopeId: 'scope-seg', position: 0 }],
  })
  assert.equal(result.changed, false)
  assert.equal(result.scopes.length, 1)
  assert.equal(result.segments.length, 1)
  assert.equal(result.scopes[0].position, 0)
  assert.equal(result.segments[0].position, 0)
})

test('sanitize hydrates blank RECT perimeter from room length+width', () => {
  // Room is 10ft x 12ft (120in x 144in) → perimeter = 2*(120+144) = 528
  const result = sanitizeV2WallsDrafts({
    rooms: [{ roomId: 'R030', lengthIn: '120', widthIn: '144', heightIn: '96', position: 0 }],
    scopes: [{ id: 'scope-rect', roomId: 'R030', position: 0, mode: 'RECT', perimeterIn: '', heightIn: '' }],
    segments: [],
  })
  assert.equal(result.scopes.length, 1)
  assert.equal(result.scopes[0].perimeterIn, '528')
  assert.equal(result.scopes[0].heightIn, '96')
  assert.equal(result.changed, true)
})

test('sanitize does not overwrite RECT perimeter or height already set', () => {
  const result = sanitizeV2WallsDrafts({
    rooms: [{ roomId: 'R031', lengthIn: '120', widthIn: '144', heightIn: '96', position: 0 }],
    scopes: [{ id: 'scope-rect', roomId: 'R031', position: 0, mode: 'RECT', perimeterIn: '400', heightIn: '108' }],
    segments: [],
  })
  assert.equal(result.scopes[0].perimeterIn, '400')
  assert.equal(result.scopes[0].heightIn, '108')
  assert.equal(result.changed, false)
})
