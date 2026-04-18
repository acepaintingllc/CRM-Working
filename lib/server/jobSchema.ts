import { assertSchema } from '@/lib/server/schema'

const optionalJobColumns = ['scheduled_email_sent_at', 'completed_email_sent_at'] as const

export type OptionalJobColumn = (typeof optionalJobColumns)[number]

export async function getAvailableOptionalJobColumns() {
  const checks = await Promise.all(
    optionalJobColumns.map(async (column) => {
      const result = await assertSchema([{ table: 'jobs', columns: [column] }])
      return result.ok ? column : null
    })
  )

  return checks.filter((value): value is OptionalJobColumn => value != null)
}

export function buildJobSelect(baseColumns: string[], optionalColumns: string[]) {
  return [...baseColumns, ...optionalColumns].join(', ')
}

export function withOptionalJobColumns(
  row: Record<string, unknown> | null | undefined,
  availableColumns: string[]
) {
  if (!row) return row

  const nextRow: Record<string, unknown> = { ...row }
  for (const column of optionalJobColumns) {
    if (!(column in nextRow)) {
      nextRow[column] = availableColumns.includes(column) ? nextRow[column] ?? null : null
    }
  }

  return nextRow
}

export function filterOptionalJobColumnPayload(
  payload: Record<string, unknown>,
  availableColumns: string[]
) {
  const nextPayload = { ...payload }
  for (const column of optionalJobColumns) {
    if (!availableColumns.includes(column)) {
      delete nextPayload[column]
    }
  }
  return nextPayload
}
