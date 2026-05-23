import type {
  RatesFlagsCreateRequest,
  RatesFlagsMutationRequest,
  RatesFlagsMutationRequestByCategory,
  RatesFlagsUpdateRequest,
} from '@/types/estimator/ratesFlags'
import type { EstimateV2AccessFeeOption } from './v2Catalogs'
import type { EstimateV2AccessFeeDraft } from './v2Scopes'

const validCreateRequest: RatesFlagsCreateRequest<'access_fees_ladders'> = {
  category: 'access_fees_ladders',
  action: 'create',
  values: {
    access_group: 'ladders',
    id: 'LADDER',
    display_name: 'Ladder',
    fee_type: 'Labor',
    amount: '100',
    unit: 'once',
    notes: '',
    active: 'Y',
  },
}

const validUpdateRequest: RatesFlagsUpdateRequest<'production_rates_walls'> = {
  category: 'production_rates_walls',
  action: 'update',
  original_id: 'WALL_STD',
  values: {
    production_scope: 'walls',
    id: 'WALL_STD',
    scope_id: 'WALLS',
    display_name: 'Walls Standard',
    surface_type: 'Drywall',
    condition: 'Std',
    prep_sqft_per_hr: '90',
    sqft_per_hr: '120',
    primer_sqft_per_hr: '100',
    notes: '',
    active: 'Y',
  },
}

const validArchiveRequest: RatesFlagsMutationRequestByCategory<'production_rates_walls'> = {
  category: 'production_rates_walls',
  action: 'archive',
  rowId: 'WALL_STD',
}

void validCreateRequest
void validUpdateRequest
void validArchiveRequest

const accessFeeDraft: EstimateV2AccessFeeDraft = {
  id: 'fee-row-1',
  roomId: '',
  accessFeeId: 'LADDER_24',
  qty: '1',
  actualCostOverride: '',
  notes: '',
  position: 0,
}

const accessFeeOption: EstimateV2AccessFeeOption = {
  id: 'LADDER_24',
  label: '24 ft ladder',
  access_group: 'ladders',
  fee_type: 'Labor',
  amount: 75,
  unit: 'each',
  notes: null,
}

void accessFeeDraft
void accessFeeOption

const invalidAccessField: RatesFlagsMutationRequest = {
  category: 'access_fees_ladders',
  action: 'create',
  values: {
    access_group: 'ladders',
    id: 'LADDER',
    display_name: 'Ladder',
    fee_type: 'Labor',
    amount: '100',
    unit: 'once',
    notes: '',
    active: 'Y',
    // @ts-expect-error wrong field for access fees
    sqft_per_hr: '120',
  },
}

const invalidProductionField: RatesFlagsMutationRequest = {
  category: 'production_rates_walls',
  action: 'create',
  values: {
    production_scope: 'walls',
    id: 'WALL_STD',
    scope_id: 'WALLS',
    display_name: 'Walls',
    surface_type: '',
    condition: '',
    prep_sqft_per_hr: '',
    sqft_per_hr: '120',
    primer_sqft_per_hr: '',
    notes: '',
    active: 'Y',
    // @ts-expect-error wrong field for production rates
    fee_type: 'Labor',
  },
}

// @ts-expect-error update requests require original_id
const invalidUpdateWithoutOriginalId: RatesFlagsMutationRequestByCategory<'production_rates_walls'> = {
  category: 'production_rates_walls',
  action: 'update',
  values: {
    production_scope: 'walls',
    id: 'WALL_STD',
    scope_id: 'WALLS',
    display_name: 'Walls',
    surface_type: '',
    condition: '',
    prep_sqft_per_hr: '',
    sqft_per_hr: '120',
    primer_sqft_per_hr: '',
    notes: '',
    active: 'Y',
  },
}

const invalidCreateWithOriginalId: RatesFlagsCreateRequest<'access_fees_ladders'> = {
  category: 'access_fees_ladders',
  action: 'create',
  // @ts-expect-error create requests do not support original_id
  original_id: 'LADDER',
  values: {
    access_group: 'ladders',
    id: 'LADDER',
    display_name: 'Ladder',
    fee_type: 'Labor',
    amount: '100',
    unit: 'once',
    notes: '',
    active: 'Y',
  },
}

const invalidLiteralMismatch: RatesFlagsMutationRequestByCategory<'supply_rates_area_based'> = {
  category: 'supply_rates_area_based',
  action: 'create',
  values: {
    // @ts-expect-error wrong discriminator for category
    supply_group: 'per_job',
    id: 'MASK',
    display_name: 'Mask',
    scope: 'Walls',
    unit: '$/sqft',
    cost_per: '1.25',
    notes: '',
    active: 'Y',
  },
}

// @ts-expect-error archive requests require rowId
const invalidArchiveRequest: RatesFlagsMutationRequest = {
  category: 'production_rates_walls',
  action: 'archive',
}

const invalidLegacyCategory: RatesFlagsMutationRequest = {
  // @ts-expect-error legacy compatibility keys are not editable
  category: 'unit_rates',
  action: 'archive',
  rowId: 'LEGACY',
}

void invalidAccessField
void invalidProductionField
void invalidUpdateWithoutOriginalId
void invalidCreateWithOriginalId
void invalidLiteralMismatch
void invalidArchiveRequest
void invalidLegacyCategory
