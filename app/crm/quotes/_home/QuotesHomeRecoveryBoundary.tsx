'use client'

import type { ReactNode } from 'react'
import { Component } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { QUOTES_HOME_RECOVERY_COPY } from './quoteHomePresentation'
import { S } from './quoteHomeStyles'

type Props = {
  children: ReactNode
  onReload?: () => void
}

type State = {
  hasError: boolean
}

function reloadQuoteHomePage() {
  window.location.reload()
}

export class QuotesHomeRecoveryBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div role="alert" style={S.recoveryPanel}>
        <p style={S.recoveryTitle}>{QUOTES_HOME_RECOVERY_COPY.title}</p>
        <CrmButton
          tone="secondary"
          onClick={this.props.onReload ?? reloadQuoteHomePage}
        >
          {QUOTES_HOME_RECOVERY_COPY.reloadLabel}
        </CrmButton>
      </div>
    )
  }
}
