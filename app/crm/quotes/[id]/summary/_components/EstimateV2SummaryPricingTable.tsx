'use client'

import type { CSSProperties } from 'react'

type Colors = {
  ink: string
  ink2: string
  ink3: string
  green: string
  border: string
  cardDark: string
  mono: string
}

type Row = {
  label: string
  value: string
}

export function EstimateV2SummaryPricingTable({
  title,
  rows,
  totalLabel,
  totalValue,
  colors,
  cardStyle,
  mobile = false,
  totalPrefix,
}: {
  title: string
  rows: Row[]
  totalLabel: string
  totalValue: string
  colors: Colors
  cardStyle: CSSProperties
  mobile?: boolean
  totalPrefix?: string
}) {
  if (mobile) {
    return (
      <section
        style={{
          ...cardStyle,
          padding: '16px',
          borderRadius: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={titleStyle}>{title}</div>
          {totalPrefix ? (
            <div style={{ fontSize: 13, fontWeight: 800, color: colors.ink, whiteSpace: 'nowrap' }}>
              {totalPrefix}: {totalValue}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: colors.ink2, lineHeight: 1.35 }}>{row.label}</span>
              <span style={mobileValueStyle(colors)}>{row.value}</span>
            </div>
          ))}
        </div>
        {!totalPrefix ? (
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={totalLabelStyle}>{totalLabel}</span>
            <span style={{ ...mobileTotalValueStyle(colors), color: colors.green }}>{totalValue}</span>
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ ...titleStyle, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'baseline',
              paddingBottom: title === 'Price Breakdown' ? 8 : 0,
              borderBottom: title === 'Price Breakdown' ? `1px solid ${colors.border}` : 'none',
            }}
          >
            <span style={{ fontSize: 12, color: colors.ink2, lineHeight: 1.25 }}>{row.label}</span>
            <span style={desktopValueStyle(colors)}>{row.value}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginTop: 12,
          paddingTop: title === 'Paint & Supplies Summary' ? 12 : 0,
          borderTop: title === 'Paint & Supplies Summary' ? `1px solid ${colors.border}` : 'none',
        }}
      >
        <span style={totalLabelStyle}>{totalPrefix ? totalPrefix : totalLabel}</span>
        <span
          style={{
            ...(title === 'Paint & Supplies Summary'
              ? { ...desktopPaintTotalStyle(colors), color: colors.ink }
              : { ...desktopFinalTotalStyle(colors), color: colors.green }),
          }}
        >
          {totalValue}
        </span>
      </div>
    </div>
  )
}

const titleStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#9a9a9a',
}

const totalLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#9a9a9a',
}

function mobileValueStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 14,
    fontWeight: 800,
    color: colors.ink,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }
}

function mobileTotalValueStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 24,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }
}

function desktopValueStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 13,
    fontWeight: 800,
    color: colors.ink,
    fontVariantNumeric: 'tabular-nums',
  }
}

function desktopFinalTotalStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 22,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  }
}

function desktopPaintTotalStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 18,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  }
}
