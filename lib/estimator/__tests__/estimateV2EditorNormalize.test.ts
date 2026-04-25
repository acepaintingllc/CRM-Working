import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDefaultRoom,
  createDefaultScope,
  inferTrimUnitTypeFromText,
  isCrownTrimType,
  normalizeRoom,
  normalizeRoller,
  normalizeScope,
  resolveRoomModeById,
} from '../../../app/crm/estimates/[id]/v2/_lib/estimateV2EditorNormalize.ts'

test('createDefaultRoom assigns the next sequential room code', () => {
  const room = createDefaultRoom([
    {
      id: '1',
      roomId: 'R001',
      roomName: 'Room 1',
      roomTypeId: '',
      lengthIn: '',
      widthIn: '',
      heightIn: '',
      wallComplexityId: '',
      notes: '',
      position: 0,
    },
    {
      id: '2',
      roomId: 'R003',
      roomName: 'Room 3',
      roomTypeId: '',
      lengthIn: '',
      widthIn: '',
      heightIn: '',
      wallComplexityId: '',
      notes: '',
      position: 1,
    },
  ])

  assert.equal(room.roomId, 'R002')
  assert.equal(room.roomName, 'Room 3')
})

test('normalizeRoom and normalizeScope coerce values into editor drafts', () => {
  const room = normalizeRoom(
    {
      id: 'room-1',
      room_id: 'r010',
      room_name: 'Kitchen',
      length_in: 144,
      width_in: 120,
      wallheight_in: 96,
      wall_complexity_type_id: 'std',
      notes: '  note  ',
    },
    0
  )
  const scope = normalizeScope(
    {
      id: 'scope-1',
      room_id: 'r010',
      mode: 'seg',
      include: 'n',
      color_id: 'c1',
      prime_mode: 'spot',
      paint_coats: 3,
      primer_coats: 2,
      height_factor: 1.25,
    },
    0
  )

  assert.equal(room.roomId, 'R010')
  assert.equal(room.wallComplexityId, 'STD')
  assert.equal(room.lengthIn, '144')
  assert.equal(scope.mode, 'SEG')
  assert.equal(scope.include, 'N')
  assert.equal(scope.colorId, 'C1')
  assert.equal(scope.primeMode, 'SPOT')
  assert.equal(scope.paintCoats, '3')
  assert.equal(scope.heightFactor, '1.25')
})

test('normalizeRoller preserves unassigned wall scope identity and normalizes color ids', () => {
  const scopeRoller = normalizeRoller(
    {
      id: 'roller-unassigned',
      scope: 'Wall',
      wall_color_id: 'scope:wall-unassigned',
      selected_option_id: 'WALL_9',
      roller_size_in: 9,
      covers_qty: 1,
    },
    0
  )
  const colorRoller = normalizeRoller(
    {
      id: 'roller-color',
      scope: 'Wall',
      wall_color_id: 'color1',
      selected_option_id: 'WALL_9',
      roller_size_in: 9,
      covers_qty: 1,
    },
    1
  )

  assert.equal(scopeRoller?.wallColorId, 'scope:wall-unassigned')
  assert.equal(colorRoller?.wallColorId, 'COLOR1')
})

test('resolveRoomModeById prefers scope modes and defaults missing rooms to RECT', () => {
  const roomMode = resolveRoomModeById({
    rooms: [
      {
        id: 'room-1',
        roomId: 'R001',
        roomName: 'Living',
        roomTypeId: '',
        lengthIn: '',
        widthIn: '',
        heightIn: '',
        wallComplexityId: '',
        notes: '',
        position: 0,
      },
      {
        id: 'room-2',
        roomId: 'R002',
        roomName: 'Office',
        roomTypeId: '',
        lengthIn: '',
        widthIn: '',
        heightIn: '',
        wallComplexityId: '',
        notes: '',
        position: 1,
      },
    ],
    wallScopes: [createDefaultScope('R001', 'SEG')],
    ceilingScopes: [],
  })

  assert.equal(roomMode.get('R001'), 'SEG')
  assert.equal(roomMode.get('R002'), 'RECT')
})

test('trim helpers infer units and detect crown profiles', () => {
  assert.equal(inferTrimUnitTypeFromText('Baseboard LF'), 'LF')
  assert.equal(inferTrimUnitTypeFromText('Window casing EA'), 'EA')
  assert.equal(inferTrimUnitTypeFromText('Panel SF'), 'SF')

  assert.equal(
    isCrownTrimType(
      {
        id: 'crown',
        label: 'Crown - Standard',
        family: 'CROWN',
        category: 'Standard',
        unit_type: 'LF',
        helper_allowed: false,
        default_production_rate_id: null,
      },
      null
    ),
    true
  )
})
