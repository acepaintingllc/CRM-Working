import type { AccessFeeRow, ConditionModifierRow, MultiplierRow, SupplyRateRow } from '../../../types/estimator/ratesFlags'
import type { CategoryConfig } from './categoryTypes.ts'
import {
  asDisplayName,
  asText,
  classifyAccessGroup,
  classifySupplyGroup,
  normalizeId,
} from './shared.ts'

export const OTHER_CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'access_fees_ladders',
    tab: 'rates',
    group: 'access_fees',
    label: 'Access Fees - Ladders',
    tableTitles: ['CAT_AccessFees', 'Access Fees'],
    description: 'Flat access/setup fees classified as ladders.',
    columns: [
      { key: 'id', label: 'Fee ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'fee_type', label: 'Fee Type' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'unit', label: 'Unit' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'access_group', label: 'Access Group', type: 'select', readOnly: true, options: ['ladders'], headers: ['AccessGroup', 'Group'], writeDefault: 'ladders' },
      { key: 'id', label: 'Fee ID', type: 'text', required: true, headers: ['AccessFeeID', 'FeeID', 'ID'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'FeeName', 'Name', 'Label'] },
      { key: 'fee_type', label: 'Fee Type', type: 'select', options: ['Labor', 'PassThrough', 'Specialty', 'Other'], headers: ['FeeType', 'Type'] },
      { key: 'amount', label: 'Amount', type: 'number', required: true, headers: ['Amount', 'Fee', 'Value', 'Cost'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifyAccessGroup(row) === 'ladders'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        access_group: 'ladders',
        display_name: asDisplayName(values),
        fee_type: asText(values.fee_type),
        amount: asText(values.amount),
        unit: asText(values.unit),
        notes: asText(values.notes),
        active,
      } satisfies AccessFeeRow
    },
  },
  {
    key: 'access_fees_scaffolding',
    tab: 'rates',
    group: 'access_fees',
    label: 'Access Fees - Scaffolding',
    tableTitles: ['CAT_AccessFees', 'Access Fees'],
    description: 'Flat access/setup fees classified as scaffolding.',
    columns: [
      { key: 'id', label: 'Fee ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'fee_type', label: 'Fee Type' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'unit', label: 'Unit' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'access_group', label: 'Access Group', type: 'select', readOnly: true, options: ['scaffolding'], headers: ['AccessGroup', 'Group'], writeDefault: 'scaffolding' },
      { key: 'id', label: 'Fee ID', type: 'text', required: true, headers: ['AccessFeeID', 'FeeID', 'ID'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'FeeName', 'Name', 'Label'] },
      { key: 'fee_type', label: 'Fee Type', type: 'select', options: ['Labor', 'PassThrough', 'Specialty', 'Other'], headers: ['FeeType', 'Type'] },
      { key: 'amount', label: 'Amount', type: 'number', required: true, headers: ['Amount', 'Fee', 'Value', 'Cost'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifyAccessGroup(row) === 'scaffolding'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        access_group: 'scaffolding',
        display_name: asDisplayName(values),
        fee_type: asText(values.fee_type),
        amount: asText(values.amount),
        unit: asText(values.unit),
        notes: asText(values.notes),
        active,
      } satisfies AccessFeeRow
    },
  },
  {
    key: 'access_fees_specialty',
    tab: 'rates',
    group: 'access_fees',
    label: 'Access Fees - Specialty',
    tableTitles: ['CAT_AccessFees', 'Access Fees'],
    description: 'Flat access/setup fees classified as specialty.',
    columns: [
      { key: 'id', label: 'Fee ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'fee_type', label: 'Fee Type' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'unit', label: 'Unit' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'access_group', label: 'Access Group', type: 'select', readOnly: true, options: ['specialty'], headers: ['AccessGroup', 'Group'], writeDefault: 'specialty' },
      { key: 'id', label: 'Fee ID', type: 'text', required: true, headers: ['AccessFeeID', 'FeeID', 'ID'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'FeeName', 'Name', 'Label'] },
      { key: 'fee_type', label: 'Fee Type', type: 'select', options: ['Labor', 'PassThrough', 'Specialty', 'Other'], headers: ['FeeType', 'Type'] },
      { key: 'amount', label: 'Amount', type: 'number', required: true, headers: ['Amount', 'Fee', 'Value', 'Cost'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifyAccessGroup(row) === 'specialty'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        access_group: 'specialty',
        display_name: asDisplayName(values),
        fee_type: asText(values.fee_type),
        amount: asText(values.amount),
        unit: asText(values.unit),
        notes: asText(values.notes),
        active,
      } satisfies AccessFeeRow
    },
  },
  {
    key: 'supply_rates_per_color',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Supply Rates - Per-Color',
    tableTitles: ['CAT_Supplies', 'SUPPLIES RATES', 'Supplies Rates'],
    description: 'Consumables charged by color grouping.',
    columns: [
      { key: 'id', label: 'Supply ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'unit', label: 'Unit' },
      { key: 'cost_per', label: 'Cost', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['per_color'], headers: ['SupplyGroup'], writeDefault: 'per_color' },
      { key: 'id', label: 'Supply ID', type: 'text', required: true, headers: ['SupplyID', 'ID', 'Key'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'scope', label: 'Scope', type: 'text', headers: ['Scope'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'], writeDefault: 'per color' },
      { key: 'cost_per', label: 'Cost', type: 'number', required: true, headers: ['CostPer', 'Value', 'Rate', 'Amount'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifySupplyGroup(row) === 'per_color'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        supply_group: 'per_color',
        display_name: asDisplayName(values),
        scope: asText(values.scope),
        unit: asText(values.unit),
        cost_per: asText(values.cost_per),
        size_in: '',
        price_each: '',
        notes: asText(values.notes),
        active,
      } satisfies SupplyRateRow
    },
  },
  {
    key: 'supply_rates_area_based',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Supply Rates - Area-Based',
    tableTitles: ['CAT_Supplies', 'SUPPLIES RATES', 'Supplies Rates'],
    description: 'Consumables charged by area ($/sqft).',
    columns: [
      { key: 'id', label: 'Supply ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'unit', label: 'Unit' },
      { key: 'cost_per', label: 'Cost', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['area_based'], headers: ['SupplyGroup'], writeDefault: 'area_based' },
      { key: 'id', label: 'Supply ID', type: 'text', required: true, headers: ['SupplyID', 'ID', 'Key'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'scope', label: 'Scope', type: 'text', headers: ['Scope'] },
      { key: 'unit', label: 'Unit', type: 'text', readOnly: true, headers: ['Unit', 'UOM'], writeDefault: '$/sqft' },
      { key: 'cost_per', label: 'Cost', type: 'number', required: true, headers: ['CostPer', 'Value', 'Rate', 'Amount'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifySupplyGroup(row) === 'area_based'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        supply_group: 'area_based',
        display_name: asDisplayName(values),
        scope: asText(values.scope),
        unit: asText(values.unit) || '$/sqft',
        cost_per: asText(values.cost_per),
        size_in: '',
        price_each: '',
        notes: asText(values.notes),
        active,
      } satisfies SupplyRateRow
    },
  },
  {
    key: 'supply_rates_per_job',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Supply Rates - Per-Job',
    tableTitles: ['CAT_Supplies', 'SUPPLIES RATES', 'Supplies Rates'],
    description: 'Consumables charged per job/task/trip.',
    columns: [
      { key: 'id', label: 'Supply ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'unit', label: 'Unit' },
      { key: 'cost_per', label: 'Cost', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['per_job'], headers: ['SupplyGroup'], writeDefault: 'per_job' },
      { key: 'id', label: 'Supply ID', type: 'text', required: true, headers: ['SupplyID', 'ID', 'Key'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'scope', label: 'Scope', type: 'text', headers: ['Scope'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'cost_per', label: 'Cost', type: 'number', required: true, headers: ['CostPer', 'Value', 'Rate', 'Amount'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    rowFilter(row) {
      return classifySupplyGroup(row) === 'per_job'
    },
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        supply_group: 'per_job',
        display_name: asDisplayName(values),
        scope: asText(values.scope),
        unit: asText(values.unit),
        cost_per: asText(values.cost_per),
        size_in: '',
        price_each: '',
        notes: asText(values.notes),
        active,
      } satisfies SupplyRateRow
    },
  },
  {
    key: 'supply_rates_roller_covers',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Supply Rates - Roller Covers',
    tableTitles: ['CAT_RollerCovers'],
    description: 'Roller cover consumables and unit prices.',
    columns: [
      { key: 'id', label: 'Supply ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'size_in', label: 'Size (in)', align: 'right' },
      { key: 'price_each', label: 'Price Each', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'supply_group', label: 'Supply Group', type: 'select', readOnly: true, options: ['roller_covers'], headers: ['SupplyGroup'], writeDefault: 'roller_covers' },
      { key: 'id', label: 'Supply ID', type: 'text', required: true, headers: ['RollerCoverID', 'ID'] },
      { key: 'display_name', label: 'Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'scope', label: 'Scope', type: 'select', options: ['Wall', 'Ceiling', 'Other'], headers: ['Scope'] },
      { key: 'size_in', label: 'Size (in)', type: 'number', headers: ['Size_in', 'Size'] },
      { key: 'price_each', label: 'Price Each', type: 'number', headers: ['Price_each', 'Price', 'Amount'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        supply_group: 'roller_covers',
        display_name: asDisplayName(values),
        scope: asText(values.scope),
        unit: 'each',
        cost_per: '',
        size_in: asText(values.size_in),
        price_each: asText(values.price_each),
        notes: asText(values.notes),
        active,
      } satisfies SupplyRateRow
    },
  },
  {
    key: 'condition_modifiers',
    tab: 'flags',
    group: 'condition_modifiers',
    label: 'Condition Modifiers',
    tableTitles: ['CAT_RoomFlags', 'Room Flags'],
    description: 'Per-room wall, ceiling, and trim condition modifiers.',
    columns: [
      { key: 'id', label: 'Flag ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'wall_factor', label: 'Wall Factor', align: 'right' },
      { key: 'ceil_factor', label: 'Ceiling Factor', align: 'right' },
      { key: 'trim_factor', label: 'Trim Factor', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Flag ID', type: 'text', required: true, headers: ['FlagID', 'RoomFlagID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'FlagName', 'Name', 'Label'] },
      { key: 'wall_factor', label: 'Wall Factor', type: 'number', headers: ['WallFactor', 'Wall Multiplier'] },
      { key: 'ceil_factor', label: 'Ceiling Factor', type: 'number', headers: ['CeilFactor', 'CeilingFactor', 'Ceiling Multiplier'] },
      { key: 'trim_factor', label: 'Trim Factor', type: 'number', headers: ['TrimFactor', 'Trim Multiplier'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        wall_factor: asText(values.wall_factor),
        ceil_factor: asText(values.ceil_factor),
        trim_factor: asText(values.trim_factor),
        notes: asText(values.notes),
        active,
      } satisfies ConditionModifierRow
    },
  },
  {
    key: 'height_factors',
    tab: 'flags',
    group: 'height_factors',
    label: 'Height Factors',
    tableTitles: ['CAT_HeightFactors', 'Height Factors'],
    description: 'Height-band multipliers.',
    columns: [
      { key: 'id', label: 'Factor ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'primary_value', label: 'Multiplier', align: 'right' },
      { key: 'secondary_value', label: 'Range (ft)' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'id', label: 'Height Band ID', type: 'text', required: true, headers: ['HeightBandID', 'HeightFactorID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'min_height_ft', label: 'Min Height (ft)', type: 'number', headers: ['MinHeight_ft', 'MinHeight', 'Min Height'] },
      { key: 'max_height_ft', label: 'Max Height (ft)', type: 'number', headers: ['MaxHeight_ft', 'MaxHeight', 'Max Height'] },
      { key: 'primary_value', label: 'Labor Multiplier', type: 'number', required: true, headers: ['LaborMultiplier', 'Labor Multiplier', 'LaborMult'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      const min = asText(values.min_height_ft)
      const max = asText(values.max_height_ft)
      const rangeLabel = [min, max].filter(Boolean).join(' - ')
      return {
        id: normalizeId(values.id),
        display_name: asDisplayName(values),
        multiplier_type: 'height_factors',
        primary_label: 'Labor Multiplier',
        primary_value: asText(values.primary_value),
        secondary_label: 'Range (ft)',
        secondary_value: rangeLabel,
        notes: asText(values.notes),
        active,
      } satisfies MultiplierRow
    },
  },
]
