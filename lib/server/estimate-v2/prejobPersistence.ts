import {
  asNullableNumber,
  asText,
  toYN,
  type UnsafeRecord as Unsafe,
} from '../../estimator/parsing.ts'
import type { EstimatePrejobPersistenceRow } from './persistenceTypes.ts'

export function buildEstimatePrejobPersistenceRows(params: {
  orgId: string
  estimateId: string
  jobId: string
  rows: Unsafe[]
}): EstimatePrejobPersistenceRow[] {
  return params.rows
    .map((row, idx): EstimatePrejobPersistenceRow => {
      const hasTemplateTask = !!asText(row.task_template_id)
      const quantity = asNullableNumber(row.qty ?? row.man_qty)

      return {
        id: asText(row.id) || undefined,
        org_id: params.orgId,
        estimate_id: params.estimateId,
        job_id: params.jobId,
        position: idx,
        category: asText(row.category || row.rollup_scope) || null,
        trip_name: asText(row.trip_name || row.manual_task_name || row.man_trip_name) || null,
        trip_num: asNullableNumber(row.trip_num),
        rollup_scope: asText(row.rollup_scope || row.category) || null,
        man_trip_name: hasTemplateTask
          ? null
          : asText(row.manual_task_name || row.man_trip_name || row.trip_name) || null,
        man_qty: hasTemplateTask ? null : quantity,
        man_hours_each: asNullableNumber(row.man_hours_each ?? row.hours_each),
        task:
          asText(
            row.task_name ||
              row.task_label ||
              row.manual_task_name ||
              row.man_trip_name ||
              row.trip_name ||
              row.task
          ) || null,
        qty: hasTemplateTask ? quantity : null,
        hours_each: asNullableNumber(row.hours_each),
        laborrate: asNullableNumber(row.laborrate ?? row.man_hours_each),
        markup: asNullableNumber(row.markup),
        extra_supplies: asNullableNumber(row.extra_supplies),
        notes: asText(row.notes) || null,
        active: toYN(row.active, 'Y'),
      }
    })
    .filter((row) => !!(row.task || row.man_trip_name || row.trip_name))
}
