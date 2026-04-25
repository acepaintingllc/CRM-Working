'use client'

import { ArrowRight, Save } from 'lucide-react'
import type { ReactNode } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import {
  estimateRouteFamily,
  quoteRouteFamily,
  type EstimateRouteFamily,
} from '../../../estimateRouteFamily'
import {
  type DetailsRollerCoverOption,
  type DetailsRollerVm,
  type DetailsScopeLineVm,
} from '../_lib/estimateV2DetailsVm'
import { useEstimateV2DetailsPage } from '../_state/useEstimateV2DetailsPage'

const metricClassName =
  'ace-crm-surface-muted min-w-0 rounded-xl px-4 py-3'
const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

function fmt(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span>{children}</span>
    </span>
  )
}

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

function RollerRows({
  rows,
  options,
  onChange,
  selectPlaceholder,
}: {
  rows: DetailsRollerVm[]
  options: DetailsRollerCoverOption[]
  onChange: (id: string, patch: Partial<{ coverId: string; quantity: string; notes: string }>) => void
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
                {row.sublabel} - {fmt(row.sqFt)} sqft - {row.product}
              </div>
            </div>
            <RollerSelect value={row.coverId} options={options} onChange={(coverId) => onChange(row.id, { coverId })} placeholder={selectPlaceholder} />
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
              {row.errors.join(' - ')}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function MaterialTable({
  rows,
  onOverride,
}: {
  rows: DetailsScopeLineVm[]
  onOverride: (row: DetailsScopeLineVm, value: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="bg-[color:var(--crm-ui-surface-muted)]">
            {['Color', 'Name', 'Rooms', 'Sq Ft', 'Coats', 'Product', 'Calc Gal', 'Rounded', 'Override', 'Final'].map((label) => (
              <th key={label} className={`${labelClassName} px-3 py-3`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.hasOverride ? 'bg-[color:var(--crm-ui-accent-soft)]' : undefined}>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 font-black">{row.label}</td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 text-[color:var(--crm-ui-muted)]">{row.colorName || '-'}</td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 text-[color:var(--crm-ui-muted)]">{row.rooms.join(', ') || '-'}</td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">{fmt(row.sqFt)}</td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">{row.coats}</td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">
                <div>{row.product}</div>
                {row.productWarning ? (
                  <div className="mt-1 text-xs text-[color:var(--crm-ui-warning-text)]">{row.productWarning}</div>
                ) : null}
              </td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">{fmt(row.calculatedGallons)}</td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 font-black">{fmt(row.roundedGallons)}</td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3">
                <input
                  aria-label={`${row.label} override gallons`}
                  value={row.overrideGallons}
                  onChange={(event) => onOverride(row, event.target.value)}
                  className={crmInputClassName(
                    `w-24 min-w-0 text-sm ${row.hasOverride ? 'border-[color:var(--crm-ui-accent-border)] text-[color:var(--crm-ui-accent)]' : ''}`
                  )}
                  inputMode="decimal"
                />
                {row.errors.length > 0 ? (
                  <div className="mt-1 text-xs text-[color:var(--crm-ui-danger-text)]">{row.errors.join(' - ')}</div>
                ) : null}
              </td>
              <td className="border-t border-[color:var(--crm-ui-border)] px-3 py-3 font-black text-[color:var(--crm-ui-text)]">{fmt(row.finalGallons)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryRail({
  page,
  onContinue,
}: {
  page: ReturnType<typeof useEstimateV2DetailsPage>
  onContinue: () => void
}) {
  const { vm } = page

  return (
    <aside className="grid gap-4 lg:sticky lg:top-4">
      <CrmSectionCard
        title="Validation"
        description={vm.validationSummary.message}
        badge={<CrmChip tone={vm.canContinueToSummary ? 'success' : 'danger'}>{vm.validationSummary.title}</CrmChip>}
        variant="rail"
      >
        <div className="grid gap-3">
          {vm.validationIssues.length === 0 ? (
            <CrmNotice tone="success" compact>{vm.validationSummary.message}</CrmNotice>
          ) : (
            <CrmNotice tone="warning" title="Required before summary" compact>
              <ul className="list-disc space-y-1 pl-4">
                {vm.validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </CrmNotice>
          )}
          <CrmButton
            type="button"
            tone="primary"
            onClick={onContinue}
            disabled={page.saving || !vm.canContinueToSummary}
            aria-disabled={page.saving || !vm.canContinueToSummary}
            title={vm.continueBlockedReason ?? undefined}
            className="justify-center"
          >
            <IconLabel icon={<ArrowRight size={16} aria-hidden="true" />}>
              Continue to Summary
            </IconLabel>
          </CrmButton>
          {vm.continueBlockedReason ? (
            <div className="text-xs font-semibold text-[color:var(--crm-ui-muted)]">{vm.continueBlockedReason}</div>
          ) : null}
        </div>
      </CrmSectionCard>

      <CrmSectionCard title="Active Overrides" variant="rail">
        {vm.activeOverrides.length === 0 ? (
          <div className="text-sm text-[color:var(--crm-ui-muted)]">None</div>
        ) : (
          <div className="grid gap-2 text-sm">
            {vm.activeOverrides.map((override) => (
              <div key={override.key} className="flex justify-between gap-3">
                <span>{override.itemName}</span>
                <strong className="text-[color:var(--crm-ui-accent)]">{fmt(override.newValue)} gal</strong>
              </div>
            ))}
          </div>
        )}
      </CrmSectionCard>

      <CrmSectionCard title="Gallons By Scope" variant="rail">
        {[
          ['Walls', vm.gallonsByScope.walls],
          ['Ceilings', vm.gallonsByScope.ceilings],
          ['Trim', vm.gallonsByScope.trim],
          ['Total', vm.gallonsByScope.total],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-[color:var(--crm-ui-border)] py-2 text-sm last:border-b-0">
            <span>{label}</span>
            <strong>{fmt(Number(value))}</strong>
          </div>
        ))}
      </CrmSectionCard>
    </aside>
  )
}

export function EstimateV2DetailsPageContent({
  estimateId,
  routeFamilyKey = 'estimate',
  routeFamily,
}: {
  estimateId: string
  routeFamilyKey?: 'estimate' | 'quote'
  routeFamily?: EstimateRouteFamily
}) {
  const resolvedRouteFamily =
    routeFamily ?? (routeFamilyKey === 'quote' ? quoteRouteFamily : estimateRouteFamily)
  const page = useEstimateV2DetailsPage({ estimateId, routeFamily: resolvedRouteFamily })
  const { vm, actions } = page
  const saveError = page.error && page.estimate ? page.error.message : null

  if (page.loading) {
    return (
      <CrmPageShell>
        <CrmSectionCard title="Loading details">
          <div role="status" aria-label="Loading estimate details" className="text-sm text-[color:var(--crm-ui-muted)]">
            Loading details...
          </div>
        </CrmSectionCard>
      </CrmPageShell>
    )
  }

  if (page.error && !page.estimate) {
    return (
      <CrmPageShell>
        <CrmSectionCard title="Details unavailable">
          <CrmNotice tone="error">{page.error.message}</CrmNotice>
        </CrmSectionCard>
      </CrmPageShell>
    )
  }

  return (
    <CrmPageShell className="max-w-[1480px]">
      <CrmPageHeader
        title="Details & Overrides"
        description="Material planning, gallon overrides, persisted roller and trim applicator planning, and final validation before summary."
        eyebrow="Estimate V2"
        backHref={resolvedRouteFamily.editorHref(estimateId)}
        actions={
          <>
            <CrmChip tone={page.dirty ? 'warning' : 'success'}>{page.saveStatusText}</CrmChip>
            <CrmButton type="button" onClick={() => void actions.saveDraft()} disabled={page.saving}>
              <IconLabel icon={<Save size={16} aria-hidden="true" />}>
                {page.saving ? 'Saving...' : 'Save Draft'}
              </IconLabel>
            </CrmButton>
            <CrmButton
              type="button"
              tone="primary"
              onClick={() => void actions.continueToSummary()}
              disabled={page.saving || !vm.canContinueToSummary}
              title={vm.continueBlockedReason ?? undefined}
            >
              <IconLabel icon={<ArrowRight size={16} aria-hidden="true" />}>
                Continue to Summary
              </IconLabel>
            </CrmButton>
          </>
        }
        meta={
          <>
            <CrmChip tone="accent">{page.estimate?.version_name ?? 'Estimate'}</CrmChip>
            <CrmChip tone={vm.canContinueToSummary ? 'success' : 'danger'}>
              {vm.validationSummary.title}
            </CrmChip>
          </>
        }
      />

      {saveError ? <CrmNotice tone="error" title="Save failed">{saveError}</CrmNotice> : null}
      {!vm.canContinueToSummary ? (
        <CrmNotice tone="warning" title="Summary blocked">
          {vm.validationSummary.message}
        </CrmNotice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <main className="grid min-w-0 gap-4">
          <CrmSectionCard title="Material Overview" description="Final gallons use saved overrides when present.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {vm.materialCards.map((item) => (
                <div
                  key={item.label}
                  className={`${metricClassName} ${item.overridden ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)]' : ''}`}
                >
                  <div className={labelClassName}>{item.label}</div>
                  <div className="mt-2 text-2xl font-black text-[color:var(--crm-ui-text)]">{item.finalValue}</div>
                  <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">{item.calculatedValue}</div>
                </div>
              ))}
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Paint Planning" description={`${vm.wallRows.length} active wall color group${vm.wallRows.length === 1 ? '' : 's'}.`}>
            <MaterialTable rows={vm.wallRows} onOverride={(row, value) => actions.setWallOverride(row.colorId ?? row.id, value)} />
          </CrmSectionCard>

          {vm.ceilingRow ? (
            <CrmSectionCard title="Ceiling Paint Planning" description={`${fmt(vm.ceilingRow.sqFt)} sqft across active ceiling scopes.`}>
              <MaterialTable rows={[vm.ceilingRow]} onOverride={(_, value) => actions.setCeilingOverride(value)} />
            </CrmSectionCard>
          ) : null}

          {vm.trimRow ? (
            <CrmSectionCard title="Trim Paint Planning" description="Paint gallons for trim and baseboards.">
              <MaterialTable rows={[vm.trimRow]} onOverride={(_, value) => actions.setTrimOverride(value)} />
            </CrmSectionCard>
          ) : null}

          <CrmSectionCard title="Rollers & Applicators" description={`${vm.wallRollerRows.length + (vm.ceilingRollerRow ? 1 : 0) + (vm.trimApplicatorRow ? 1 : 0)} required persisted planning row${vm.wallRollerRows.length + (vm.ceilingRollerRow ? 1 : 0) + (vm.trimApplicatorRow ? 1 : 0) === 1 ? '' : 's'}.`}>
            <div className="grid gap-5">
              {vm.rollerOptionsState.status !== 'loaded' ? (
                <CrmNotice
                  tone={vm.rollerOptionsState.status === 'unavailable' ? 'error' : 'warning'}
                  compact
                >
                  {vm.rollerOptionsState.message}
                </CrmNotice>
              ) : null}
              <div className="grid gap-2">
                <div className={labelClassName}>Wall Rollers</div>
                <RollerRows rows={vm.wallRollerRows} options={vm.wallRollerOptions} onChange={actions.setRollerRow} />
              </div>
              {vm.ceilingRollerRow ? (
                <div className="grid gap-2">
                  <div className={labelClassName}>Ceiling Rollers</div>
                  <RollerRows rows={[vm.ceilingRollerRow]} options={vm.ceilingRollerOptions} onChange={actions.setRollerRow} />
                </div>
              ) : null}
              {vm.trimApplicatorRow ? (
                <div className="grid gap-2">
                  <div className={labelClassName}>Trim Applicators</div>
                  <RollerRows rows={[vm.trimApplicatorRow]} options={vm.trimApplicatorOptions} onChange={actions.setRollerRow} selectPlaceholder="Select applicator" />
                </div>
              ) : null}
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Active Overrides" description="Saved gallon overrides that will affect material totals.">
            {vm.activeOverrides.length === 0 ? (
              <div className="text-sm text-[color:var(--crm-ui-muted)]">No active gallon overrides.</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {vm.activeOverrides.map((override) => (
                  <div key={override.key} className="ace-crm-surface-muted rounded-xl px-4 py-3">
                    <div className="font-black">{override.itemName}</div>
                    <div className="mt-1 text-sm text-[color:var(--crm-ui-accent)]">
                      {fmt(override.originalValue)} to {fmt(override.newValue)} gal
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CrmSectionCard>
        </main>

        <SummaryRail page={page} onContinue={() => void actions.continueToSummary()} />
      </div>
    </CrmPageShell>
  )
}
