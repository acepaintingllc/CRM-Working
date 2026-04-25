import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import type {
  DetailsRollerCoverOption,
  DetailsRollerState,
  DetailsRollerVm,
} from '../_lib/estimateV2DetailsVm'
import { formatDetailsNumber } from '../_lib/estimateV2DetailsShared'

function RollerSelect({
  value,
  options,
  onChange,
  placeholder = 'Select cover',
}: {
  value: string
  options: DetailsRollerCoverOption[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={crmInputClassName('w-full min-w-0 text-sm')}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function EstimateV2DetailsRollerRows({
  rows,
  options,
  onChange,
  selectPlaceholder,
}: {
  rows: DetailsRollerVm[]
  options: DetailsRollerCoverOption[]
  onChange: (id: string, patch: Partial<DetailsRollerState[string]>) => void
  selectPlaceholder?: string
}) {
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.id} className="ace-crm-surface-muted grid gap-3 rounded-xl p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(160px,1.1fr)_minmax(160px,1fr)_90px_minmax(140px,1fr)] lg:items-start">
            <div className="min-w-0">
              <div className="font-black text-[color:var(--crm-ui-text)]">{row.label}</div>
              <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">
                {row.sublabel} - {formatDetailsNumber(row.sqFt)} sqft - {row.product}
              </div>
            </div>
            <RollerSelect
              value={row.coverId}
              options={options}
              onChange={(coverId) => onChange(row.id, { coverId })}
              placeholder={selectPlaceholder}
            />
            <input
              aria-label={`${row.label} quantity`}
              value={row.quantity}
              onChange={(event) => onChange(row.id, { quantity: event.target.value })}
              className={crmInputClassName('w-full min-w-0 text-sm')}
              placeholder="Qty"
              inputMode="decimal"
            />
            <input
              aria-label={`${row.label} notes`}
              value={row.notes}
              onChange={(event) => onChange(row.id, { notes: event.target.value })}
              className={crmInputClassName('w-full min-w-0 text-sm')}
              placeholder="Notes"
            />
          </div>
          {row.errors.length > 0 ? (
            <div className="text-xs font-semibold text-[color:var(--crm-ui-danger-text)]">
              {row.errors.map((issue) => issue.message).join(' - ')}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
