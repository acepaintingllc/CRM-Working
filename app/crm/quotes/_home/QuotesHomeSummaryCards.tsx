'use client'

import { S } from './quoteHomeStyles'
import type { SummaryCardVm } from './quoteHomeTypes'

type Props = {
  cards: SummaryCardVm[]
  loading: boolean
}

export function QuotesHomeSummaryCards({ cards, loading }: Props) {
  return (
    <div className="ace-v2-home-stats">
      {cards.map((card) => (
        <div key={card.label} style={S.card}>
          <div style={S.cardLabel}>{card.label}</div>
          <div style={{ ...S.statValue, color: card.valueColor ?? 'var(--v2-ink)' }}>
            {loading ? '...' : card.value}
          </div>
          <div style={{ ...S.statSub, color: card.subtextColor ?? 'var(--v2-ink-3)' }}>
            {card.subtext}
          </div>
        </div>
      ))}
    </div>
  )
}

