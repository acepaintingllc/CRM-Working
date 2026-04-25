import {
  ratesFlagsEditableCategoryKeys,
  type RatesFlagsEditableCategoryKey,
} from '../../../types/estimator/ratesFlags.ts'
import {
  getRatesFlagsMutationFieldSpecsFromFields,
  isRatesFlagsYnOptions,
  validateRatesFlagsCategoryValues,
  type RatesFlagsMutationFieldSpec,
} from '../../quotes/ratesFlagsMutationFields.ts'
import { CATEGORY_CONFIGS_BY_KEY } from './categories.ts'

export {
  isRatesFlagsYnOptions,
  validateRatesFlagsCategoryValues,
  type RatesFlagsMutationFieldSpec,
}

export function getRatesFlagsMutationFieldSpecs<TKey extends RatesFlagsEditableCategoryKey>(
  categoryKey: TKey
) {
  const config = CATEGORY_CONFIGS_BY_KEY[categoryKey]
  return getRatesFlagsMutationFieldSpecsFromFields(config.fields)
}

export function getRatesFlagsMutationSchemaCategoryKeys() {
  return ratesFlagsEditableCategoryKeys
}
