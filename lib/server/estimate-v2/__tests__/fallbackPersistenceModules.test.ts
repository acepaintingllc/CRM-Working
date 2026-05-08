import { describe, expect, it } from 'vitest'

import { buildEstimateJobColorPersistenceRows } from '../jobColorPersistence.ts'
import { buildEstimatePrejobPersistenceRows } from '../prejobPersistence.ts'
import { buildEstimateRollerPersistenceRows } from '../rollerPersistence.ts'
import { buildEstimateRoomFlagPersistenceRows } from '../roomFlagPersistence.ts'
import { buildEstimateTrimItemPersistenceRows } from '../trimItemPersistence.ts'

const baseParams = {
  orgId: 'org-1',
  estimateId: 'estimate-1',
  jobId: 'job-1',
}

describe('estimate-v2 split persistence modules', () => {
  it('builds roller rows with the existing scope and target filtering', () => {
    expect(
      buildEstimateRollerPersistenceRows({
        ...baseParams,
        rows: [
          {
            id: 'roller-1',
            scope: 'Wall',
            wall_color_id: 'color-1',
            selected_option_id: 'opt-1',
            roller_size_in: '9',
            covers_qty: '2',
            notes: 'Saved roller',
          },
          {
            id: 'roller-2',
            scope: 'Ceiling',
            selected_option_id: 'opt-2',
          },
          {
            id: 'roller-3',
            scope: 'Wall',
            wall_color_id: '',
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        id: 'roller-1',
        position: 0,
        scope: 'Wall',
        wall_color_id: 'COLOR-1',
        selected_option_id: 'opt-1',
        roller_size_in: 9,
        covers_qty: 2,
        notes: 'Saved roller',
        active: 'Y',
      }),
      expect.objectContaining({
        id: 'roller-2',
        position: 1,
        scope: 'Ceiling',
        wall_color_id: null,
        selected_option_id: 'opt-2',
      }),
    ])
  })

  it('builds job color rows with existing color aliases and filters blanks', () => {
    expect(
      buildEstimateJobColorPersistenceRows({
        ...baseParams,
        rows: [
          {
            id: 'color-1',
            wall_color_id: 'white',
            color_name: 'White',
            roller_cover_id: 'cover-9',
            roller_cover_qty: '2',
          },
          {
            id: 'color-2',
            color_id: '',
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        id: 'color-1',
        position: 0,
        color_id: 'WHITE',
        color_name: 'White',
        roller_cover_id: 'COVER-9',
        roller_cover_qty: 2,
        active: 'Y',
      }),
    ])
  })

  it('builds room flag rows with room validation unchanged', () => {
    expect(
      buildEstimateRoomFlagPersistenceRows({
        ...baseParams,
        rows: [
          {
            id: 'flag-1',
            room_id: 'room-1',
            flag_id: ' high ',
          },
          {
            id: 'flag-2',
            room_id: 'room-2',
            flag_id: 'low',
          },
        ],
        validRoomIds: new Set(['ROOM-1']),
      })
    ).toEqual([
      expect.objectContaining({
        id: 'flag-1',
        position: 0,
        room_id: 'ROOM-1',
        flag_id: 'HIGH',
        active: 'Y',
      }),
    ])
  })

  it('builds prejob rows with the same template/manual branching', () => {
    expect(
      buildEstimatePrejobPersistenceRows({
        ...baseParams,
        rows: [
          {
            id: 'prejob-1',
            task_template_id: 'template-1',
            category: 'Prep',
            trip_name: 'Wash',
            trip_num: '2',
            task_name: 'Power wash',
            qty: '3',
            hours_each: '1.5',
            laborrate: '55',
            markup: '20',
            extra_supplies: '15',
            notes: 'note',
          },
          {
            id: 'prejob-2',
            manual_task_name: 'Protect floors',
            man_qty: '2',
            man_hours_each: '0.5',
          },
          {
            id: 'prejob-3',
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        id: 'prejob-1',
        position: 0,
        category: 'Prep',
        trip_name: 'Wash',
        trip_num: 2,
        man_trip_name: null,
        task: 'Power wash',
        qty: 3,
        hours_each: 1.5,
        laborrate: 55,
        markup: 20,
        extra_supplies: 15,
        notes: 'note',
        active: 'Y',
      }),
      expect.objectContaining({
        id: 'prejob-2',
        position: 1,
        man_trip_name: 'Protect floors',
        man_qty: 2,
        man_hours_each: 0.5,
        task: 'Protect floors',
        qty: null,
      }),
    ])
  })

  it('builds trim item rows with unchanged filters and sort fallback', () => {
    expect(
      buildEstimateTrimItemPersistenceRows({
        ...baseParams,
        rows: [
          {
            id: 'trim-1',
            room_id: 'room-1',
            trim_menu_id: 'baseboard',
            qty: '5',
            coats: '2',
            auto_calc: 'Y',
            primer_mode: 'spot',
            spot_prime_pct: '25',
            prep_level_override: 'high',
            door_sides: '2',
            notes: 'note',
            sort_order: '8',
          },
          {
            id: 'trim-2',
            trim_menu_id: 'crown',
            qty: '0',
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        id: 'trim-1',
        room_id: 'room-1',
        trim_menu_id: 'baseboard',
        qty: 5,
        coats: 2,
        auto_calc: 'Y',
        primer_mode: 'spot',
        spot_prime_pct: 25,
        prep_level_override: 'high',
        door_sides: 2,
        notes: 'note',
        active: 'Y',
        sort_order: 8,
      }),
    ])
  })
})
