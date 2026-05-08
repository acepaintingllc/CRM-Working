'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { loadData } from '@/lib/client/api'
import type { UnsafeRecord } from '@/types/estimator/v2'
import { EstimateV2WorkflowFooterBar } from '../../_components/EstimateV2WorkflowFooterBar'
import { EstimateV2SummaryPolicyControls } from '../../_components/EstimateV2SummaryPolicyControls'
import { useEstimateV2SummaryData } from '../../_state/useEstimateV2SummaryData'
import {
  resolveEstimateRouteFamily,
  type EstimateRouteFamily,
  type EstimateRouteFamilyKey,
} from '../../../estimateRouteFamily'
import { fmtD, fmtH, fmtNumber, fmtPct, fmtUSD } from '../_lib/estimateV2SummaryFormat'
import { useEstimateV2SummaryDerived } from '../_lib/useEstimateV2SummaryDerived'

const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

const summaryCardStyle = {
  background: 'var(--crm-ui-surface)',
  border: '1px solid var(--crm-ui-border)',
  borderRadius: 8,
  padding: 14,
}

const summaryInputStyle = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--crm-ui-border)',
  background: 'var(--crm-ui-surface)',
  color: 'var(--crm-ui-ink)',
  fontSize: 13,
  fontWeight: 700,
  outline: 'none',
}

type SendStatus = {
  status: string
  sent_at?: string | null
  viewed_at?: string | null
  accepted_at?: string | null
  declined_at?: string | null
  public_url?: string | null
}

function IconLabel({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span>{children}</span>
    </span>
  )
}

function textValue(row: UnsafeRecord, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function numberValue(row: UnsafeRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null
    if (parsed != null && Number.isFinite(parsed)) return parsed
  }
  return null
}

function buildChargeRows(accessFees: UnsafeRecord[], otherCharges: UnsafeRecord[]) {
  const rows: { label: string; value: string; total: number }[] = []

  for (const fee of accessFees) {
    const label =
      textValue(fee, 'label') ||
      textValue(fee, 'display_name') ||
      textValue(fee, 'access_fee_id') ||
      'Access fee'
    const qty = numberValue(fee, ['qty']) ?? 1
    const total =
      numberValue(fee, ['effective_total', 'final_total', 'raw_total', 'override_total']) ??
      numberValue(fee, ['actual_cost_override']) ??
      (numberValue(fee, ['catalog_amount', 'amount']) ?? 0) * qty
    rows.push({ label: `${label} x ${qty}`, value: fmtUSD(total), total })
  }

  for (const item of otherCharges) {
    const label = textValue(item, 'client_description') || 'Other'
    const qty = numberValue(item, ['qty']) ?? 1
    const total =
      numberValue(item, ['effective_total', 'final_total', 'raw_total', 'override_total']) ??
      (numberValue(item, ['materials_each']) ?? 0) * qty
    rows.push({ label: `${label} x ${qty}`, value: fmtUSD(total), total })
  }

  return rows
}

function MetricCard({
  label,
  value,
  helper,
  accent = false,
}: {
  label: string
  value: string
  helper?: string | null
  accent?: boolean
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)] p-4">
      <div className={labelClassName}>{label}</div>
      <div
        className={`mt-2 font-mono text-2xl font-black tabular-nums ${
          accent ? 'text-[color:var(--crm-ui-accent)]' : 'text-[color:var(--crm-ui-ink)]'
        }`}
      >
        {value}
      </div>
      {helper ? <div className="mt-1 text-xs font-semibold text-[color:var(--crm-ui-muted)]">{helper}</div> : null}
    </div>
  )
}

function SendStatusChip({ sendStatus }: { sendStatus: SendStatus }) {
  const label = (() => {
    if (sendStatus.accepted_at) return 'Accepted'
    if (sendStatus.declined_at) return 'Declined'
    if (sendStatus.viewed_at) return 'Viewed'
    if (sendStatus.sent_at) return 'Sent'
    return 'Draft'
  })()

  const tone = (() => {
    if (sendStatus.accepted_at) return 'success'
    if (sendStatus.declined_at) return 'danger'
    if (sendStatus.sent_at || sendStatus.viewed_at) return 'warning'
    return 'default'
  })() as 'success' | 'danger' | 'warning' | 'default'

  return <CrmChip tone={tone}>{label}</CrmChip>
}

function SummaryRows({
  rows,
  empty = 'No rows',
}: {
  rows: { label: string; value: string }[]
  empty?: string
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-[color:var(--crm-ui-muted)]">{empty}</div>
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 border-b border-[color:var(--crm-ui-border)] py-2 text-sm last:border-b-0"
        >
          <span className="text-[color:var(--crm-ui-muted)]">{row.label}</span>
          <strong className="font-mono tabular-nums text-[color:var(--crm-ui-ink)]">{row.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function EstimateV2SummaryPageContent({
  estimateId,
  routeFamily,
  routeFamilyKey = 'estimate',
  pageEyebrow = 'Internal quote summary',
}: {
  estimateId: string
  routeFamily?: EstimateRouteFamily
  routeFamilyKey?: EstimateRouteFamilyKey
  pageEyebrow?: string
}) {
  const resolvedRouteFamily = routeFamily ?? resolveEstimateRouteFamily(routeFamilyKey)
  const customerSendApiHref = useMemo(
    () => resolvedRouteFamily.customerSendApiHref(estimateId),
    [estimateId, resolvedRouteFamily]
  )
  const {
    data,
    job,
    loading,
    error,
    retrySummary,
    policySaving,
    jobSettingsVm,
  } = useEstimateV2SummaryData(estimateId, resolvedRouteFamily)
  const [openRooms, setOpenRooms] = useState<Record<string, boolean>>({})
  const [policiesOpen, setPoliciesOpen] = useState(false)
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null)
  const derived = useEstimateV2SummaryDerived({
    data,
    job,
    jobSettingsDraft: {
      dayhours: jobSettingsVm.draft.dayhours,
      laborRate: jobSettingsVm.draft.laborRate,
    },
  })

  useEffect(() => {
    let cancelled = false
    loadData<{
      version?: {
        status?: string
        sent_at?: string | null
        viewed_at?: string | null
        accepted_at?: string | null
        declined_at?: string | null
      } | null
      public_url?: string | null
    }>(customerSendApiHref)
      .then((res) => {
        if (cancelled) return
        const version = res?.version
        if (version?.status) {
          setSendStatus({
            status: version.status,
            sent_at: version.sent_at,
            viewed_at: version.viewed_at,
            accepted_at: version.accepted_at,
            declined_at: version.declined_at,
            public_url: res?.public_url ?? null,
          })
        }
      })
      .catch(() => {
        // Send status is supporting context; the summary can render without it.
      })
    return () => {
      cancelled = true
    }
  }, [customerSendApiHref])

  if (loading) {
    return (
      <CrmPageShell>
        <CrmSectionCard title="Loading summary">
          <div role="status" aria-label="Loading quote summary" className="text-sm text-[color:var(--crm-ui-muted)]">
            Loading summary...
          </div>
        </CrmSectionCard>
      </CrmPageShell>
    )
  }

  if (error || !data) {
    return (
      <CrmPageShell>
        <CrmSectionCard title="Summary unavailable">
          <div role="alert" aria-label="Quote summary failed to load">
            <div className="grid gap-3">
              <CrmNotice tone="error">
                {error?.message ?? 'We couldn’t load this quote summary.'}
              </CrmNotice>
              <div>
                <CrmButton type="button" tone="primary" onClick={retrySummary}>
                  Retry
                </CrmButton>
              </div>
            </div>
          </div>
        </CrmSectionCard>
      </CrmPageShell>
    )
  }

  const customerLine = [job?.customer_name, job?.customer_address].filter(Boolean).join(' | ')
  const customerContactLine = [job?.customer_email, job?.customer_phone].filter(Boolean).join(' | ')
  const accessFees = data.inputs?.access_fees ?? []
  const otherCharges = data.inputs?.other ?? []
  const chargeRows = buildChargeRows(accessFees, otherCharges)
  const chargeTotal = chargeRows.reduce((sum, row) => sum + row.total, 0)

  return (
    <CrmPageShell className="max-w-[1480px]">
      <CrmPageHeader
        title={derived.versionName}
        description={
          [job?.title, customerLine, customerContactLine].filter(Boolean).join(' | ') ||
          'Quote pricing, rooms, paint, supplies, and customer send readiness.'
        }
        eyebrow={pageEyebrow}
        backAction={
          <CrmButton type="button" tone="secondary" href={resolvedRouteFamily.detailsHref(estimateId)}>
            <IconLabel icon={<ArrowLeft size={16} aria-hidden="true" />}>Back</IconLabel>
          </CrmButton>
        }
        meta={
          <>
            <CrmChip tone="accent">{derived.statusLabel}</CrmChip>
            {sendStatus ? <SendStatusChip sendStatus={sendStatus} /> : null}
            <CrmChip>Crew: {derived.crewSize}</CrmChip>
            {(data.pricing_summary?.sharedAccessCost ?? 0) > 0 ? (
              <CrmChip tone="accent">
                Access: {fmtUSD(data.pricing_summary?.sharedAccessCost ?? 0)}
              </CrmChip>
            ) : null}
            {data.estimate.updated_at ? (
              <CrmChip>
                Updated{' '}
                {new Date(data.estimate.updated_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </CrmChip>
            ) : null}
          </>
        }
      />

      <main className="grid gap-4 pb-24">
        {derived.configurationWarning ? (
          <CrmNotice tone="warning">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-1">
                <div className="font-bold">{derived.configurationWarning.title}</div>
                <div>{derived.configurationWarning.detail}</div>
                <div>{derived.configurationWarning.fixHint}</div>
              </div>
              <div>
                <CrmButton type="button" tone="secondary" href={resolvedRouteFamily.editorHref(estimateId)}>
                  Open estimate editor
                </CrmButton>
              </div>
            </div>
          </CrmNotice>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="md:col-span-2 xl:col-span-2">
            <MetricCard label="Final Total" value={fmtUSD(derived.finalTotal)} accent />
          </div>
          <MetricCard
            label="Labor Hours"
            value={fmtH(derived.pricingKpis.laborHours)}
            helper={
              derived.pricingKpis.rawLaborHours != null &&
              derived.pricingKpis.rawLaborHours !== derived.pricingKpis.laborHours
                ? `Raw: ${fmtH(derived.pricingKpis.rawLaborHours)}`
                : null
            }
          />
          <MetricCard
            label="Days"
            value={fmtD(derived.pricingKpis.laborDays)}
            helper={
              derived.pricingKpis.rawLaborDays != null &&
              derived.pricingKpis.rawLaborDays !== derived.pricingKpis.laborDays
                ? `Raw: ${fmtD(derived.pricingKpis.rawLaborDays)}`
                : null
            }
          />
          <MetricCard label="Labor Cost" value={fmtUSD(derived.pricingKpis.laborCost)} />
          <MetricCard label="Supplies" value={fmtUSD(derived.pricingKpis.suppliesCost)} />
        </section>

        <div className="grid gap-4">
          <div className="grid min-w-0 gap-4">
            {derived.summaryAlerts.length > 0 ? (
              <CrmSectionCard title="System Alerts">
                <div className="grid gap-2">
                  {derived.summaryAlerts.map((alert) => (
                    <CrmNotice
                      key={`${alert.kind}:${alert.title}:${alert.detail}`}
                      tone={alert.kind === 'error' ? 'error' : alert.kind === 'warn' ? 'warning' : 'info'}
                      compact
                    >
                      <strong>{alert.title}</strong>
                      {alert.detail ? <span className="ml-1">{alert.detail}</span> : null}
                    </CrmNotice>
                  ))}
                </div>
              </CrmSectionCard>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-2">
              <CrmSectionCard title="Price Breakdown" description="Policy-adjusted pricing used for the customer quote.">
                <div className="mb-4 grid gap-2">
                  {policySaving ? (
                    <CrmNotice tone="info" compact>
                      Saving summary policy changes...
                    </CrmNotice>
                  ) : null}
                  <EstimateV2SummaryPolicyControls
                    vm={jobSettingsVm}
                    card={summaryCardStyle}
                    inputStyle={summaryInputStyle}
                    colors={{
                      border: 'var(--crm-ui-border)',
                      ink3: 'var(--crm-ui-muted)',
                      green: 'var(--crm-ui-accent)',
                      cardDark: 'var(--crm-ui-surface)',
                    }}
                    open={policiesOpen}
                    onToggleOpen={() => setPoliciesOpen((current) => !current)}
                    compact
                  />
                </div>
                <SummaryRows rows={derived.priceBreakdownRows} />
                <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-[color:var(--crm-ui-border)] pt-4">
                  <span className={labelClassName}>Final Total</span>
                  <strong className="font-mono text-2xl font-black tabular-nums text-[color:var(--crm-ui-accent)]">
                    {fmtUSD(derived.finalTotal)}
                  </strong>
                </div>
              </CrmSectionCard>

              <CrmSectionCard title="Paint & Supplies Summary">
                <SummaryRows rows={derived.paintSupplyRows} />
                <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-[color:var(--crm-ui-border)] pt-4">
                  <span className={labelClassName}>Total</span>
                  <strong className="font-mono text-xl font-black tabular-nums">
                    {fmtUSD(derived.paintSuppliesTotal)}
                  </strong>
                </div>
              </CrmSectionCard>
            </section>

            {chargeRows.length > 0 ? (
              <CrmSectionCard title="Access Fees & Other Charges">
                <SummaryRows rows={chargeRows} />
                <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-[color:var(--crm-ui-border)] pt-4">
                  <span className={labelClassName}>Total Charges</span>
                  <strong className="font-mono text-xl font-black tabular-nums">{fmtUSD(chargeTotal)}</strong>
                </div>
              </CrmSectionCard>
            ) : null}

            <CrmSectionCard
              title="Room Details"
              description={`${derived.rooms.length} room${derived.rooms.length === 1 ? '' : 's'} in this quote.`}
            >
              {derived.roomBlocks.length === 0 ? (
                <div className="text-sm text-[color:var(--crm-ui-muted)]">No rooms</div>
              ) : (
                <div className="grid gap-3">
                  {derived.roomBlocks.map((block) => {
                    const roomId = block.room.room_id
                    const open = !!openRooms[roomId]
                    const roomName = block.room.room_name ?? roomId
                    return (
                      <div
                        key={roomId}
                        className="overflow-hidden rounded-[8px] border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)]"
                      >
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`estimate-v2-summary-room-panel-${roomId}`}
                          aria-label={`${roomName} room details`}
                          onClick={() => setOpenRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }))}
                          className="grid w-full gap-3 px-4 py-3 text-left md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_repeat(4,minmax(88px,auto))] md:items-center"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-[color:var(--crm-ui-ink)]">{roomName}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {block.scopes.length > 0 ? (
                                block.scopes.map((scope) => <CrmChip key={scope}>{scope}</CrmChip>)
                              ) : (
                                <span className="text-xs text-[color:var(--crm-ui-muted)]">No scopes</span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-[color:var(--crm-ui-muted)]">{block.flagsLabel}</div>
                          <div className="text-sm md:text-right">
                            <div className={labelClassName}>Sq Ft</div>
                            <strong className="font-mono">{fmtNumber(block.roomArea, 0)}</strong>
                          </div>
                          <div className="text-sm md:text-right">
                            <div className={labelClassName}>Labor</div>
                            <strong className="font-mono">{fmtH(block.totals.labor)}</strong>
                          </div>
                          <div className="text-sm md:text-right">
                            <div className={labelClassName}>Total</div>
                            <strong className="font-mono text-[color:var(--crm-ui-accent)]">{fmtUSD(block.roomTotal)}</strong>
                          </div>
                          <div className="text-sm md:text-right">
                            <div className={labelClassName}>Share</div>
                            <strong className="font-mono">{fmtPct(block.roomPct)}</strong>
                          </div>
                        </button>

                        {open ? (
                          <div
                            id={`estimate-v2-summary-room-panel-${roomId}`}
                            className="grid gap-2 border-t border-[color:var(--crm-ui-border)] px-4 py-3"
                          >
                            {block.conditionBadges?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {block.conditionBadges.map((badge) => (
                                  <CrmChip key={badge} tone="warning">
                                    {badge}
                                  </CrmChip>
                                ))}
                              </div>
                            ) : null}
                            {block.scopeRows.length === 0 ? (
                              <div className="text-sm text-[color:var(--crm-ui-muted)]">No scoped items</div>
                            ) : (
                              block.scopeRows.map((scope) => (
                                <div
                                  key={scope.id}
                                  className="grid gap-2 border-b border-[color:var(--crm-ui-border)] py-2 text-sm last:border-b-0 md:grid-cols-[minmax(0,1fr)_repeat(5,minmax(90px,auto))]"
                                >
                                  <div className="min-w-0">
                                    <div className="font-bold text-[color:var(--crm-ui-ink)]">{scope.label}</div>
                                    <div className="text-xs text-[color:var(--crm-ui-muted)]">{scope.kind}</div>
                                  </div>
                                  <div className="md:text-right">{fmtNumber(scope.quantity, scope.kind === 'trim' ? 1 : 0)}</div>
                                  <div className="md:text-right">{fmtH(scope.laborHours)}</div>
                                  <div className="md:text-right">{fmtUSD(derived.displayScopePaintCost(scope))}</div>
                                  <div className="md:text-right">{fmtUSD(scope.suppliesCost)}</div>
                                  <div className="font-bold md:text-right">
                                    {fmtUSD(block.displayScopeSubtotalMap.get(scope.id) ?? scope.subtotal)}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </CrmSectionCard>
          </div>
        </div>
      </main>

      <EstimateV2WorkflowFooterBar
        label="Quote total"
        value={fmtUSD(derived.finalTotal)}
        metrics={[
          { label: 'Rooms', value: derived.rooms.length },
          { label: 'Labor', value: fmtH(derived.pricingKpis.laborHours) },
          { label: 'Status', value: derived.statusLabel },
        ]}
        status={sendStatus ? <SendStatusChip sendStatus={sendStatus} /> : null}
        backAction={{
          type: 'link',
          href: resolvedRouteFamily.detailsHref(estimateId),
          label: '<- Back',
        }}
        primaryAction={{
          type: 'link',
          href: resolvedRouteFamily.sendHref(estimateId),
          label: 'Send to client ->',
        }}
      />
    </CrmPageShell>
  )
}
