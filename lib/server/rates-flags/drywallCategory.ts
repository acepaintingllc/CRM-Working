import type { UnitRateRow } from '../../../types/estimator/ratesFlags'
import type { CategoryConfig } from './categoryTypes.ts'
import { asDisplayName, asText, normalizeId } from './shared.ts'

export const DRYWALL_CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'unit_rates_drywall',
    tab: 'rates',
    group: 'unit_rates',
    label: 'Unit Rates - Drywall',
    tableTitles: ['CAT_DrywallRepairs', 'Drywall Repairs'],
    description: 'Per-unit assumptions for drywall repair scope.',
    columns: [
      { key: 'id', label: 'Rate ID' },
      { key: 'display_name', label: 'Name' },
      { key: 'unit_rate_type', label: 'Type' },
      { key: 'unit', label: 'Unit' },
      { key: 'labor_rate', label: 'Labor', align: 'right' },
      { key: 'material_rate', label: 'Material', align: 'right' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'active', label: 'Status', align: 'center' },
    ],
    fields: [
      { key: 'unit_rate_group', label: 'Unit Group', type: 'select', readOnly: true, options: ['drywall'], headers: ['UnitRateGroup'], writeDefault: 'drywall' },
      { key: 'id', label: 'Rate ID', type: 'text', required: true, headers: ['DrywallRepairID', 'RepairID', 'ID'] },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true, headers: ['DisplayName', 'Name', 'Label'] },
      { key: 'unit_rate_type', label: 'Type', type: 'text', headers: ['Type', 'Category', 'Severity'] },
      { key: 'unit', label: 'Unit', type: 'text', headers: ['Unit', 'UOM'] },
      { key: 'default_qty', label: 'Default Qty', type: 'number', headers: ['DefaultQty', 'QtyDefault', 'Qty'] },
      { key: 'labor_rate', label: 'Labor', type: 'number', headers: ['LaborRate', 'LaborHours', 'LaborHrs_Each', 'Hours_Each'] },
      { key: 'material_rate', label: 'Material', type: 'number', headers: ['MaterialRate', 'Materials$_Each', 'MaterialsEach'] },
      { key: 'amount', label: 'Amount', type: 'number', headers: ['Amount', 'Value', 'Rate', 'Cost'] },
      { key: 'notes', label: 'Notes', type: 'text', headers: ['Notes', 'Note'] },
    ],
    toRow(values, active) {
      return {
        id: normalizeId(values.id),
        unit_rate_group: 'drywall',
        display_name: asDisplayName(values),
        unit_rate_type: asText(values.unit_rate_type),
        unit: asText(values.unit),
        default_qty: asText(values.default_qty),
        labor_rate: asText(values.labor_rate),
        material_rate: asText(values.material_rate),
        amount: asText(values.amount),
        notes: asText(values.notes),
        active,
      } satisfies UnitRateRow
    },
  },
]
