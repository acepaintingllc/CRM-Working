import type { CSSProperties } from 'react'

export type EstimateV2EditorPageStyles = {
  page: CSSProperties
  header: CSSProperties
  mono: CSSProperties
  shell: CSSProperties
  panel: CSSProperties
  input: CSSProperties
  textarea: CSSProperties
  label: CSSProperties
  button: CSSProperties
  buttonPrimary: CSSProperties
  computedBig: CSSProperties
  stepper: CSSProperties
  stepperBtn: CSSProperties
  stepperVal: CSSProperties
  flagChip: CSSProperties
  scopePill: CSSProperties
  footer: CSSProperties
}

export type EstimateV2SharedStyles = Pick<
  EstimateV2EditorPageStyles,
  'label' | 'mono' | 'panel'
>

export const estimateV2EditorPageStyles: EstimateV2EditorPageStyles = {
  page: {
    display: 'block',
    minHeight: '100vh',
    background: 'var(--v2-bg)',
    color: 'var(--v2-ink)',
  },
  header: {
    position: 'static',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 18px',
    borderBottom: '1px solid var(--v2-line)',
    background: 'rgba(8,8,8,0.94)',
    backdropFilter: 'blur(10px)',
  },
  mono: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(9px + 4pt)',
    letterSpacing: '0.11em',
    textTransform: 'uppercase',
    color: 'var(--v2-ink-3)',
  },
  shell: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: 16,
    padding: 16,
    minWidth: 0,
  },
  panel: {
    border: '1px solid var(--v2-line)',
    borderRadius: 14,
    background: 'var(--v2-bg-2)',
    padding: 10,
  },
  input: {
    width: '100%',
    padding: '7px 9px',
    minHeight: 34,
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(12px + 4pt)',
  },
  textarea: {
    width: '100%',
    minHeight: 70,
    padding: '7px 9px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(12px + 4pt)',
    resize: 'vertical',
  },
  label: {
    display: 'grid',
    gap: 3,
  },
  button: {
    padding: '7px 9px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(11px + 4pt)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  buttonPrimary: {
    padding: '8px 11px',
    borderRadius: 9,
    border: '1px solid rgba(134,239,172,0.36)',
    background: '#8ad39b',
    color: '#062410',
    fontSize: 'calc(12px + 4pt)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  computedBig: {
    fontSize: 'calc(24px + 4pt)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: 'var(--v2-ink)',
    lineHeight: 1,
    marginTop: 4,
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--v2-line)',
    borderRadius: 9,
    background: '#111111',
    overflow: 'hidden',
    height: 34,
  },
  stepperBtn: {
    width: 28,
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: 'var(--v2-ink)',
    fontSize: 'calc(15px + 4pt)',
    fontWeight: 300,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepperVal: {
    flex: 1,
    textAlign: 'center',
    fontSize: 'calc(12px + 4pt)',
    fontWeight: 700,
    color: 'var(--v2-ink)',
    pointerEvents: 'none',
  },
  flagChip: {
    padding: '6px 8px',
    borderRadius: 9,
    border: '1px solid var(--v2-line)',
    background: '#0d0d0d',
    color: 'var(--v2-ink-2)',
    fontSize: 'calc(11px + 4pt)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
    width: '100%',
  },
  scopePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    borderRadius: 20,
    fontSize: 'calc(10px + 4pt)',
    fontWeight: 600,
    border: '1px solid var(--v2-line)',
  },
  footer: {
    position: 'sticky',
    bottom: 0,
    zIndex: 20,
    borderTop: '1px solid var(--v2-line)',
    background: 'rgba(8,8,8,0.96)',
    backdropFilter: 'blur(10px)',
    padding: '7px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
}
