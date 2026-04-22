'use client'

import type { CSSProperties } from 'react'
import { fmtH, fmtNumber, fmtUSD } from '../_lib/estimateV2SummaryFormat'
import type { EstimateV2SummaryScopeRowVm } from '../_lib/useEstimateV2SummaryDerived'

type Colors = {
  ink: string
  ink3: string
  border: string
  cardDark: string
  mono: string
}

export function EstimateV2SummaryScopeRow({
  scope,
  displaySubtotal,
  derivedPaint,
  colors,
  mobile = false,
}: {
  scope: EstimateV2SummaryScopeRowVm
  displaySubtotal: number | null
  derivedPaint: number | null
  colors: Colors
  mobile?: boolean
}) {
  const qtyUnit = scope.kind === 'trim' ? 'lf' : 'sf'

  if (mobile) {
    return (
      <div style={{ display: 'grid', gap: 6, padding: '10px 0', borderBottom: `1px solid rgba(38,38,38,0.55)` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scope.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 11, color: colors.ink3, lineHeight: 1.35 }}>
              {scopeKindLabel(scope.kind)}
              {scope.quantity != null ? ` · ${fmtNumber(scope.quantity, scope.kind === 'trim' ? 1 : 0)} ${qtyUnit}` : ''}
              {scope.laborHours != null ? ` · ${fmtH(scope.laborHours)}` : ''}
            </div>
          </div>
          <div style={mobileSubtotalStyle(colors)}>{fmtUSD(displaySubtotal ?? scope.subtotal)}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', color: colors.ink3, fontSize: 11 }}>
          <span>Subtotal</span>
          <span>{fmtUSD(displaySubtotal ?? scope.subtotal)}</span>
          {derivedPaint != null && <span>Paint {fmtUSD(derivedPaint)}</span>}
          {scope.suppliesCost != null && <span>Supplies {fmtUSD(scope.suppliesCost)}</span>}
          {scope.hasOverride && (
            <span style={{ color: '#fbbf24', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Override
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 1.6fr) 110px 92px 100px 100px 100px',
        gap: 0,
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: `1px solid rgba(38,38,38,0.5)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={scopeKindBadge(colors)}>{scopeKindLabel(scope.kind)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {scope.label}
        </span>
        {scope.hasOverride && (
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Override
          </span>
        )}
      </div>
      <div style={desktopCellStyle(colors)}>
        {scope.quantity == null ? '-' : `${fmtNumber(scope.quantity, scope.kind === 'trim' ? 1 : 0)} ${qtyUnit}`}
      </div>
      <div style={desktopCellStyle(colors)}>{fmtH(scope.laborHours)}</div>
      <div style={desktopCellStyle(colors)}>{fmtUSD(derivedPaint)}</div>
      <div style={desktopCellStyle(colors)}>{fmtUSD(scope.suppliesCost)}</div>
      <div style={{ ...desktopCellStyle(colors), fontWeight: 800 }}>{fmtUSD(displaySubtotal ?? scope.subtotal)}</div>
    </div>
  )
}

function scopeKindLabel(kind: EstimateV2SummaryScopeRowVm['kind']) {
  if (kind === 'walls') return 'Walls'
  if (kind === 'ceilings') return 'Ceilings'
  return 'Trim'
}

function mobileSubtotalStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 14,
    fontWeight: 900,
    color: colors.ink,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }
}

function desktopCellStyle(colors: Colors): CSSProperties {
  return {
    textAlign: 'right',
    fontFamily: colors.mono,
    fontVariantNumeric: 'tabular-nums',
  }
}

function scopeKindBadge(colors: Colors): CSSProperties {
  return {
    padding: '2px 6px',
    borderRadius: 4,
    background: colors.cardDark,
    border: `1px solid ${colors.border}`,
    color: colors.ink3,
    fontSize: 10,
    fontWeight: 800,
  }
}
