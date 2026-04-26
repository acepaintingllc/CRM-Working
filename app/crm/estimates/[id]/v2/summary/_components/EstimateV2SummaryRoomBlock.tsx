'use client'

import type { CSSProperties } from 'react'
import { fmtH, fmtNumber, fmtPct, fmtUSD } from '../_lib/estimateV2SummaryFormat'
import type { EstimateV2SummaryRoomBlockVm } from '../_lib/useEstimateV2SummaryDerived'
import { EstimateV2SummaryScopeRow } from './EstimateV2SummaryScopeRow'

type Colors = {
  ink: string
  ink2: string
  ink3: string
  green: string
  border: string
  card: string
  cardDark: string
  mono: string
}

export function EstimateV2SummaryRoomBlock({
  block,
  open,
  onToggle,
  displayScopePaintCost,
  cardStyle,
  mobile = false,
}: {
  block: EstimateV2SummaryRoomBlockVm
  open: boolean
  onToggle: () => void
  displayScopePaintCost: (scope: EstimateV2SummaryRoomBlockVm['scopeRows'][number]) => number | null
  cardStyle: CSSProperties
  mobile?: boolean
}) {
  const colors: Colors = {
    ink: '#f5f5f5',
    ink2: '#c5c5c5',
    ink3: '#9a9a9a',
    green: '#84cc93',
    border: '#262626',
    card: '#1a1a1a',
    cardDark: '#131313',
    mono: "'JetBrains Mono', ui-monospace, monospace",
  }
  const panelId = `estimate-v2-summary-room-panel-${block.room.room_id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const buttonLabel = `${block.room.room_name ?? block.room.room_id} room details`
  const conditionBadges = block.conditionBadges ?? []

  if (mobile) {
    return (
      <div style={{ ...cardStyle, padding: 0, borderRadius: 16, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={buttonLabel}
          style={{
            width: '100%',
            border: 'none',
            background: open ? 'rgba(255,255,255,0.03)' : 'transparent',
            color: colors.ink,
            cursor: 'pointer',
            textAlign: 'left',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ color: colors.ink3, fontSize: 12, flexShrink: 0 }}>{open ? 'v' : '>'}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {block.room.room_name ?? block.room.room_id}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {block.scopes.length > 0 ? (
                  block.scopes.map((scope) => (
                    <span key={scope} style={scopeChipStyle(colors)}>
                      {scope}
                    </span>
                  ))
                ) : (
                  <span style={{ color: colors.ink3, fontSize: 12 }}>No scopes</span>
                )}
              </div>
            </div>
            <div style={{ ...roomTotalStyle(colors), color: (block.roomTotal ?? 0) > 0 ? colors.green : colors.ink }}>
              {fmtUSD(block.roomTotal)}
            </div>
          </div>
        </button>

        {open && (
          <div
            id={panelId}
            style={{ borderTop: `1px solid ${colors.border}`, background: 'rgba(255,255,255,0.015)', padding: '12px 14px 14px', display: 'grid', gap: 10 }}
          >
            {conditionBadges.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {conditionBadges.map((label) => (
                  <span
                    key={label}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(251,191,36,0.12)',
                      color: '#fbbf24',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
            {block.scopeRows.length === 0 ? (
              <div style={{ color: colors.ink3, fontSize: 13 }}>No scoped items</div>
            ) : (
              block.scopeRows.map((scope) => (
                <EstimateV2SummaryScopeRow
                  key={scope.id}
                  scope={scope}
                  displaySubtotal={block.displayScopeSubtotalMap.get(scope.id) ?? scope.subtotal}
                  derivedPaint={displayScopePaintCost(scope)}
                  colors={colors}
                  mobile
                />
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ borderBottom: `1px solid ${colors.border}` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={buttonLabel}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns:
            'minmax(230px, 1.35fr) minmax(170px, 1.05fr) 92px 92px 100px 100px 100px 76px 110px',
          gap: 0,
          alignItems: 'center',
          padding: '14px 16px',
          background: open ? 'rgba(255,255,255,0.03)' : 'transparent',
          border: 'none',
          borderTop: 'none',
          color: colors.ink,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ color: colors.ink3, fontSize: 12, flexShrink: 0 }}>{open ? 'v' : '>'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {block.room.room_name ?? block.room.room_id}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
          {block.scopes.length > 0 ? (
            block.scopes.map((scope) => (
              <span key={scope} style={desktopScopeChipStyle(colors)}>
                {scope}
              </span>
            ))
          ) : (
            <span style={{ color: colors.ink3, fontSize: 12 }}>None</span>
          )}
        </div>
        <div style={desktopMetricStyle(colors)}>{fmtNumber(block.roomArea, 0)}</div>
        <div style={desktopMetricStyle(colors)}>{fmtH(block.totals.labor)}</div>
        <div style={desktopMetricStyle(colors)}>{fmtUSD(block.totals.paint)}</div>
        <div style={desktopMetricStyle(colors)}>{fmtUSD(block.totals.supplies)}</div>
        <div style={{ ...desktopMetricStyle(colors), fontWeight: 900, color: (block.roomTotal ?? 0) > 0 ? colors.green : colors.ink }}>
          {fmtUSD(block.roomTotal)}
        </div>
        <div style={desktopMetricStyle(colors)}>{fmtPct(block.roomPct)}</div>
        <div
          style={{
            textAlign: 'right',
            fontSize: 11,
            color:
              block.alerts.missingProduct || block.alerts.overrides || block.alerts.flags
                ? '#fbbf24'
                : colors.ink3,
            fontWeight: 700,
          }}
        >
          {block.flagsLabel}
        </div>
      </button>

      {open && (
        <div id={panelId} style={{ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${colors.border}` }}>
          {conditionBadges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px 16px', borderBottom: `1px solid ${colors.border}` }}>
              {conditionBadges.map((label) => (
                <span
                  key={label}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(251,191,36,0.12)',
                    color: '#fbbf24',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 1.6fr) 110px 92px 100px 100px 100px',
              gap: 0,
              padding: '10px 16px',
              borderBottom: `1px solid ${colors.border}`,
              color: colors.ink3,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            {['Scope', 'Qty / SF', 'Labor Hrs', 'Paint $', 'Supplies $', 'Subtotal'].map((label, index) => (
              <div key={label} style={{ textAlign: index === 0 ? 'left' : 'right' }}>
                {label}
              </div>
            ))}
          </div>
          {block.scopeRows.map((scope) => (
            <EstimateV2SummaryScopeRow
              key={scope.id}
              scope={scope}
              displaySubtotal={block.displayScopeSubtotalMap.get(scope.id) ?? scope.subtotal}
              derivedPaint={displayScopePaintCost(scope)}
              colors={colors}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function scopeChipStyle(colors: Colors): CSSProperties {
  return {
    padding: '4px 8px',
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
    background: colors.cardDark,
    color: colors.ink2,
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }
}

function roomTotalStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 18,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }
}

function desktopScopeChipStyle(colors: Colors): CSSProperties {
  return {
    padding: '3px 7px',
    borderRadius: 4,
    border: `1px solid ${colors.border}`,
    background: colors.cardDark,
    color: colors.ink2,
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }
}

function desktopMetricStyle(colors: Colors): CSSProperties {
  return {
    textAlign: 'right',
    fontFamily: colors.mono,
    fontVariantNumeric: 'tabular-nums',
  }
}
