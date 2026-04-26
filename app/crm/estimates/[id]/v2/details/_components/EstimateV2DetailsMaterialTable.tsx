import { useEffect, useState } from 'react'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { formatDetailsNumber } from '../_lib/estimateV2DetailsShared'
import type { DetailsScopeLineVm } from '../_lib/estimateV2DetailsVm'

const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

function materialOverrideInputKey(row: DetailsScopeLineVm) {
  return row.overrideKey || row.id
}

export function EstimateV2DetailsMaterialTable({
  rows,
  onOverride,
  emptyTitle = 'No Active Scopes',
  emptyMessage = 'There are no active scopes to plan in this section.',
}: {
  rows: DetailsScopeLineVm[]
  onOverride: (row: DetailsScopeLineVm, value: string) => void
  emptyTitle?: string
  emptyMessage?: string
}) {
  const [focusedOverrideKey, setFocusedOverrideKey] = useState<string | null>(null)
  const [draftOverrideValues, setDraftOverrideValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const rowKeys = new Set(rows.map(materialOverrideInputKey))
    setDraftOverrideValues((prev) => {
      let changed = false
      const next: Record<string, string> = {}
      for (const [key, value] of Object.entries(prev)) {
        if (!rowKeys.has(key)) {
          changed = true
          continue
        }
        next[key] = value
      }
      return changed ? next : prev
    })
    if (focusedOverrideKey && !rowKeys.has(focusedOverrideKey)) {
      setFocusedOverrideKey(null)
    }
  }, [focusedOverrideKey, rows])

  if (rows.length === 0) {
    return <CrmEmptyState compact title={emptyTitle} description={emptyMessage} />
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="bg-[color:var(--crm-ui-surface-muted)]">
            {[
              'Color',
              'Name',
              'Rooms',
              'Sq Ft',
              'Coats',
              'Product',
              'Calc Gal',
              'Rounded',
              'Override',
              'Final',
            ].map((label) => (
              <th key={label} className={`${labelClassName} px-3 py-3`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overrideInputKey = materialOverrideInputKey(row)
            const overrideValue =
              focusedOverrideKey === overrideInputKey
                ? (draftOverrideValues[overrideInputKey] ?? row.overrideGallons)
                : row.overrideGallons

            return (
              <tr
                key={row.id}
                className={row.hasOverride ? 'bg-[color:var(--crm-ui-accent-soft)]' : undefined}
              >
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 font-black">
                  {row.label}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 text-[color:var(--crm-ui-muted)]">
                  {row.colorName || '-'}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 text-[color:var(--crm-ui-muted)]">
                  {row.rooms.join(', ') || '-'}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">
                  {formatDetailsNumber(row.sqFt)}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">
                  {row.coats}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">
                  <div>{row.product}</div>
                  {row.productWarning ? (
                    <div className="mt-1 text-xs text-[color:var(--crm-ui-warning-text)]">
                      {row.productWarning}
                    </div>
                  ) : null}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">
                  {formatDetailsNumber(row.calculatedGallons)}
                  {row.calculationStatus === 'unavailable' ? (
                    <div className="mt-1 text-xs text-[color:var(--crm-ui-danger-text)]">
                      {row.calculationMessage}
                    </div>
                  ) : null}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 font-black">
                  {formatDetailsNumber(row.roundedGallons)}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">
                  <input
                    aria-label={`${row.label} override gallons`}
                    value={overrideValue}
                    onFocus={() => {
                      setFocusedOverrideKey(overrideInputKey)
                      setDraftOverrideValues((prev) => ({
                        ...prev,
                        [overrideInputKey]: row.overrideGallons,
                      }))
                    }}
                    onBlur={() => {
                      setFocusedOverrideKey((current) =>
                        current === overrideInputKey ? null : current
                      )
                      setDraftOverrideValues((prev) => {
                        if (!(overrideInputKey in prev)) return prev
                        const next = { ...prev }
                        delete next[overrideInputKey]
                        return next
                      })
                    }}
                    onChange={(event) => {
                      const value = event.target.value
                      setDraftOverrideValues((prev) => ({
                        ...prev,
                        [overrideInputKey]: value,
                      }))
                      onOverride(row, value)
                    }}
                    className={crmInputClassName(
                      `w-24 min-w-0 text-sm ${row.hasOverride ? 'border-[color:var(--crm-ui-accent-border)] text-[color:var(--crm-ui-accent)]' : ''}`
                    )}
                    inputMode="decimal"
                  />
                  {row.errors.length > 0 ? (
                    <div className="mt-1 text-xs text-[color:var(--crm-ui-danger-text)]">
                      {row.errors.map((issue) => issue.message).join(' - ')}
                    </div>
                  ) : null}
                </td>
                <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 font-black text-[color:var(--crm-ui-text)]">
                  {formatDetailsNumber(row.finalGallons)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
