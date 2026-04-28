import { calculateCeilings } from '@/lib/estimator/ceilings'
import { buildEstimatePricingSummaryFromEngines } from '@/lib/estimator/pricingPolicies'
import { calculateTrim } from '@/lib/estimator/trim'
import { calculateWalls } from '@/lib/estimator/walls'
import { productMap } from '@/lib/estimator/wallsHelpers'
import { buildTrimPaintInput } from '@/lib/server/trimPaint'
import type {
  EstimateCustomerSendCalculatedData,
  EstimateCustomerSendRawResources,
} from './contextTypes'
import type { Unsafe } from '@/lib/customer-estimates/types'

export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function resolveRoomModeById(params: {
  rooms: Unsafe[]
  wallScopes: Unsafe[]
  ceilingScopes: Unsafe[]
}) {
  const roomMode = new Map<string, 'RECT' | 'SEG'>()
  for (const scope of params.wallScopes) {
    const roomId = asText(scope.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(scope.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  for (const scope of params.ceilingScopes) {
    const roomId = asText(scope.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(scope.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  for (const room of params.rooms) {
    const roomId = asText(room.room_id).toUpperCase()
    if (!roomId || roomMode.has(roomId)) continue
    roomMode.set(roomId, asText(room.mode).toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
  }
  return roomMode
}

export function deriveEstimateCustomerSendCalculatedData(
  resources: EstimateCustomerSendRawResources
): EstimateCustomerSendCalculatedData {
  const effectiveLaborRate =
    resources.jobsettings.override_labor_rate ?? resources.settingsRow.override_labor_rate ?? null
  const effectiveLaborDayEnabled =
    typeof resources.jobsettings.labor_day_policy_enabled === 'boolean'
      ? resources.jobsettings.labor_day_policy_enabled
      : resources.settingsRow.labor_day_policy_enabled
  const effectiveDayhours = resources.jobsettings.dayhours ?? resources.settingsRow.dayhours ?? 8
  const effectiveRoundingIncrement =
    resources.jobsettings.rounding_increment_hours ??
    resources.settingsRow.rounding_increment_hours ??
    4
  const effectiveJobMinimumEnabled =
    typeof resources.jobsettings.job_minimum_enabled === 'boolean'
      ? resources.jobsettings.job_minimum_enabled
      : resources.settingsRow.job_minimum_enabled
  const effectiveJobMinimumAmount =
    resources.jobsettings.job_minimum_amount ?? resources.settingsRow.job_minimum_amount ?? 0

  let quoteWallScopes = resources.wallScopes
  let quoteCeilingScopes = resources.ceilingScopes
  let quoteTrimScopes = resources.trimScopes
  let pricingSummary: EstimateCustomerSendCalculatedData['pricingSummary'] = null

  try {
    if (resources.catalogs) {
      const wallScopes = resources.wallScopes as Parameters<typeof calculateWalls>[0]['scopes']
      const wallSegments =
        resources.wallSegments as Parameters<typeof calculateWalls>[0]['segments']
      const ceilingScopes =
        resources.ceilingScopes as Parameters<typeof calculateCeilings>[0]['scopes']
      const ceilingSegments =
        resources.ceilingScopeSegments as Parameters<typeof calculateCeilings>[0]['segments']
      const trimScopes = resources.trimScopes as Parameters<typeof calculateTrim>[0]['scopes']
      const rooms = resources.rooms as Parameters<typeof calculateTrim>[0]['rooms']
      const roomModeById = resolveRoomModeById({
        rooms: rooms as Unsafe[],
        wallScopes: wallScopes as Unsafe[],
        ceilingScopes: ceilingScopes as Unsafe[],
      })

      const wallCalculations = calculateWalls({
        scopes: wallScopes,
        segments: wallSegments,
        settings: {
          labor_rate_per_hour: effectiveLaborRate,
        },
        catalogs: resources.catalogs as Parameters<typeof calculateWalls>[0]['catalogs'],
      })
      quoteWallScopes = (wallCalculations.scopes ?? []) as Unsafe[]

      const ceilingCalculations = calculateCeilings({
        scopes: ceilingScopes,
        segments: ceilingSegments,
        settings: {
          labor_rate_per_hour: effectiveLaborRate,
        },
        catalogs: resources.catalogs as Parameters<typeof calculateCeilings>[0]['catalogs'],
      })
      quoteCeilingScopes = (ceilingCalculations.scopes ?? []) as Unsafe[]

      const trimCalculations = calculateTrim({
        scopes: trimScopes,
        rooms: rooms.map((row) => {
          const roomId = asText(row.room_id).toUpperCase()
          return {
            room_id: roomId,
            length_in: row.length_in == null ? null : Number(row.length_in),
            width_in: row.width_in == null ? null : Number(row.width_in),
            mode: roomModeById.get(roomId) ?? 'RECT',
          }
        }),
        settings: {
          labor_rate_per_hour: effectiveLaborRate,
        },
        catalogs:
          resources.catalogs as unknown as Parameters<typeof calculateTrim>[0]['catalogs'],
      })
      quoteTrimScopes = (trimCalculations.scopes ?? []) as Unsafe[]

      const trimPaint = buildTrimPaintInput({
        jobsettings: resources.jobsettings as Unsafe,
        defaults: resources.settingsRow as Unsafe,
        catalogs: productMap(
          resources.catalogs as unknown as Parameters<typeof productMap>[0]
        ),
      })

      const builtPricingSummary = buildEstimatePricingSummaryFromEngines(
        [
          { kind: 'walls', output: wallCalculations },
          { kind: 'ceilings', output: ceilingCalculations },
          { kind: 'trim', output: trimCalculations },
        ],
        {
          enabled: effectiveLaborDayEnabled !== false,
          dayhours: effectiveDayhours,
          roundingIncrementHours: effectiveRoundingIncrement,
        },
        {
          enabled: effectiveJobMinimumEnabled === true,
          amount: effectiveJobMinimumAmount,
        },
        trimPaint
      )

      pricingSummary = { finalTotal: builtPricingSummary.finalTotal ?? null }
    }
  } catch {
    pricingSummary = null
  }

  return {
    quoteWallScopes,
    quoteCeilingScopes,
    quoteTrimScopes,
    pricingSummary,
  }
}
