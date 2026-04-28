'use client'

import type { CSSProperties } from 'react'
import { fmtD, fmtH, fmtUSD } from '../_lib/estimateV2SummaryFormat'
import type { EstimateV2SummaryPricingKpis } from '../_lib/useEstimateV2SummaryDerived'

type Colors = {
  cardStyle: CSSProperties
  ink: string
  ink3: string
  green: string
  mono: string
}

export function EstimateV2SummaryKPIRail({
  pricingKpis,
  finalTotal,
  laborShare,
  colors,
  mobile = false,
}: {
  pricingKpis: EstimateV2SummaryPricingKpis
  finalTotal: number | null
  laborShare: number | null
  colors: Colors
  mobile?: boolean
}) {
  if (mobile) {
    return (
      <section
        style={{
          ...colors.cardStyle,
          padding: '16px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, rgba(28,28,28,0.98), rgba(18,18,18,0.98))',
          borderColor: 'rgba(132,204,147,0.2)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <div>
            <div style={kpiTitleStyle(colors.ink3)}>Final Total</div>
            <div style={{ ...mobilePrimaryValueStyle(colors), color: colors.green }}>
              {fmtUSD(finalTotal)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={kpiTitleStyle(colors.ink3)}>Labor Hours</div>
            <div style={mobileSecondaryValueStyle(colors)}>{fmtH(pricingKpis.laborHours)}</div>
            {pricingKpis.rawLaborHours != null && pricingKpis.rawLaborHours !== pricingKpis.laborHours && (
              <div style={{ fontSize: 10, color: colors.ink3, marginTop: 2 }}>
                Raw: {fmtH(pricingKpis.rawLaborHours)}
              </div>
            )}
          </div>
          <div>
            <div style={kpiTitleStyle(colors.ink3)}>Labor Cost</div>
            <div style={mobileCostStyle(colors)}>{fmtUSD(pricingKpis.laborCost)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={kpiTitleStyle(colors.ink3)}>Supplies Cost</div>
            <div style={mobileCostStyle(colors)}>{fmtUSD(pricingKpis.suppliesCost)}</div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid #262626',
            color: '#b0b0b0',
            fontSize: 12,
            lineHeight: 1.35,
          }}
        >
          <div>
            {pricingKpis.rooms} room{pricingKpis.rooms === 1 ? '' : 's'}
          </div>
          <div>{laborShare != null ? `${fmtUSD(laborShare)} / Labor Hr` : '- / Labor Hr'}</div>
        </div>
      </section>
    )
  }

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr repeat(5, minmax(0, 1fr))',
        gap: 12,
      }}
    >
      <div
        style={{
          ...colors.cardStyle,
          background: 'linear-gradient(180deg, rgba(28,28,28,0.96), rgba(20,20,20,0.96))',
          borderColor: 'rgba(132,204,147,0.26)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ ...kpiTitleStyle(colors.ink3), marginBottom: 8 }}>Final Total</div>
        <div style={{ ...desktopPrimaryValueStyle(colors), color: colors.green }}>{fmtUSD(finalTotal)}</div>
      </div>
      {[
        {
          label: 'Labor Hours',
          value: fmtH(pricingKpis.laborHours),
          secondary: pricingKpis.rawLaborHours != null && pricingKpis.rawLaborHours !== pricingKpis.laborHours
            ? `Raw: ${fmtH(pricingKpis.rawLaborHours)}`
            : null,
        },
        {
          label: 'Days',
          value: fmtD(pricingKpis.laborDays),
          secondary: pricingKpis.rawLaborDays != null && pricingKpis.rawLaborDays !== pricingKpis.laborDays
            ? `Raw: ${fmtD(pricingKpis.rawLaborDays)}`
            : null,
        },
        { label: 'Labor Cost', value: fmtUSD(pricingKpis.laborCost), secondary: null },
        { label: 'Supplies Cost', value: fmtUSD(pricingKpis.suppliesCost), secondary: null },
        { label: 'Rooms', value: String(pricingKpis.rooms), secondary: null },
      ].map((item) => (
        <div key={item.label} style={colors.cardStyle}>
          <div style={{ ...kpiTitleStyle(colors.ink3), marginBottom: 8 }}>{item.label}</div>
          <div style={desktopMetricValueStyle(colors)}>{item.value}</div>
          {item.secondary && (
            <div style={{ fontSize: 10, color: colors.ink3, marginTop: 4 }}>{item.secondary}</div>
          )}
        </div>
      ))}
    </section>
  )
}

function kpiTitleStyle(ink3: string): CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: ink3,
  }
}

function mobilePrimaryValueStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  }
}

function mobileSecondaryValueStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 900,
    color: colors.ink,
    fontVariantNumeric: 'tabular-nums',
  }
}

function mobileCostStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 20,
    lineHeight: 1.1,
    fontWeight: 800,
    color: colors.ink,
    fontVariantNumeric: 'tabular-nums',
  }
}

function desktopPrimaryValueStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  }
}

function desktopMetricValueStyle(colors: Colors): CSSProperties {
  return {
    fontFamily: colors.mono,
    fontSize: 18,
    fontWeight: 800,
    color: colors.ink,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  }
}
