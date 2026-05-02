'use client'

import { Plus, Trash2 } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import type { EstimateV2AccessFeeDraft } from '@/types/estimator/v2'
import type { DetailsAccessFeesVm } from '../_lib/estimateV2DetailsAccessFees'

const inputClassName =
  'h-10 rounded-[6px] border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)] px-3 text-sm font-semibold text-[color:var(--crm-ui-ink)] outline-none focus:border-[color:var(--crm-ui-accent)]'
const requiredInputClassName =
  'border-[color:var(--crm-ui-danger-border)] bg-[color:var(--crm-ui-danger-bg)] ring-1 ring-[color:var(--crm-ui-danger-border)]'
const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function RequiredLabel({ children, showRequired }: { children: string; showRequired: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={labelClassName}>{children}</span>
      {showRequired ? (
        <span className="rounded border border-[color:var(--crm-ui-danger-border)] bg-[color:var(--crm-ui-danger-bg)] px-1.5 py-0.5 text-[10px] font-black uppercase text-[color:var(--crm-ui-danger-text)]">
          Required
        </span>
      ) : null}
    </span>
  )
}

export function EstimateV2DetailsAccessFees({
  vm,
  onAdd,
  onUpdate,
  onRemove,
}: {
  vm: DetailsAccessFeesVm
  onAdd: () => void
  onUpdate: (rowId: string, patch: Partial<EstimateV2AccessFeeDraft>) => void
  onRemove: (rowId: string) => void
}) {
  return (
    <div className="grid gap-4">
      {vm.allocation?.warning ? (
        <CrmNotice tone="warning" compact>
          {vm.allocation.warning}
        </CrmNotice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[color:var(--crm-ui-ink)]">
          Job-level access total: {formatCurrency(vm.total)}
        </div>
        <CrmButton type="button" tone="secondary" onClick={onAdd}>
          <span className="inline-flex items-center gap-2">
            <Plus size={16} aria-hidden="true" />
            <span>Add access fee</span>
          </span>
        </CrmButton>
      </div>

      {vm.rows.length === 0 ? (
        <div className="rounded-[6px] border border-dashed border-[color:var(--crm-ui-border)] p-4 text-sm text-[color:var(--crm-ui-muted)]">
          No access fees selected.
        </div>
      ) : (
        <div className="grid gap-3">
          {vm.rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-3 rounded-[6px] border border-[color:var(--crm-ui-border)] p-3 lg:grid-cols-[minmax(220px,1fr)_180px_100px_140px_minmax(180px,1fr)_auto]"
            >
              <label className="grid gap-1">
                <RequiredLabel showRequired={!row.accessFeeId}>Fee</RequiredLabel>
                <select
                  className={`${inputClassName} ${!row.accessFeeId ? requiredInputClassName : ''}`}
                  aria-invalid={!row.accessFeeId || undefined}
                  aria-required
                  value={row.accessFeeId}
                  onChange={(event) => onUpdate(row.id, { accessFeeId: event.currentTarget.value })}
                >
                  <option value="">Select fee</option>
                  {vm.optionGroups.map((group) => (
                    <optgroup key={group.key} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className={labelClassName}>Room Context</span>
                <select
                  className={inputClassName}
                  value={row.roomId}
                  onChange={(event) => onUpdate(row.id, { roomId: event.currentTarget.value })}
                >
                  <option value="">Job level</option>
                  {vm.roomOptions.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <RequiredLabel showRequired={!row.qty.trim()}>Qty</RequiredLabel>
                <input
                  className={`${inputClassName} ${!row.qty.trim() ? requiredInputClassName : ''}`}
                  aria-invalid={!row.qty.trim() || undefined}
                  aria-required
                  value={row.qty}
                  inputMode="decimal"
                  onChange={(event) => onUpdate(row.id, { qty: event.currentTarget.value })}
                />
              </label>

              <label className="grid gap-1">
                <span className={labelClassName}>Override</span>
                <input
                  className={inputClassName}
                  value={row.actualCostOverride}
                  inputMode="decimal"
                  placeholder="$"
                  onChange={(event) => onUpdate(row.id, { actualCostOverride: event.currentTarget.value })}
                />
              </label>

              <label className="grid gap-1">
                <span className={labelClassName}>Notes</span>
                <input
                  className={inputClassName}
                  value={row.notes}
                  onChange={(event) => onUpdate(row.id, { notes: event.currentTarget.value })}
                />
              </label>

              <div className="grid gap-1">
                <span className={labelClassName}>Total</span>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black text-[color:var(--crm-ui-ink)]">
                    {formatCurrency(row.effectiveTotal)}
                  </div>
                  <CrmButton
                    type="button"
                    tone="danger"
                    onClick={() => onRemove(row.id)}
                    aria-label={`Remove ${row.label}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </CrmButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
