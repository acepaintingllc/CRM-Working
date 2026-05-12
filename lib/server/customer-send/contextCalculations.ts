import { loadCalculatedEstimateV2Artifacts } from '@/lib/server/estimate-v2/calculationOrchestration'
import {
  enrichEstimateV2AccessFeeRows,
  enrichEstimateV2OtherRows,
  enrichEstimateV2PrejobRows,
} from '@/lib/server/estimate-v2/calculatedRowEnrichment'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  normalizeDoorScopeRow as normalizeCustomerSendCalculatedDoorScopeRow,
  normalizeDrywallScopeRow as normalizeCustomerSendCalculatedDrywallScopeRow,
  normalizePaintScopeRow as normalizeCustomerSendCalculatedPaintScopeRow,
  normalizePrejobRow as normalizeCustomerSendCalculatedPrejobRow,
  normalizeTrimScopeRow as normalizeCustomerSendCalculatedTrimScopeRow,
} from './contextMapper'
import type {
  CustomerQuoteAccessFeeRow,
  CustomerQuoteDoorScopeRow,
  CustomerQuoteDrywallScopeRow,
  EstimateJobSettingsRow,
  CustomerQuoteOtherRow,
  CustomerQuotePrejobRow,
  EstimateCustomerSendCalculatedData,
  EstimateCustomerSendRawResources,
} from './contextTypes'

type CustomerSendPricingSummary = NonNullable<EstimateCustomerSendCalculatedData['pricingSummary']>

export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function buildCustomerSendPricingSummary(
  pricingSummary: CustomerSendPricingSummary
): CustomerSendPricingSummary {
  return {
    finalTotal: pricingSummary.finalTotal ?? null,
    ...(pricingSummary.prepTripCost != null ? { prepTripCost: pricingSummary.prepTripCost } : {}),
    ...(pricingSummary.prePolicyTotal != null ? { prePolicyTotal: pricingSummary.prePolicyTotal } : {}),
    ...(pricingSummary.postLaborPolicyTotal != null
      ? { postLaborPolicyTotal: pricingSummary.postLaborPolicyTotal }
      : {}),
    ...(pricingSummary.minimumAdjustmentAmount != null
      ? { minimumAdjustmentAmount: pricingSummary.minimumAdjustmentAmount }
      : {}),
  }
}

function asCalculationInputRecord(value: EstimateJobSettingsRow): Record<string, unknown> {
  return { ...value }
}

export async function deriveEstimateCustomerSendCalculatedData(
  resources: EstimateCustomerSendRawResources,
  params: {
    requestOrigin: string
    orgId: string
    userId: string
    estimateId: string
  }
): Promise<ServiceResult<EstimateCustomerSendCalculatedData>> {
  try {
    const calculated = await loadCalculatedEstimateV2Artifacts({
      requestOrigin: params.requestOrigin,
      orgId: params.orgId,
      userId: params.userId,
      estimateId: params.estimateId,
      jobsettings: asCalculationInputRecord(resources.jobsettings),
      rooms: resources.rooms,
      roomWallScopes: resources.wallScopes,
      wallSegments: resources.wallSegments,
      roomCeilingScopes: resources.ceilingScopes,
      ceilingScopeSegments: resources.ceilingScopeSegments,
      roomTrimScopes: resources.trimScopes,
      roomDoorScopes: resources.doorScopes,
      drywallRepairs: resources.drywallRepairs ?? [],
      accessFees: resources.accessFees,
      prejob: resources.prejob ?? [],
      other: resources.other,
      orgDefaults: resources.settingsRow,
    })

    return okResult({
      quoteWallScopes: calculated.quoteWallScopes.map((row) =>
        normalizeCustomerSendCalculatedPaintScopeRow(row)
      ),
      quoteCeilingScopes: calculated.quoteCeilingScopes.map((row) =>
        normalizeCustomerSendCalculatedPaintScopeRow(row)
      ),
      quoteTrimScopes: calculated.quoteTrimScopes.map((row) =>
        normalizeCustomerSendCalculatedTrimScopeRow(row)
      ),
      quoteDoorScopes: calculated.quoteDoorScopes.map((row) =>
        normalizeCustomerSendCalculatedDoorScopeRow(row as unknown as CustomerQuoteDoorScopeRow)
      ),
      quoteDrywallScopes: (calculated.drywallCalculations.scopes ?? []).map((row) =>
        normalizeCustomerSendCalculatedDrywallScopeRow(row as unknown as CustomerQuoteDrywallScopeRow)
      ),
      quoteAccessFees: enrichEstimateV2AccessFeeRows({
        rawRows: resources.accessFees,
        calculatedRows: calculated.accessFeeCalculation.rows as Array<Record<string, unknown>>,
      }) as CustomerQuoteAccessFeeRow[],
      quotePrejobRows: enrichEstimateV2PrejobRows({
        rawRows: resources.prejob ?? [],
        calculatedRows: calculated.prejobCalculations?.scopes ?? [],
      }).map((row) =>
        normalizeCustomerSendCalculatedPrejobRow(row as unknown as CustomerQuotePrejobRow)
      ),
      quoteOtherRows: enrichEstimateV2OtherRows({
        rawRows: resources.other,
        calculatedRows: calculated.otherCalculations.scopes as Array<Record<string, unknown>>,
      }) as CustomerQuoteOtherRow[],
      pricingSummary: buildCustomerSendPricingSummary(calculated.pricingSummary),
    })
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error && asText(error.message)
        ? `Unable to load canonical estimate calculations for customer send: ${asText(error.message)}`
        : 'Unable to load canonical estimate calculations for customer send.'
    )
  }
}
