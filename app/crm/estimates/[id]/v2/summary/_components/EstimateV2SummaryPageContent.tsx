'use client'

import Link from 'next/link'
import { useId, useState, useEffect, type CSSProperties } from 'react'
import { EstimateV2SummaryPolicyControls } from '../../_components/EstimateV2SummaryPolicyControls'
import { EstimateV2SummaryTrimPaintPanel } from '../../_components/EstimateV2SummaryTrimPaintPanel'
import { useEstimateV2SummaryData } from '../../_state/useEstimateV2SummaryData'
import { EstimateV2SummaryAlerts } from './EstimateV2SummaryAlerts'
import { EstimateV2SummaryKPIRail } from './EstimateV2SummaryKPIRail'
import { EstimateV2SummaryPricingTable } from './EstimateV2SummaryPricingTable'
import { EstimateV2SummaryRoomBlock } from './EstimateV2SummaryRoomBlock'
import { fmtUSD, fmtH, fmtNumber } from '../_lib/estimateV2SummaryFormat'
import { useEstimateV2SummaryDerived } from '../_lib/useEstimateV2SummaryDerived'
import {
  resolveEstimateRouteFamily,
  type EstimateRouteFamily,
  type EstimateRouteFamilyKey,
} from '../../../estimateRouteFamily'
import { loadData } from '@/lib/client/api'
import type { UnsafeRecord } from '@/types/estimator/v2'

const C = {
  bg: '#0a0a0a',
  card: '#1a1a1a',
  cardDark: '#131313',
  border: '#262626',
  borderFocus: '#484848',
  ink: '#f5f5f5',
  ink2: '#c5c5c5',
  ink3: '#9a9a9a',
  inkSub: '#b0b0b0',
  green: '#84cc93',
  amber: '#fbbf24',
  radius: 12,
  radiusSm: 6,
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "'Inter', system-ui, sans-serif",
} as const

const card: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: C.radius,
  padding: '16px 16px',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: C.radiusSm,
  border: `1px solid ${C.borderFocus}`,
  background: C.cardDark,
  color: C.ink,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: C.mono,
  outline: 'none',
  appearance: 'none',
}

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(255,255,255,0.03), transparent 28%), linear-gradient(180deg, #0a0a0a 0%, #090909 100%)',
  color: C.ink,
  fontFamily: C.sans,
  display: 'flex',
  flexDirection: 'column',
}

const contentShellStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 18,
  padding: '22px 22px 76px',
  minWidth: 0,
}

const mainColStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'grid',
  gap: 16,
}

const utilityRailStyle: CSSProperties = {
  width: 300,
  flexShrink: 0,
  position: 'sticky',
  top: 54,
  height: 'calc(100vh - 54px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  paddingLeft: 2,
}

type StatusTone = {
  border: string
  background: string
  color: string
}

type SharedSectionKey = 'alerts' | 'pricing' | 'paint' | 'charges' | 'rooms'

function getStatusTone(statusLabel: string): StatusTone {
  const normalized = statusLabel.trim().toLowerCase()

  if (normalized.includes('approved') || normalized.includes('sent')) {
    return {
      border: '1px solid rgba(132,204,147,0.28)',
      background: 'rgba(132,204,147,0.12)',
      color: C.green,
    }
  }

  if (normalized.includes('error') || normalized.includes('rejected')) {
    return {
      border: '1px solid rgba(248,113,113,0.28)',
      background: 'rgba(248,113,113,0.12)',
      color: '#fca5a5',
    }
  }

  return {
    border: '1px solid rgba(251,191,36,0.24)',
    background: 'rgba(251,191,36,0.1)',
    color: C.amber,
  }
}

function SummaryStatusBadge({ statusLabel }: { statusLabel: string }) {
  const tone = getStatusTone(statusLabel)

  return (
    <span
      aria-label={`Quote status: ${statusLabel}`}
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        border: tone.border,
        background: tone.background,
        color: tone.color,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabel}
    </span>
  )
}

function SummaryActionLinks({
  estimateId,
  routeFamily,
  compact = false,
}: {
  estimateId: string
  routeFamily: EstimateRouteFamily
  compact?: boolean
}) {
  const baseStyle: CSSProperties = compact
    ? {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 42,
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 800,
        textDecoration: 'none',
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px 14px',
        borderRadius: C.radiusSm,
        fontSize: 12,
        fontWeight: 600,
        textDecoration: 'none',
      }

  return (
    <>
      <Link
        href={routeFamily.editorHref(estimateId)}
        style={{
          ...baseStyle,
          border: `1px solid ${C.border}`,
          background: compact ? C.cardDark : 'transparent',
          color: compact ? C.ink : C.ink3,
        }}
      >
        Edit
      </Link>
      <Link
        href={routeFamily.sendHref(estimateId)}
        style={{
          ...baseStyle,
          border: compact ? '1px solid rgba(132,204,147,0.26)' : `1px solid ${C.border}`,
          background: compact ? 'rgba(132,204,147,0.08)' : 'transparent',
          color: compact ? C.green : C.ink2,
        }}
      >
        Send to Client
      </Link>
    </>
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
    const label = textValue(fee, 'access_fee_id') || 'Access fee'
    const qty = numberValue(fee, ['qty']) ?? 1
    const total =
      numberValue(fee, ['effective_total', 'final_total', 'raw_total', 'override_total']) ??
      (numberValue(fee, ['actual_cost_override']) ?? 0) * qty
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

function SendStatusBadge({ sendStatus }: {
  sendStatus: {
    status: string
    sent_at?: string | null
    viewed_at?: string | null
    accepted_at?: string | null
    declined_at?: string | null
    public_url?: string | null
  }
}) {
  const { status, sent_at, viewed_at, accepted_at, declined_at } = sendStatus

  const tone: StatusTone = (() => {
    if (accepted_at) return { border: 'rgba(132,204,147,0.3)', background: 'rgba(132,204,147,0.1)', color: C.green }
    if (declined_at) return { border: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171' }
    if (viewed_at) return { border: 'rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }
    if (sent_at) return { border: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }
    if (status.toLowerCase() === 'draft') return { border: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: C.ink3 }
    return { border: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: C.ink3 }
  })()

  const label = (() => {
    if (accepted_at) return 'Accepted'
    if (declined_at) return 'Declined'
    if (viewed_at) return 'Viewed'
    if (sent_at) return 'Sent'
    return 'Draft'
  })()

  const title = (() => {
    const parts: string[] = []
    if (sent_at) parts.push(`Sent: ${new Date(sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
    if (viewed_at) parts.push(`Viewed: ${new Date(viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
    if (accepted_at) parts.push(`Accepted: ${new Date(accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
    if (declined_at) parts.push(`Declined: ${new Date(declined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
    return parts.join(' | ') || undefined
  })()

  return (
    <span
      title={title}
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        cursor: title ? 'help' : undefined,
      }}
    >
      {label}
    </span>
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
  const {
    data,
    job,
    loading,
    error,
    policySaving,
    jobSettingsVm,
    trimPaintVm,
  } = useEstimateV2SummaryData(estimateId, resolvedRouteFamily)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [openRooms, setOpenRooms] = useState<Record<string, boolean>>({})
  const derived = useEstimateV2SummaryDerived({
    data,
    job,
    jobSettingsDraft: {
      dayhours: jobSettingsVm.draft.dayhours,
      laborRate: jobSettingsVm.draft.laborRate,
    },
  })

  const policySectionId = useId()
  const sharedSections: SharedSectionKey[] = ['alerts', 'pricing', 'paint', 'charges', 'rooms']

  // Customer send / portal status
  const [sendStatus, setSendStatus] = useState<{
    status: string
    sent_at?: string | null
    viewed_at?: string | null
    accepted_at?: string | null
    declined_at?: string | null
    public_url?: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = resolvedRouteFamily.customerSendApiHref(estimateId)
    loadData<{
      version?: { status?: string; sent_at?: string | null; viewed_at?: string | null; accepted_at?: string | null; declined_at?: string | null; public_token?: string | null } | null
      public_url?: string | null
    }>(url).then((res) => {
      if (cancelled) return
      const v = res?.version
      if (v?.status) {
        setSendStatus({
          status: v.status,
          sent_at: v.sent_at,
          viewed_at: v.viewed_at,
          accepted_at: v.accepted_at,
          declined_at: v.declined_at,
          public_url: res?.public_url ?? null,
        })
      }
    }).catch(() => {
      // Silently ignore; send status is non-critical.
    })
    return () => { cancelled = true }
  }, [estimateId, resolvedRouteFamily])

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading quote summary"
        style={{
          minHeight: '100vh',
          background: C.bg,
          color: C.ink3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: C.sans,
        }}
      >
        Loading summary...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        aria-label="Quote summary failed to load"
        style={{
          minHeight: '100vh',
          background: C.bg,
          color: '#fecaca',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: C.sans,
          padding: 24,
          textAlign: 'center',
        }}
      >
        {error?.message ?? 'Something went wrong'}
      </div>
    )
  }

  const renderRoomsSection = (mobile = false) => (
    <section style={mobile ? { display: 'grid', gap: 10 } : { ...card, padding: 0, overflow: 'hidden' }}>
      {mobile ? (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '0 2px' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 }}>
            Room Details
          </div>
          <div style={{ fontSize: 12, color: C.ink3 }}>
            {derived.rooms.length} room{derived.rooms.length === 1 ? '' : 's'}
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderBottom: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 4 }}>
                Room Details
              </div>
              <div style={{ fontSize: 12, color: C.ink3 }}>
                {derived.rooms.length} room{derived.rooms.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(230px, 1.35fr) minmax(170px, 1.05fr) 92px 92px 100px 100px 100px 76px 110px',
              gap: 0,
              padding: '10px 16px',
              borderBottom: `1px solid ${C.border}`,
              background: C.cardDark,
              color: C.ink3,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {['Room', 'Scopes', 'Eff. Sq Ft', 'Labor Hrs', 'Paint $', 'Supplies $', 'Total $', '% of Job', 'Flags'].map((label, index) => (
              <div key={label} style={{ textAlign: index >= 2 ? 'right' : 'left' }}>
                {label}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'grid', gap: mobile ? 10 : 0 }}>
        {derived.roomBlocks.length === 0 ? (
          <div style={mobile ? { ...card, padding: '14px', borderRadius: 16, color: C.ink3, fontSize: 13 } : { padding: '18px 16px', color: C.ink3, fontSize: 13 }}>
            No rooms
          </div>
        ) : (
          derived.roomBlocks.map((block) => (
            <EstimateV2SummaryRoomBlock
              key={block.room.id ?? block.room.room_id}
              block={block}
              open={!!openRooms[block.room.room_id]}
              onToggle={() =>
                setOpenRooms((prev) => ({
                  ...prev,
                  [block.room.room_id]: !prev[block.room.room_id],
                }))
              }
              displayScopePaintCost={derived.displayScopePaintCost}
              cardStyle={card}
              mobile={mobile}
            />
          ))
        )}
        {!mobile && derived.roomBlocks.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(230px, 1.35fr) minmax(170px, 1.05fr) 92px 92px 100px 100px 100px 76px 110px',
              gap: 0,
              padding: '12px 16px',
              borderTop: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.03)',
              color: C.ink,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <div style={{ color: C.ink2 }}>Totals</div>
            <div>{derived.roomBlocks.length} rooms</div>
            <div style={{ textAlign: 'right' }}>
              {fmtNumber(
                derived.roomBlocks.reduce((sum, b) => sum + (b.roomArea ?? 0), 0),
                0
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {fmtH(
                derived.roomBlocks.reduce((sum, b) => sum + b.totals.labor, 0) || null
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {fmtUSD(
                derived.roomBlocks.reduce((sum, b) => sum + b.totals.paint, 0) || null
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {fmtUSD(
                derived.roomBlocks.reduce((sum, b) => sum + b.totals.supplies, 0) || null
              )}
            </div>
            <div style={{ textAlign: 'right', color: C.green }}>
              {fmtUSD(derived.finalTotal)}
            </div>
            <div style={{ textAlign: 'right' }}>100%</div>
            <div />
          </div>
        )}
      </div>
    </section>
  )

  const renderSharedSection = (key: SharedSectionKey, mobile = false) => {
    if (key === 'alerts') {
      return mobile ? (
        <section key={key} style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, padding: '0 2px' }}>
            System Alerts
          </div>
          <EstimateV2SummaryAlerts alerts={derived.summaryAlerts} colors={{ ink: C.ink, ink3: C.inkSub, radiusSm: C.radiusSm }} mobile />
        </section>
      ) : (
        <div key={key} style={card}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 10 }}>
            System Alerts
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <EstimateV2SummaryAlerts alerts={derived.summaryAlerts} colors={{ ink: C.ink, ink3: C.ink3, radiusSm: C.radiusSm }} />
          </div>
        </div>
      )
    }

    if (key === 'pricing') {
      return (
        <EstimateV2SummaryPricingTable
          key={key}
          title="Price Breakdown"
          rows={derived.priceBreakdownRows}
          totalLabel="Final Total"
          totalValue={fmtUSD(derived.finalTotal)}
          colors={{ ink: C.ink, ink2: C.inkSub, ink3: C.ink3, green: C.green, border: C.border, cardDark: C.cardDark, mono: C.mono }}
          cardStyle={card}
          mobile={mobile}
        />
      )
    }

    if (key === 'paint') {
      return (
        <EstimateV2SummaryPricingTable
          key={key}
          title="Paint & Supplies Summary"
          rows={derived.paintSupplyRows}
          totalLabel="Total"
          totalValue={fmtUSD(derived.paintSuppliesTotal)}
          totalPrefix="Total"
          colors={{ ink: C.ink, ink2: C.inkSub, ink3: C.ink3, green: C.green, border: C.border, cardDark: C.cardDark, mono: C.mono }}
          cardStyle={card}
          mobile={mobile}
        />
      )
    }

    if (key === 'charges') {
      const accessFees = data?.inputs?.access_fees ?? []
      const otherCharges = data?.inputs?.other ?? []
      const hasCharges = accessFees.length > 0 || otherCharges.length > 0

      if (!hasCharges) return null

      const chargeRows = buildChargeRows(accessFees, otherCharges)
      const total = chargeRows.reduce((sum, row) => sum + row.total, 0)

      return (
        <EstimateV2SummaryPricingTable
          key={key}
          title="Access Fees & Other Charges"
          rows={chargeRows}
          totalLabel="Total Charges"
          totalValue={fmtUSD(total || null)}
          totalPrefix="Total"
          colors={{ ink: C.ink, ink2: C.inkSub, ink3: C.ink3, green: C.green, border: C.border, cardDark: C.cardDark, mono: C.mono }}
          cardStyle={card}
          mobile={mobile}
        />
      )
    }

    return <div key={key}>{renderRoomsSection(mobile)}</div>
  }

  const policyContent = (
    <>
      {policySaving && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Saving summary policy changes"
          style={{
            padding: '6px 10px',
            borderRadius: C.radiusSm,
            background: 'rgba(132,204,147,0.08)',
            border: '1px solid rgba(132,204,147,0.2)',
            fontSize: 11,
            color: C.green,
            textAlign: 'center',
          }}
        >
          Saving...
        </div>
      )}

      <EstimateV2SummaryPolicyControls
        vm={jobSettingsVm}
        card={card}
        inputStyle={inputStyle}
        colors={{ border: C.border, ink3: C.ink3, green: C.green, cardDark: C.cardDark }}
        open={policyOpen}
        onToggleOpen={() => setPolicyOpen((open) => !open)}
        compact
      />

      <EstimateV2SummaryTrimPaintPanel
        vm={trimPaintVm}
        trimPaint={derived.trimPaint}
        hasTrimPaint={derived.hasTrimPaint}
        resolvePaintProductLabel={derived.resolvePaintProductLabel}
        card={card}
        inputStyle={inputStyle}
        colors={{ ink: C.ink, ink3: C.ink3, green: C.green, cardDark: C.cardDark, border: C.border, radiusSm: C.radiusSm }}
      />
    </>
  )

  return (
    <>
      <div
        className="ace-v2-mobile-only"
        style={{
          minHeight: '100vh',
          background: C.bg,
          color: C.ink,
          fontFamily: C.sans,
          padding: '12px 14px 96px',
          display: 'grid',
          gap: 12,
          overflowX: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '2px 2px 0',
          }}
        >
          <Link
            href={resolvedRouteFamily.listHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: C.ink3,
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
              &larr;
            </span>
              <span>Back to Quotes</span>
          </Link>
          <SummaryStatusBadge statusLabel={derived.statusLabel} />
          {sendStatus && (
            <SendStatusBadge sendStatus={sendStatus} />
          )}
          <span
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.04)',
              color: C.ink2,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            Crew: {derived.crewSize}
          </span>
        </header>

        <main style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <section style={{ ...card, padding: '16px', borderRadius: 16, display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.ink3 }}>
              {pageEyebrow}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {job?.title && (
                <div style={{ color: C.ink2, fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
                  {job.title}
                </div>
              )}
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.02, letterSpacing: '-0.04em', fontWeight: 900, color: C.ink }}>
                {derived.versionName}
              </h1>
              {(job?.customer_name || job?.customer_address || job?.customer_email || job?.customer_phone) && (
                <div style={{ color: C.inkSub, fontSize: 14, lineHeight: 1.35 }}>
                  {[job?.customer_name, job?.customer_address].filter(Boolean).join(' | ')}
                  {(job?.customer_email || job?.customer_phone) && (
                    <>
                      <br />
                      {[job?.customer_email, job?.customer_phone].filter(Boolean).join(' | ')}
                    </>
                  )}
                </div>
              )}
              {data?.estimate?.updated_at && (
                <div style={{ color: C.ink3, fontSize: 11, lineHeight: 1.4, marginTop: 2 }}>
                  Last updated: {new Date(data.estimate.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </section>

          <EstimateV2SummaryKPIRail
            pricingKpis={derived.pricingKpis}
            finalTotal={derived.finalTotal}
            laborShare={derived.laborShare}
            colors={{ cardStyle: card, ink: C.ink, ink3: C.ink3, green: C.green, mono: C.mono }}
            mobile
          />

          {sharedSections.map((section) => renderSharedSection(section, true))}

          <section style={{ ...card, padding: 0, borderRadius: 16, overflow: 'hidden' }}>
            <button
              type="button"
              aria-expanded={policyOpen}
              aria-controls={policySectionId}
              onClick={() => setPolicyOpen((next) => !next)}
              style={{
                width: '100%',
                listStyle: 'none',
                cursor: 'pointer',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                color: C.ink,
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 4 }}>
                  More
                </div>
                <div style={{ fontSize: 13, color: C.ink3 }}>Policy inputs and secondary actions</div>
              </div>
              <span style={{ color: C.ink3, fontSize: 14, fontWeight: 700 }}>{policyOpen ? 'Hide' : 'Show'}</span>
            </button>

            {policyOpen && (
              <div id={policySectionId} style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px 16px', display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <EstimateV2SummaryPolicyControls
                    vm={jobSettingsVm}
                    card={card}
                    inputStyle={inputStyle}
                    colors={{ border: C.border, ink3: C.ink3, green: C.green, cardDark: C.cardDark }}
                    open
                  />

                  <EstimateV2SummaryTrimPaintPanel
                    vm={trimPaintVm}
                    trimPaint={derived.trimPaint}
                    hasTrimPaint={derived.hasTrimPaint}
                    resolvePaintProductLabel={derived.resolvePaintProductLabel}
                    card={card}
                    inputStyle={inputStyle}
                    colors={{ ink: C.ink, ink3: C.ink3, green: C.green, cardDark: C.cardDark, border: C.border, radiusSm: C.radiusSm }}
                  />

                  <div style={{ display: 'grid', gap: 10 }}>
                    {policySaving && (
                      <div
                        role="status"
                        aria-live="polite"
                        aria-label="Saving summary policy changes"
                        style={{
                          padding: '6px 10px',
                          borderRadius: C.radiusSm,
                          background: 'rgba(132,204,147,0.08)',
                          border: '1px solid rgba(132,204,147,0.2)',
                          fontSize: 11,
                          color: C.green,
                          textAlign: 'center',
                        }}
                      >
                        Saving...
                      </div>
                    )}
                    <SummaryActionLinks estimateId={estimateId} routeFamily={resolvedRouteFamily} compact />
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      <div className="ace-v2-desktop-only" style={shellStyle}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            minHeight: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 22px',
            background: 'rgba(10,10,10,0.94)',
            backdropFilter: 'blur(18px)',
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Link
              href={resolvedRouteFamily.listHref}
              style={{ fontSize: 12, color: C.ink3, textDecoration: 'none', flexShrink: 0 }}
            >
              Back to Quotes
            </Link>
            <span style={{ color: C.border }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{derived.versionName}</span>
            {job?.customer_name && (
              <>
                <span style={{ color: C.border }}>/</span>
                <span style={{ fontSize: 12, color: C.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.customer_name}
                </span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <SummaryStatusBadge statusLabel={derived.statusLabel} />
            {sendStatus && (
              <SendStatusBadge sendStatus={sendStatus} />
            )}
            <span
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.04)',
                color: C.ink2,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Crew: {derived.crewSize}
            </span>
            <SummaryActionLinks estimateId={estimateId} routeFamily={resolvedRouteFamily} />
          </div>
        </header>

        <div style={contentShellStyle}>
          <main style={mainColStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.ink3 }}>
                {pageEyebrow}
              </div>
              {job?.title && (
                <div style={{ color: C.ink2, fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
                  {job.title}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: C.ink }}>{derived.versionName}</h2>
                {(job?.customer_name || job?.customer_address || job?.customer_email || job?.customer_phone) && (
                  <div style={{ color: C.inkSub, fontSize: 13 }}>
                    {[job?.customer_name, job?.customer_address].filter(Boolean).join(' | ')}
                    {(job?.customer_email || job?.customer_phone) && (
                      <>
                        <br />
                        {[job?.customer_email, job?.customer_phone].filter(Boolean).join(' | ')}
                      </>
                    )}
                  </div>
                )}
              </div>
              {data?.estimate?.updated_at && (
                <div style={{ color: C.ink3, fontSize: 11, lineHeight: 1.4 }}>
                  Last updated: {new Date(data.estimate.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>

            <EstimateV2SummaryKPIRail
              pricingKpis={derived.pricingKpis}
              finalTotal={derived.finalTotal}
              laborShare={derived.laborShare}
              colors={{ cardStyle: card, ink: C.ink, ink3: C.ink3, green: C.green, mono: C.mono }}
            />

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
              {sharedSections.slice(0, 3).map((section) => renderSharedSection(section))}
            </section>

            {renderSharedSection('charges')}

            {renderSharedSection('rooms')}
          </main>

          <aside style={utilityRailStyle}>{policyContent}</aside>
        </div>
      </div>
    </>
  )
}
