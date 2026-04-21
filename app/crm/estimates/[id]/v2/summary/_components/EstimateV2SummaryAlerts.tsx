'use client'
import type { EstimateV2SummaryAlert } from '../_lib/useEstimateV2SummaryDerived'

type Colors = {
  ink: string
  ink3: string
  radiusSm: number
}

export function EstimateV2SummaryAlerts({
  alerts,
  colors,
  mobile = false,
}: {
  alerts: EstimateV2SummaryAlert[]
  colors: Colors
  mobile?: boolean
}) {
  return (
    <>
      {alerts.map((alert) => {
        const theme = getAlertTheme(alert.kind)
        return (
          <div
            key={`${alert.title}:${alert.detail}`}
            style={{
              display: 'flex',
              gap: 10,
              padding: mobile ? '13px 14px' : '10px 12px',
              borderRadius: mobile ? 14 : colors.radiusSm,
              border: `1px solid ${theme.border}`,
              background: theme.fill,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 4,
                alignSelf: 'stretch',
                borderRadius: 999,
                background: theme.accent,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, display: 'grid', gap: mobile ? 2 : 0 }}>
              <div
                style={{
                  fontSize: mobile ? 12 : 12,
                  fontWeight: 800,
                  color: colors.ink,
                  marginBottom: mobile ? 0 : 2,
                }}
              >
                {alert.title}
              </div>
              <div
                style={{
                  fontSize: mobile ? 12 : 11,
                  color: colors.ink3,
                  lineHeight: mobile ? 1.4 : 1.35,
                }}
              >
                {alert.detail}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function getAlertTheme(kind: EstimateV2SummaryAlert['kind']): {
  border: string
  fill: string
  accent: string
} {
  if (kind === 'error') {
    return {
      border: 'rgba(248,113,113,0.34)',
      fill: 'rgba(248,113,113,0.08)',
      accent: '#fca5a5',
    }
  }
  if (kind === 'warn') {
    return {
      border: 'rgba(250,204,21,0.28)',
      fill: 'rgba(250,204,21,0.06)',
      accent: '#fbbf24',
    }
  }
  return {
    border: 'rgba(96,165,250,0.26)',
    fill: 'rgba(96,165,250,0.06)',
    accent: '#93c5fd',
  }
}
