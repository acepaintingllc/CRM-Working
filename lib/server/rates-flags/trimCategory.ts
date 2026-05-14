import type { ProductionRateRow, UnitRateRow } from '../../../types/estimator/ratesFlags'
import type { CategoryConfig } from './categoryTypes.ts'
import { asDisplayName, asText, normalizeId, normalizeProductionScope, rowByHeader, toYNString } from './shared.ts'

export const TRIM_CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'production_rates_trim',
    tab: 'rates',
    group: 'production_rates',
    label: 'Production Rates - Trim',
    tableTitles: ['CAT_ProductionRates', 'Production Rates'],
    description: 'Units/hr production assumptions for trim work.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'surface_type', label: 'Trim Family' },
      { key: 'condition', label: 'Condition' },
      { key: 'prep_sqft_per_hr', label: 'Prep units/hr', align: 'right' },
      { key: 'sqft_per_hr', label: 'Paint units/hr', align: 'right' },
      { key: 'primer_sqft_per_hr', label: 'Primer units/hr', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'production_scope', label: 'Production Scope', type: 'select', readOnly: true, options: ['trim'], headers: ['ProductionScope'], writeDefault: 'trim' },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['RateID', 'ID'] },
      { key: 'scope_id', label: 'Scope', type: 'text', required: true, headers: ['ScopeID', 'Scope'], writeDefault: 'TRIM' },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'surface_type', label: 'Trim Family', type: 'text', headers: ['SurfaceType', 'Family', 'Surface'] },
      { key: 'condition', label: 'Condition', type: 'text', headers: ['Condition'] },
      { key: 'prep_sqft_per_hr', label: 'Prep units/hr', type: 'number', headers: ['PrepSqFtPerHr', 'PrepSqFt/hr', 'PrepUnitsPerHr', 'Prep Rate'] },
      { key: 'sqft_per_hr', label: 'Paint units/hr', type: 'number', required: true, headers: ['SqFtPerHr', 'SqFt/hr', 'UnitsPerHr', 'Rate'] },
      { key: 'primer_sqft_per_hr', label: 'Primer units/hr', type: 'number', headers: ['PrimerSqFtPerHr', 'PrimerSqFt/hr', 'PrimerUnitsPerHr', 'Primer Rate'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      const scope = normalizeProductionScope(rowByHeader(row, ['ScopeID', 'Scope', 'DisplayName', 'Name', 'Label']))
      return scope === 'trim'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        production_scope: 'trim',
        display_name: asDisplayName(values),
        scope_id: asText(values.scope_id) || 'TRIM',
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
    key: 'unit_rates_trim',
    tab: 'rates',
    group: 'unit_rates',
    label: 'Trim Types',
    tableTitles: ['CAT_TrimItems'],
    description: 'Trim type definitions used by the estimator trim scope. Labor production lives under Production > Trim.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'unit_rate_type', label: 'Type' },
      { key: 'unit', label: 'Unit' },
      { key: 'helper_allowed', label: 'Helper', align: 'center' },
      { key: 'default_production_rate_id', label: 'Default Prod Rate' },
      { key: 'active', label: 'Status', align: 'center' },
      { key: 'trim_category', label: 'Trim Category' },
      { key: 'measurement_class', label: 'Measurement Class' },
      { key: 'picker_group', label: 'Picker Group' },
    ],
    fields: [
      { key: 'unit_rate_group', label: 'Unit Group', type: 'select', readOnly: true, options: ['trim'], headers: ['UnitRateGroup'], writeDefault: 'trim' },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['TrimItemID', 'TrimMenuID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'unit_rate_type', label: 'Type', type: 'text', headers: ['Type', 'Category', 'Variant'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'helper_allowed', label: 'Helper Allowed', type: 'select', options: ['Y', 'N'], headers: ['HelperAllowed', 'RoomHelperAllowed', 'Helper'], writeDefault: 'N' },
      { key: 'default_production_rate_id', label: 'Default Production Rate ID', type: 'text', headers: ['DefaultProductionRateID', 'ProductionRateID', 'RateID'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
      { key: 'trim_category', label: 'Trim Category', type: 'select', options: ['base', 'crown', 'casing', 'rail', 'door_window', 'panel', 'feature', 'other'], headers: ['TrimCategory', 'Trim_Category'] },
      { key: 'measurement_class', label: 'Measurement Class', type: 'select', options: ['linear', 'opening', 'surface', 'assembly'], headers: ['MeasurementClass', 'Measurement_Class'] },
      { key: 'picker_group', label: 'Picker Group', type: 'text', headers: ['PickerGroup', 'Picker_Group'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        unit_rate_group: 'trim',
        display_name: asDisplayName(values),
        unit_rate_type: asText(values.unit_rate_type),
        unit: asText(values.unit),
        helper_allowed: toYNString(asText(values.helper_allowed)),
        default_production_rate_id: asText(values.default_production_rate_id),
        default_qty: asText(values.default_qty),
        labor_rate: asText(values.labor_rate),
        material_rate: asText(values.material_rate),
        amount: asText(values.amount),
        notes: asText(values.notes),
        active,
        trim_category: asText(values.trim_category),
        measurement_class: asText(values.measurement_class),
        picker_group: asText(values.picker_group),
      } satisfies UnitRateRow
    },
  },
]
