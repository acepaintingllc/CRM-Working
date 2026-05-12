import assert from 'node:assert/strict'
import test from 'node:test'

import { calculatePrejobTrips } from '../prejobTrips.ts'

test('calculatePrejobTrips: calculates active room and job-level trip totals', () => {
  const result = calculatePrejobTrips({
    rows: [
      {
        id: 'room-trip',
        room_id: 'r001',
        trip_name: 'Wallpaper removal prep',
        trip_num: 2,
        trip_rate: 75,
        manual_adjustment: 25,
        active: 'Y',
      },
      {
        id: 'job-trip',
        trip_name: 'Site protection',
        trip_num: 1,
        trip_rate: 40,
        active: 'Y',
      },
    ],
  })

  assert.deepEqual(
    {
      id: result.scopes[0]?.id,
      room_id: result.scopes[0]?.room_id,
      trip_count: result.scopes[0]?.trip_count,
      trip_rate: result.scopes[0]?.trip_rate,
      manual_adjustment: result.scopes[0]?.manual_adjustment,
      calculated_total: result.scopes[0]?.calculated_total,
      effective_total: result.scopes[0]?.effective_total,
    },
    {
      id: 'room-trip',
      room_id: 'R001',
      trip_count: 2,
      trip_rate: 75,
      manual_adjustment: 25,
      calculated_total: 150,
      effective_total: 175,
    },
  )
  assert.deepEqual(result.room_totals, [{ room_id: 'R001', effective_total: 175 }])
  assert.equal(result.job_level_total, 40)
})

test('calculatePrejobTrips: treats negative and inactive values as zero for pricing', () => {
  const result = calculatePrejobTrips({
    rows: [
      {
        id: 'inactive',
        trip_num: 2,
        trip_rate: 75,
        manual_adjustment: 25,
        active: 'N',
      },
      {
        id: 'negative',
        trip_num: -2,
        trip_rate: -75,
        manual_adjustment: -25,
        active: 'Y',
      },
    ],
  })

  assert.deepEqual(
    result.scopes.map((row) => row.effective_total),
    [0, 0],
  )
  assert.equal(result.job_level_total, 0)
})

test('calculatePrejobTrips: normalizes raw prejob rows for snapshot compatibility', () => {
  const result = calculatePrejobTrips({
    rows: [
      {
        id: 'prejob-raw-1',
        room_id: 'room-1',
        active: 'Y',
        trip_name: 'Wallpaper prep',
        trip_num: '2',
        trip_rate: '75',
        manual_adjustment: '25',
      },
      {
        id: 'prejob-inactive',
        active: 'N',
        trip_num: 2,
        trip_rate: 75,
        manual_adjustment: 25,
      },
    ],
  })

  assert.deepEqual(
    {
      room_id: result.scopes[0]?.room_id,
      include: result.scopes[0]?.include,
      trip_count: result.scopes[0]?.trip_count,
      trip_rate: result.scopes[0]?.trip_rate,
      manual_adjustment: result.scopes[0]?.manual_adjustment,
      calculated_total: result.scopes[0]?.calculated_total,
      raw_total: result.scopes[0]?.raw_total,
      effective_total: result.scopes[0]?.effective_total,
    },
    {
      room_id: 'ROOM-1',
      include: 'Y',
      trip_count: 2,
      trip_rate: 75,
      manual_adjustment: 25,
      calculated_total: 150,
      raw_total: 175,
      effective_total: 175,
    },
  )
  assert.equal(result.scopes[1]?.effective_total, 0)
  assert.deepEqual(result.room_totals, [{ room_id: 'ROOM-1', effective_total: 175 }])
  assert.equal(result.job_level_total, 0)
})
