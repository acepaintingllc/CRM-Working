import type { EstimateV2ProductionRateOption, EstimateV2SupplyRateOption } from './v2Catalogs'
import type { EstimateV2SavePayload } from './v2Summary'

function requiresNumber(value: number): number {
  return value
}

const nullableLaborRate: EstimateV2SavePayload['jobsettings']['override_labor_rate'] = null
// @ts-expect-error override_labor_rate must be narrowed before numeric use.
requiresNumber(nullableLaborRate)

const narrowedLaborRate =
  nullableLaborRate == null ? 0 : requiresNumber(nullableLaborRate)
void narrowedLaborRate

const nullableSupplyValue: EstimateV2SupplyRateOption['value'] = null
// @ts-expect-error supply catalog values can be missing and must be guarded.
requiresNumber(nullableSupplyValue)

const narrowedSupplyValue =
  nullableSupplyValue == null ? 0 : requiresNumber(nullableSupplyValue)
void narrowedSupplyValue

const nullableProductionRate: EstimateV2ProductionRateOption['sqft_per_hr'] = null
// @ts-expect-error production rate values can be missing and must be guarded.
requiresNumber(nullableProductionRate)

const narrowedProductionRate =
  nullableProductionRate == null ? 0 : requiresNumber(nullableProductionRate)
void narrowedProductionRate

const nullablePrepRate: EstimateV2ProductionRateOption['prep_sqft_per_hr'] = null
// @ts-expect-error prep production rate values can be missing and must be guarded.
requiresNumber(nullablePrepRate)

const narrowedPrepRate =
  nullablePrepRate == null ? 0 : requiresNumber(nullablePrepRate)
void narrowedPrepRate

const nullablePrimerRate: EstimateV2ProductionRateOption['primer_sqft_per_hr'] = null
// @ts-expect-error primer production rate values can be missing and must be guarded.
requiresNumber(nullablePrimerRate)

const narrowedPrimerRate =
  nullablePrimerRate == null ? 0 : requiresNumber(nullablePrimerRate)
void narrowedPrimerRate
