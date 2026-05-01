import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

const footerStyle: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  zIndex: 40,
  borderTop: '1px solid var(--v2-line, #262626)',
  background: 'rgba(8,8,8,0.96)',
  backdropFilter: 'blur(10px)',
  padding: '8px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  boxSizing: 'border-box',
  width: '100%',
}

const monoStyle: CSSProperties = {
  fontFamily: 'var(--v2-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--v2-ink-3, #7a7a7a)',
  fontWeight: 800,
}

const valueStyle: CSSProperties = {
  color: 'var(--v2-ink, #f5f5f5)',
  fontSize: 26,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
  marginTop: 4,
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
}

const buttonBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '7px 11px',
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 800,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: '1px solid var(--v2-line, #262626)',
  background: '#111111',
  color: 'var(--v2-ink, #f5f5f5)',
}

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: '1px solid rgba(134,239,172,0.36)',
  background: '#8ad39b',
  color: '#062410',
}

const disabledActionStyle: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
}

export type EstimateV2WorkflowFooterMetric = {
  label: string
  value: ReactNode
}

export function EstimateV2WorkflowFooterBar({
  label,
  value,
  metrics,
  status,
  backAction,
  secondaryAction,
  primaryAction,
}: {
  label: string
  value: ReactNode
  metrics?: EstimateV2WorkflowFooterMetric[]
  status?: ReactNode
  backAction?:
    | {
        type: 'button'
        label: ReactNode
        onClick: () => void
        disabled?: boolean
      }
    | {
        type: 'link'
        label: ReactNode
        href: string
      }
  secondaryAction?: {
    label: ReactNode
    onClick: () => void
    disabled?: boolean
  }
  primaryAction:
    | {
        type: 'button'
        label: ReactNode
        onClick: () => void
        disabled?: boolean
        title?: string
      }
    | {
        type: 'link'
        label: ReactNode
        href: string
      }
}) {
  const primaryDisabled = primaryAction.type === 'button' && primaryAction.disabled

  return (
    <div className="estimate-v2-workflow-footer" style={footerStyle}>
      <div style={{ minWidth: 0 }}>
        <div style={monoStyle}>{label}</div>
        <div style={valueStyle}>{value}</div>
        {metrics?.length ? (
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 6,
              color: 'var(--v2-ink-3, #7a7a7a)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {metrics.map((metric) => (
              <span key={metric.label}>
                {metric.label}: <span style={{ color: 'var(--v2-ink-2, #c5c5c5)' }}>{metric.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div style={actionsStyle}>
        {backAction ? (
          backAction.type === 'link' ? (
            <Link className="v2-btn" href={backAction.href} style={secondaryButtonStyle}>
              {backAction.label}
            </Link>
          ) : (
            <button
              type="button"
              className="v2-btn"
              onClick={backAction.onClick}
              disabled={backAction.disabled}
              style={{
                ...secondaryButtonStyle,
                ...(backAction.disabled ? disabledActionStyle : { cursor: 'pointer' }),
              }}
            >
              {backAction.label}
            </button>
          )
        ) : null}
        {status ? <div style={{ color: 'var(--v2-ink-3, #7a7a7a)', fontSize: 13, fontWeight: 700 }}>{status}</div> : null}
        {secondaryAction ? (
          <button
            type="button"
            className="v2-btn"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            style={{
              ...secondaryButtonStyle,
              ...(secondaryAction.disabled ? disabledActionStyle : { cursor: 'pointer' }),
            }}
          >
            {secondaryAction.label}
          </button>
        ) : null}
        {primaryAction.type === 'link' ? (
          <Link className="v2-btn-primary" href={primaryAction.href} style={primaryButtonStyle}>
            {primaryAction.label}
          </Link>
        ) : (
          <button
            type="button"
            className="v2-btn-primary"
            onClick={primaryAction.onClick}
            disabled={primaryDisabled}
            aria-disabled={primaryDisabled}
            title={primaryAction.title}
            style={{
              ...primaryButtonStyle,
              ...(primaryDisabled ? disabledActionStyle : { cursor: 'pointer' }),
            }}
          >
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}
