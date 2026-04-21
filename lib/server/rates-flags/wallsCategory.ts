import type { MultiplierRow, ProductionRateRow, RoomTypeDefaultRow } from '../../../types/estimator/ratesFlags'
import type { CategoryConfig } from './categoryTypes.ts'
import { asDisplayName, asText, normalizeId, normalizeProductionScope, rowByHeader } from './shared.ts'

export const WALLS_CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'production_rates_walls',
    tab: 'rates',
    group: 'production_rates',
    label: 'Production Rates - Walls',
    tableTitles: ['CAT_ProductionRates', 'Production Rates'],
    description: 'Sqft/hr production assumptions for wall work.',
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
      { key: 'production_scope', label: 'Production Scope', type: 'select', readOnly: true, options: ['walls'], headers: ['ProductionScope'], writeDefault: 'walls' },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['RateID', 'ID'] },
      { key: 'scope_id', label: 'Scope', type: 'text', required: true, headers: ['ScopeID', 'Scope'], writeDefault: 'WALLS' },
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
      return scope === '' || scope === 'walls'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        production_scope: 'walls',
        display_name: asDisplayName(values),
        scope_id: asText(values.scope_id) || 'WALLS',
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
    key: 'room_types',
    tab: 'room_defaults',
    group: 'room_types',
    label: 'Room Types',
    tableTitles: ['CAT_RoomTypes'],
    description: 'Preset room defaults used when creating room rows.',
    columns: [
      { key: 'id', label: 'Room Type ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'default_wall_rate_id', label: 'Default Wall Rate' },
      { key: 'default_ceil_rate_id', label: 'Default Ceiling Rate' },
      { key: 'default_complexity_id', label: 'Default Complexity' },
      { key: 'default_wall_mode', label: 'Wall Mode' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Room Type ID', type: 'text', required: true, headers: ['RoomTypeID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'default_wall_rate_id', label: 'Default Wall Rate ID', type: 'text', headers: ['DefaultWallRateID', 'WallRateID', 'Wall Rate ID'] },
      { key: 'default_ceil_rate_id', label: 'Default Ceiling Rate ID', type: 'text', headers: ['DefaultCeilRateID', 'CeilRateID', 'Ceiling Rate ID'] },
      { key: 'default_complexity_id', label: 'Default Complexity ID', type: 'text', headers: ['DefaultComplexityID', 'ComplexityTypeID', 'WallComplexityTypeID'] },
      { key: 'default_wall_mode', label: 'Default Wall Mode', type: 'select', options: ['RECT', 'SEG'], headers: ['DefaultWallMode', 'WallMode', 'Wall Mode'] },
      { key: 'top_cut_in_factor', label: 'Top Cut-In Factor', type: 'number', headers: ['TopCutInFactor', 'Top Cut In Factor'] },
      { key: 'bot_cut_in_factor', label: 'Bottom Cut-In Factor', type: 'number', headers: ['BotCutInFactor', 'Bottom Cut In Factor'] },
      { key: 'typical_height_ft', label: 'Typical Height (ft)', type: 'number', headers: ['TypicalHeight_ft', 'DefaultHeight_ft', 'Height_ft'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        default_wall_rate_id: asText(values.default_wall_rate_id),
        default_ceil_rate_id: asText(values.default_ceil_rate_id),
        default_complexity_id: asText(values.default_complexity_id),
        default_wall_mode: asText(values.default_wall_mode),
        top_cut_in_factor: asText(values.top_cut_in_factor),
        bot_cut_in_factor: asText(values.bot_cut_in_factor),
        typical_height_ft: asText(values.typical_height_ft),
        notes: asText(values.notes),
        active,
      } satisfies RoomTypeDefaultRow
    },
  },
  {
    key: 'wall_complexity',
    tab: 'flags',
    group: 'wall_complexity',
    label: 'Wall Complexity',
    tableTitles: ['CAT_WallComplexity', 'Wall Complexity'],
    description: 'Wall complexity multipliers and access adjustments.',
    columns: [
      { key: 'id', label: 'Complexity ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'primary_value', label: 'Multiplier', align: 'right' },
      { key: 'secondary_value', label: 'Access Fee', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Complexity ID', type: 'text', required: true, headers: ['ComplexityTypeID', 'WallComplexityTypeID', 'TemplateID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Label', 'Name'] },
      { key: 'primary_value', label: 'Labor Multiplier', type: 'number', required: true, headers: ['LaborMultiplier', 'Labor Multiplier', 'LaborMult'] },
      { key: 'secondary_value', label: 'Access Fee', type: 'number', headers: ['AccessFee$', 'AccessFee', 'Access Fee', 'Access Fee $'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        multiplier_type: 'wall_complexity',
        primary_label: 'Labor Multiplier',
        primary_value: asText(values.primary_value),
        secondary_label: 'Access Fee',
        secondary_value: asText(values.secondary_value),
        notes: asText(values.notes),
        active,
      } satisfies MultiplierRow
    },
  },
]
