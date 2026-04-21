'use client'

import type { ReactNode } from 'react'
import { Component } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class EstimateV2ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Estimate V2 editor render crashed', {
      operation: 'render',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const titleId = 'estimate-v2-error-boundary-title'
    const descriptionId = 'estimate-v2-error-boundary-description'

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--v2-bg, #080808)',
          color: 'var(--v2-ink, #f5f5f5)',
          padding: 24,
        }}
      >
        <div
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-modal="false"
          style={{
            maxWidth: 420,
            width: '100%',
            border: '1px solid rgba(248,113,113,0.28)',
            borderRadius: 14,
            background: 'rgba(127,29,29,0.18)',
            padding: 18,
            display: 'grid',
            gap: 12,
          }}
        >
          <h1 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Editor crashed
          </h1>
          <div id={descriptionId} style={{ color: '#fecaca', lineHeight: 1.4 }}>
            The estimate editor hit an unexpected render error. Reload the page to recover.
          </div>
          <button
            type="button"
            aria-label="Reload estimate editor"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 40,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.16)',
              background: '#111111',
              color: '#f5f5f5',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
