import { loadCalculatedEstimateV2Artifacts } from '@/lib/server/estimate-v2/calculationOrchestration'
import type { EstimateTemplateSettingsRow } from '@/lib/server/estimateTemplateSettings'
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

function fallbackCalculatedData(
  resources: EstimateCustomerSendRawResources
): EstimateCustomerSendCalculatedData {
  return {
    quoteWallScopes: resources.wallScopes,
    quoteCeilingScopes: resources.ceilingScopes,
    quoteTrimScopes: resources.trimScopes,
    quoteDoorScopes: resources.doorScopes,
    quoteDrywallScopes: resources.drywallRepairs ?? [],
    quoteAccessFees: resources.accessFees,
    quoteOtherRows: resources.other,
    pricingSummary: null,
  }
}

function enrichAccessFeeRows(params: {
  rawRows: Unsafe[]
  calculatedRows: Array<Record<string, unknown>>
}) {
  const calculatedById = new Map(params.calculatedRows.map((row) => [asText(row.id), row]))
  return params.rawRows.map((row) => {
    const id = asText(row.id)
    const calculated = calculatedById.get(id)
    if (!calculated) return row
    return {
      ...row,
      label: calculated.label,
      access_group: calculated.group,
      catalog_amount: calculated.catalogAmount,
      calculated_total: calculated.calculatedTotal,
      effective_total: calculated.total,
      overridden: calculated.overridden,
    }
  })
}

function enrichOtherRows(params: {
  rawRows: Unsafe[]
  calculatedRows: Array<Record<string, unknown>>
}) {
  const calculatedById = new Map(params.calculatedRows.map((row) => [asText(row.id), row]))
  return params.rawRows.map((row) => {
    const id = asText(row.id)
    const calculated = calculatedById.get(id)
    return calculated ? { ...row, ...calculated } : row
  })
}

export async function deriveEstimateCustomerSendCalculatedData(
  resources: EstimateCustomerSendRawResources,
  params: {
    requestOrigin: string
    orgId: string
    userId: string
    estimateId: string
  }
): Promise<EstimateCustomerSendCalculatedData> {
  try {
    const calculated = await loadCalculatedEstimateV2Artifacts({
      requestOrigin: params.requestOrigin,
      orgId: params.orgId,
      userId: params.userId,
      estimateId: params.estimateId,
      jobsettings: resources.jobsettings as Unsafe,
      rooms: resources.rooms,
      roomWallScopes: resources.wallScopes,
      wallSegments: resources.wallSegments,
      roomCeilingScopes: resources.ceilingScopes,
      ceilingScopeSegments: resources.ceilingScopeSegments,
      roomTrimScopes: resources.trimScopes,
      roomDoorScopes: resources.doorScopes,
      drywallRepairs: resources.drywallRepairs ?? [],
      accessFees: resources.accessFees,
      other: resources.other,
      orgDefaults: resources.settingsRow as unknown as EstimateTemplateSettingsRow,
    })

    return {
      quoteWallScopes: calculated.quoteWallScopes as Unsafe[],
      quoteCeilingScopes: calculated.quoteCeilingScopes as Unsafe[],
      quoteTrimScopes: calculated.quoteTrimScopes as Unsafe[],
      quoteDoorScopes: calculated.quoteDoorScopes as Unsafe[],
      quoteDrywallScopes: (calculated.drywallCalculations.scopes ?? []) as Unsafe[],
      quoteAccessFees: enrichAccessFeeRows({
        rawRows: resources.accessFees,
        calculatedRows: calculated.accessFeeCalculation.rows as Array<Record<string, unknown>>,
      }),
      quoteOtherRows: enrichOtherRows({
        rawRows: resources.other,
        calculatedRows: calculated.otherCalculations.scopes as Array<Record<string, unknown>>,
      }),
      pricingSummary: { finalTotal: calculated.pricingSummary.finalTotal ?? null },
    }
  } catch {
    return fallbackCalculatedData(resources)
  }
}
