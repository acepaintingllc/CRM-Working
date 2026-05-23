'use client'

import { Plus, Trash2 } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import type { EstimateV2PrejobTripDraft } from '@/types/estimator/v2Scopes'
import type { DetailsPrejobTripsVm } from '../_lib/estimateV2DetailsPrejobTrips'

const inputClassName =
  'h-10 rounded-[6px] border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)] px-3 text-sm font-semibold text-[color:var(--crm-ui-ink)] outline-none focus:border-[color:var(--crm-ui-accent)]'
const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

const emptyPrejobTripsVm: DetailsPrejobTripsVm = {
  rows: [],
  roomOptions: [],
  total: 0,
}

export function EstimateV2DetailsPrejobTrips({
  vm,
  onAdd,
  onUpdate,
  onRemove,
}: {
  vm?: DetailsPrejobTripsVm
  onAdd: () => void
  onUpdate: (rowId: string, patch: Partial<EstimateV2PrejobTripDraft>) => void
  onRemove: (rowId: string) => void
}) {
  const safeVm = vm ?? emptyPrejobTripsVm

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[color:var(--crm-ui-ink)]">
          Prep trip total: {formatCurrency(safeVm.total)}
        </div>
        <CrmButton type="button" tone="secondary" onClick={onAdd}>
          <span className="inline-flex items-center gap-2">
            <Plus size={16} aria-hidden="true" />
            <span>Add prejob trip</span>
          </span>
        </CrmButton>
      </div>

      {safeVm.rows.length === 0 ? (
        <div className="rounded-[6px] border border-dashed border-[color:var(--crm-ui-border)] p-4 text-sm text-[color:var(--crm-ui-muted)]">
          No prejob trips added.
        </div>
      ) : (
        <div className="grid gap-3">
          {safeVm.rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-3 rounded-[6px] border border-[color:var(--crm-ui-border)] p-3 lg:grid-cols-[minmax(180px,1fr)_160px_90px_120px_140px_minmax(180px,1fr)_auto]"
            >
              <label className="grid gap-1">
                <span className={labelClassName}>Trip Name</span>
                <input
                  className={inputClassName}
                  value={row.tripName}
                  onChange={(event) => onUpdate(row.id, { tripName: event.currentTarget.value })}
                />
              </label>
              <label className="grid gap-1">
                <span className={labelClassName}>Room Context</span>
                <select
                  className={inputClassName}
                  value={row.roomId}
                  onChange={(event) => onUpdate(row.id, { roomId: event.currentTarget.value })}
                >
                  <option value="">Job level</option>
                  {safeVm.roomOptions.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className={labelClassName}>Trips</span>
                <input
                  className={inputClassName}
                  value={row.tripCount}
                  inputMode="decimal"
                  onChange={(event) => onUpdate(row.id, { tripCount: event.currentTarget.value })}
                />
              </label>
              <label className="grid gap-1">
                <span className={labelClassName}>Rate</span>
                <input
                  className={inputClassName}
                  value={row.tripRate}
                  inputMode="decimal"
                  placeholder="$"
                  onChange={(event) => onUpdate(row.id, { tripRate: event.currentTarget.value })}
                />
              </label>
              <label className="grid gap-1">
                <span className={labelClassName}>Adjustment</span>
                <input
                  className={inputClassName}
                  value={row.manualAdjustment}
                  inputMode="decimal"
                  placeholder="$"
                  onChange={(event) => onUpdate(row.id, { manualAdjustment: event.currentTarget.value })}
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
                    aria-label={`Remove ${row.tripName || 'prejob trip'}`}
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
