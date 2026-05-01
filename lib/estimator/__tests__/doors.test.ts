import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDoors } from '../doors.ts'

test('calculateDoors calculates included door units from quantity and sides using unit_rates_doors', () => {
  const result = calculateDoors({
    scopes: [{
      id: 'door-1',
      room_id: 'ROOM-1',
      include: 'Y',
      door_type_id: 'STD',
      quantity: 2,
      sides: 2,
      paint_coats: 2,
      prime_mode: 'NONE',
    }],
    settings: { labor_rate_per_hour: 80, crew_size: 1 },
    catalogs: {
      door_unit_rates: [{
        id: 'STD',
        label: 'Standard Door',
        unit_rate_type: 'interior',
        unit: 'EA',
        default_qty: 1,
        labor_rate: 0.25,
        material_rate: 5,
        amount: 0,
      }],
    },
  })

  assert.equal(result.scopes[0].raw_units, 4)
  assert.equal(result.scopes[0].effective_units, 4)
  assert.equal(result.scopes[0].raw_paint_hours, 2)
  assert.equal(result.scopes[0].effective_paint_hours, 2)
  assert.equal(result.scopes[0].raw_material_cost, 20)
  assert.equal(result.scopes[0].effective_material_cost, 20)
  assert.equal(result.scopes[0].raw_total, 180)
  assert.equal(result.scopes[0].effective_total, 180)
  assert.equal(result.room_totals[0].room_id, 'ROOM-1')
  assert.equal(result.room_totals[0].effective_total, 180)
})

test('calculateDoors applies total override without losing raw values', () => {
  const result = calculateDoors({
    scopes: [{
      id: 'door-override',
      room_id: 'ROOM-1',
      include: 'Y',
      door_type_id: 'STD',
      quantity: 1,
      sides: 1,
      paint_coats: 1,
      prime_mode: 'NONE',
      override_total: 99,
    }],
    settings: { labor_rate_per_hour: 80 },
    catalogs: {
      door_unit_rates: [{
        id: 'STD',
        label: 'Standard Door',
        unit_rate_type: null,
        unit: 'EA',
        default_qty: 1,
        labor_rate: 0.25,
        material_rate: 5,
        amount: 0,
      }],
    },
  })

  assert.equal(result.scopes[0].raw_total, 25)
  assert.equal(result.scopes[0].effective_total, 99)
})

test('calculateDoors reports missing door type for included rows', () => {
  const result = calculateDoors({
    scopes: [{ id: 'missing-type', room_id: 'ROOM-1', include: 'Y', quantity: 1, sides: 2 }],
    settings: { labor_rate_per_hour: 80 },
    catalogs: { door_unit_rates: [] },
  })

  assert.equal(result.missing_inputs.some((issue) => issue.field === 'door_type_id'), true)
})

test('calculateDoors requires quantity and sides instead of using hidden defaults', () => {
  const result = calculateDoors({
    scopes: [{
      id: 'door-missing-inputs',
      room_id: 'ROOM-1',
      include: 'Y',
      door_type_id: 'STD',
      paint_coats: 1,
      prime_mode: 'NONE',
    }],
    settings: { labor_rate_per_hour: 100 },
    catalogs: {
      door_unit_rates: [{
        id: 'STD',
        label: 'Standard Door',
        unit_rate_type: 'interior',
        unit: 'EA',
        default_qty: 3,
        labor_rate: 0.2,
        material_rate: 4,
        amount: 0,
      }],
    },
  })

  assert.equal(result.missing_inputs.some((issue) => issue.field === 'quantity'), true)
  assert.equal(result.missing_inputs.some((issue) => issue.field === 'sides'), true)
  assert.equal(result.scopes[0].raw_units, 0)
  assert.equal(result.scopes[0].effective_units, 0)
  assert.equal(result.scopes[0].effective_total, 0)
})

test('calculateDoors supports one-sided doors without applying a hidden second side', () => {
  const result = calculateDoors({
    scopes: [{
      id: 'door-one-side',
      room_id: 'ROOM-1',
      include: 'Y',
      door_type_id: 'STD',
      quantity: 2,
      sides: 1,
      paint_coats: 2,
      prime_mode: 'NONE',
    }],
    settings: { labor_rate_per_hour: 80 },
    catalogs: {
      door_unit_rates: [{
        id: 'STD',
        label: 'Standard Door',
        unit_rate_type: 'interior',
        unit: 'EA',
        default_qty: 1,
        labor_rate: 0.25,
        material_rate: 5,
        amount: 0,
      }],
    },
  })

  assert.equal(result.scopes[0].effective_units, 2)
  assert.equal(result.scopes[0].effective_paint_hours, 1)
  assert.equal(result.scopes[0].effective_material_cost, 10)
  assert.equal(result.scopes[0].effective_total, 90)
})

test('calculateDoors keeps excluded door scopes visible but out of totals', () => {
  const result = calculateDoors({
    scopes: [{
      id: 'door-excluded',
      room_id: 'ROOM-1',
      include: 'N',
      door_type_id: 'STD',
      quantity: 5,
      sides: 2,
      paint_coats: 2,
      prime_mode: 'FULL',
      override_total: 999,
    }],
    settings: { labor_rate_per_hour: 80 },
    catalogs: {
      door_unit_rates: [{
        id: 'STD',
        label: 'Standard Door',
        unit_rate_type: 'interior',
        unit: 'EA',
        default_qty: 1,
        labor_rate: 0.25,
        material_rate: 5,
        amount: 0,
      }],
    },
  })

  assert.equal(result.scopes[0].raw_units, 0)
  assert.equal(result.scopes[0].effective_total, 0)
  assert.equal(result.room_totals[0].scope_count, 1)
  assert.equal(result.room_totals[0].included_scope_count, 0)
  assert.equal(result.room_totals[0].effective_total, 0)
})

test('calculateDoors applies paint, primer, material, and supply overrides independently', () => {
  const result = calculateDoors({
    scopes: [{
      id: 'door-overrides',
      room_id: 'ROOM-1',
      include: 'Y',
      door_type_id: 'STD',
      quantity: 1,
      sides: 2,
      paint_coats: 2,
      primer_coats: 1,
      prime_mode: 'FULL',
      override_paint_hours: 3,
      override_primer_hours: 1.5,
      override_material_cost: 22,
      override_supply_cost: 8,
    }],
    settings: { labor_rate_per_hour: 80 },
    catalogs: {
      door_unit_rates: [{
        id: 'STD',
        label: 'Standard Door',
        unit_rate_type: 'interior',
        unit: 'EA',
        default_qty: 1,
        labor_rate: 0.25,
        material_rate: 5,
        amount: 0,
      }],
    },
  })

  assert.equal(result.scopes[0].raw_paint_hours, 1)
  assert.equal(result.scopes[0].effective_paint_hours, 3)
  assert.equal(result.scopes[0].raw_primer_hours, 0.5)
  assert.equal(result.scopes[0].effective_primer_hours, 1.5)
  assert.equal(result.scopes[0].raw_material_cost, 10)
  assert.equal(result.scopes[0].effective_material_cost, 22)
  assert.equal(result.scopes[0].effective_supply_cost, 8)
  assert.equal(result.scopes[0].effective_total, 390)
})

test('calculateDoors clamps spot prime percent and applies condition factor', () => {
  const result = calculateDoors({
    scopes: [{
      id: 'door-spot',
      room_id: 'ROOM-1',
      include: 'Y',
      door_type_id: 'STD',
      quantity: 1,
      sides: 2,
      paint_coats: 1,
      primer_coats: 1,
      prime_mode: 'SPOT',
      spot_prime_percent: 150,
      condition_factor: 1.5,
    }],
    settings: { labor_rate_per_hour: 100 },
    catalogs: {
      door_unit_rates: [{
        id: 'STD',
        label: 'Standard Door',
        unit_rate_type: 'interior',
        unit: 'EA',
        default_qty: 1,
        labor_rate: 0.5,
        material_rate: 0,
        amount: 0,
      }],
    },
  })

  assert.equal(result.scopes[0].raw_paint_hours, 1.5)
  assert.equal(result.scopes[0].raw_primer_hours, 1.5)
  assert.equal(result.scopes[0].effective_total, 300)
})
