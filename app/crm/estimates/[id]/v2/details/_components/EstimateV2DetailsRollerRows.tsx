import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import type {
  DetailsRollerCoverOption,
  DetailsRollerState,
  DetailsRollerVm,
} from '../_lib/estimateV2DetailsVm'
import { formatDetailsNumber } from '../_lib/estimateV2DetailsShared'

const requiredInputClassName =
  'border-[color:var(--crm-ui-danger-border)] bg-[color:var(--crm-ui-danger-bg)] ring-1 ring-[color:var(--crm-ui-danger-border)]'

function hasFieldError(row: DetailsRollerVm, field: string) {
  return row.errors.some((issue) => issue.field === field)
}

function RequiredLabel({ children, showRequired }: { children: string; showRequired: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="text-xs font-semibold text-[color:var(--crm-ui-muted)]">{children}</span>
      {showRequired ? (
        <span className="rounded border border-[color:var(--crm-ui-danger-border)] bg-[color:var(--crm-ui-danger-bg)] px-1.5 py-0.5 text-[10px] font-black uppercase text-[color:var(--crm-ui-danger-text)]">
          Required
        </span>
      ) : null}
    </div>
  )
}

function RollerSelect({
  value,
  options,
  onChange,
  placeholder = 'Select cover',
  invalid = false,
}: {
  value: string
  options: DetailsRollerCoverOption[]
  onChange: (value: string) => void
  placeholder?: string
  invalid?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      aria-required
      className={crmInputClassName(`w-full min-w-0 text-sm ${invalid ? requiredInputClassName : ''}`)}
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
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,1fr)_90px] lg:items-start 2xl:grid-cols-[minmax(160px,1.1fr)_minmax(180px,1fr)_90px_minmax(160px,1fr)]">
            <div className="min-w-0">
              <div className="font-black text-[color:var(--crm-ui-text)]">{row.label}</div>
              <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">
                {row.sublabel} - {formatDetailsNumber(row.sqFt)} sqft - {row.product}
              </div>
            </div>
            <div>
              <RequiredLabel showRequired={hasFieldError(row, 'coverId')}>Cover</RequiredLabel>
              <RollerSelect
                value={row.coverId}
                options={options}
                onChange={(coverId) => onChange(row.id, { coverId })}
                placeholder={selectPlaceholder}
                invalid={hasFieldError(row, 'coverId')}
              />
            </div>
            <div>
              <RequiredLabel showRequired={hasFieldError(row, 'quantity')}>Qty</RequiredLabel>
              <input
                aria-label={`${row.label} quantity`}
                aria-invalid={hasFieldError(row, 'quantity') || undefined}
                aria-required
                value={row.quantity}
                onChange={(event) => onChange(row.id, { quantity: event.target.value })}
                className={crmInputClassName(
                  `w-full min-w-0 text-sm ${hasFieldError(row, 'quantity') ? requiredInputClassName : ''}`
                )}
                placeholder="Required"
                inputMode="decimal"
              />
            </div>
            <input
              aria-label={`${row.label} notes`}
              value={row.notes}
              onChange={(event) => onChange(row.id, { notes: event.target.value })}
              className={crmInputClassName('w-full min-w-0 text-sm lg:col-span-3 2xl:col-span-1')}
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
