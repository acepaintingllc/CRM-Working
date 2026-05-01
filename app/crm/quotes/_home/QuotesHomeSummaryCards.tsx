'use client'

import { S } from './quoteHomeStyles'
import type { SummaryCardVm } from './quoteHomeTypes'

type Props = {
  cards: SummaryCardVm[]
}

export function QuotesHomeSummaryCards({ cards }: Props) {
  return (
    <div className="ace-v2-home-stats">
      {cards.map((card) => (
        <div key={card.label} className="quotes-home-summary-card" style={S.card}>
          <div className="quotes-home-summary-card-label" style={S.cardLabel}>{card.label}</div>
          <div
            className="quotes-home-summary-card-value"
            style={{
              ...S.statValue,
              color: card.valueColor,
            }}
          >
            {card.displayValue}
          </div>
          <div
            className="quotes-home-summary-card-subtext"
            style={{
              ...S.statSub,
              color: card.subtextColor,
            }}
          >
            {card.subtext}
          </div>
        </div>
      ))}
    </div>
  )
}
