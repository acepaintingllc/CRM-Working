import {
  asNullableNumber,
  asText,
  pickValue,
  toYN,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import type { EstimateOtherPersistenceRow } from './persistenceTypes.ts'
import { toOtherRollupScope } from './shared.ts'

export function buildEstimateOtherPersistenceRows(params: {
  orgId: string
  estimateId: string
  jobId: string
  rows: Unsafe[]
}): EstimateOtherPersistenceRow[] {
  return params.rows.map((row, idx) => {
    const rollupTarget = asText(pickValue(row, ['rollup_target', 'rollupTarget'])).toLowerCase() || 'other'
    const rollupScope =
      toOtherRollupScope(pickValue(row, ['rollup_scope', 'rollupScope', 'RollupScope'])) ??
      (rollupTarget === 'ceilings'
        ? 'Ceilings'
        : rollupTarget === 'trim' || rollupTarget === 'doors'
          ? 'Trim'
          : 'Walls')
    const clientDescription =
      asText(pickValue(row, ['client_description', 'clientDescription', 'ClientDescription'])) ||
      asText(pickValue(row, ['customer_label', 'customerLabel'])) ||
      asText(pickValue(row, ['description']))
    if (!clientDescription) throw new Error(`Other row ${idx + 1}: description or customer label is required`)

    const qtyRaw = pickValue(row, ['qty', 'Qty'])
    const qty = qtyRaw == null || qtyRaw === '' ? 1 : asNullableNumber(qtyRaw)
    if (qty == null || qty <= 0) throw new Error(`Other row ${idx + 1}: Qty must be numeric and greater than 0`)

    const laborHrsEach =
      asNullableNumber(
        pickValue(row, ['labor_hrs_each', 'laborHrsEach', 'LaborHrs_Each', 'labor_hours', 'laborHours'])
      ) ?? 0
    if (laborHrsEach == null || laborHrsEach < 0) throw new Error(`Other row ${idx + 1}: LaborHrs_Each must be numeric and >= 0`)

    const materialsEach =
      asNullableNumber(
        pickValue(row, [
          'materials_each',
          'materialsEach',
          'Materials$_Each',
          'material_cost',
          'materialCost',
          'unit_rate',
          'unitRate',
          'fixed_amount',
          'fixedAmount',
        ])
      ) ?? 0
    if (materialsEach == null || materialsEach < 0) throw new Error(`Other row ${idx + 1}: Materials$_Each must be numeric and >= 0`)

    return {
      id: asText(row.id) || undefined,
      org_id: params.orgId,
      estimate_id: params.estimateId,
      job_id: params.jobId,
      position: idx,
      rollup_scope: rollupScope,
      location: asText(pickValue(row, ['location', 'Location', 'room_id', 'roomId'])) || null,
      client_description: clientDescription,
      qty,
      uom: asText(pickValue(row, ['uom', 'UOM'])) || null,
      labor_hrs_each: laborHrsEach,
      materials_each: materialsEach,
      notes: asText(pickValue(row, ['notes', 'Notes', 'internal_notes', 'internalNotes'])) || null,
      active: toYN(pickValue(row, ['active', 'Active?', 'Active']), 'Y'),
      room_id: asText(pickValue(row, ['room_id', 'roomId'])).toUpperCase() || null,
      description: asText(pickValue(row, ['description'])) || null,
      customer_label: asText(pickValue(row, ['customer_label', 'customerLabel'])) || null,
      pricing_mode: asText(pickValue(row, ['pricing_mode', 'pricingMode'])) || null,
      quantity: asNullableNumber(pickValue(row, ['quantity'])),
      unit_rate: asNullableNumber(pickValue(row, ['unit_rate', 'unitRate'])),
      labor_hours: asNullableNumber(pickValue(row, ['labor_hours', 'laborHours'])),
      labor_rate: asNullableNumber(pickValue(row, ['labor_rate', 'laborRate'])),
      material_cost: asNullableNumber(pickValue(row, ['material_cost', 'materialCost'])),
      supply_cost: asNullableNumber(pickValue(row, ['supply_cost', 'supplyCost'])),
      fixed_amount: asNullableNumber(pickValue(row, ['fixed_amount', 'fixedAmount'])),
      rollup_target: rollupTarget,
      customer_visibility:
        asText(pickValue(row, ['customer_visibility', 'customerVisibility'])) || 'standalone',
      internal_notes: asText(pickValue(row, ['internal_notes', 'internalNotes'])) || null,
    }
  })
}
