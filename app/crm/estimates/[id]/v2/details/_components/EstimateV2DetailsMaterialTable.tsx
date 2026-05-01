import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { formatDetailsNumber } from '../_lib/estimateV2DetailsShared'
import type { DetailsConditionsVm, DetailsScopeLineVm } from '../_lib/estimateV2DetailsVm'
import { useEstimateV2DetailsMaterialTableInputState } from '../_state/useEstimateV2DetailsMaterialTableInputState'
import type { ConditionLevel } from '@/types/estimator/v2'
import { EstimateV2DetailsConditionsPanel } from './EstimateV2DetailsConditionsPanel'

const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

export function EstimateV2DetailsMaterialTable({
  rows,
  onOverride,
  emptyTitle = 'No Active Scopes',
  emptyMessage = 'There are no active scopes to plan in this section.',
  scope,
  conditionsVm,
  onConditionToggle,
}: {
  rows: DetailsScopeLineVm[]
  onOverride: (row: DetailsScopeLineVm, value: string) => void
  emptyTitle?: string
  emptyMessage?: string
  scope?: 'wall' | 'ceiling' | 'trim'
  conditionsVm?: DetailsConditionsVm
  onConditionToggle?: (conditionId: string, level: ConditionLevel | null) => void
}) {
  const {
    overrideDisplayValue,
    onFocusOverride,
    onBlurOverride,
    onChangeOverride,
  } = useEstimateV2DetailsMaterialTableInputState({ rows, onOverride })

  const conditionsPanel =
    scope && conditionsVm && onConditionToggle ? (
      <EstimateV2DetailsConditionsPanel
        scope={scope}
        conditions={conditionsVm.conditions}
        selections={conditionsVm.selections[scope]}
        onToggle={onConditionToggle}
        available={conditionsVm.available}
      />
    ) : null

  if (rows.length === 0) {
    return (
      <div>
        <CrmEmptyState compact title={emptyTitle} description={emptyMessage} />
        {conditionsPanel}
      </div>
    )
  }

  return (
    <div>
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
                    value={overrideDisplayValue(row)}
                    onFocus={() => onFocusOverride(row)}
                    onBlur={() => onBlurOverride(row)}
                    onChange={(event) => {
                      onChangeOverride(row, event.target.value)
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
    {conditionsPanel}
    </div>
  )
}
