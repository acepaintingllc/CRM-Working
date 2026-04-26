import type { MultiplierRow, ProductionRateRow } from '../../../types/estimator/ratesFlags'
import type { CategoryConfig } from './categoryTypes.ts'
import { asDisplayName, asText, normalizeId, normalizeProductionScope, rowByHeader } from './shared.ts'

export const CEILINGS_CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'production_rates_ceilings',
    tab: 'rates',
    group: 'production_rates',
    label: 'Production Rates - Ceilings',
    tableTitles: ['CAT_ProductionRates', 'Production Rates'],
    description: 'Sqft/hr production assumptions for ceiling work.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'scope_id', label: 'Scope' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'surface_type', label: 'Surface Type' },
      { key: 'condition', label: 'Condition' },
      { key: 'prep_sqft_per_hr', label: 'Prep sqft/hr', align: 'right' },
      { key: 'sqft_per_hr', label: 'Paint sqft/hr', align: 'right' },
      { key: 'primer_sqft_per_hr', label: 'Primer sqft/hr', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'production_scope', label: 'Production Scope', type: 'select', readOnly: true, options: ['ceilings'], headers: ['ProductionScope'], writeDefault: 'ceilings' },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['RateID', 'ID'] },
      { key: 'scope_id', label: 'Scope', type: 'text', required: true, headers: ['ScopeID', 'Scope'], writeDefault: 'CEILINGS' },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'surface_type', label: 'Surface Type', type: 'text', headers: ['SurfaceType', 'Surface'] },
      { key: 'condition', label: 'Condition', type: 'text', headers: ['Condition'] },
      { key: 'prep_sqft_per_hr', label: 'Prep sqft/hr', type: 'number', headers: ['PrepSqFtPerHr', 'PrepSqFt/hr', 'Prep Rate'] },
      { key: 'sqft_per_hr', label: 'Paint sqft/hr', type: 'number', required: true, headers: ['SqFtPerHr', 'SqFt/hr', 'Rate'] },
      { key: 'primer_sqft_per_hr', label: 'Primer sqft/hr', type: 'number', headers: ['PrimerSqFtPerHr', 'PrimerSqFt/hr', 'Primer Rate'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      const scope = normalizeProductionScope(rowByHeader(row, ['ScopeID', 'Scope', 'DisplayName', 'Name', 'Label']))
      return scope === 'ceilings'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        production_scope: 'ceilings',
        display_name: asDisplayName(values),
        scope_id: asText(values.scope_id) || 'CEILINGS',
        surface_type: asText(values.surface_type),
        condition: asText(values.condition),
        prep_sqft_per_hr: asText(values.prep_sqft_per_hr),
        sqft_per_hr: asText(values.sqft_per_hr),
        primer_sqft_per_hr: asText(values.primer_sqft_per_hr),
        notes: asText(values.notes),
        active,
      } satisfies ProductionRateRow
    },
  },
  {
    key: 'ceiling_types',
    tab: 'flags',
    group: 'ceiling_types',
    label: 'Ceiling Types',
    tableTitles: ['CAT_CeilingTypes', 'Ceiling Types'],
    description: 'Ceiling area factors, labor multipliers, and surcharge rates.',
    columns: [
      { key: 'id', label: 'Type ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'area_factor', label: 'Area Factor', align: 'right' },
      { key: 'primary_value', label: 'Multiplier', align: 'right' },
      { key: 'secondary_value', label: 'Surcharge', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Ceiling Type ID', type: 'text', required: true, headers: ['CeilingTypeID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'area_factor', label: 'Area Factor', type: 'number', headers: ['AreaFactor', 'Area Factor'] },
      { key: 'primary_value', label: 'Labor Multiplier', type: 'number', required: true, headers: ['LaborMult', 'LaborMultiplier', 'LaborFactor'] },
      { key: 'secondary_value', label: 'Surcharge / sqft', type: 'number', headers: ['Surcharge_per_sqft', 'Surcharge'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        multiplier_type: 'ceiling_types',
        primary_label: 'Labor Multiplier',
        primary_value: asText(values.primary_value),
        area_factor: asText(values.area_factor),
        secondary_label: 'Surcharge / sqft',
        secondary_value: asText(values.secondary_value),
        notes: asText(values.notes),
        active,
      } satisfies MultiplierRow
    },
  },
]
