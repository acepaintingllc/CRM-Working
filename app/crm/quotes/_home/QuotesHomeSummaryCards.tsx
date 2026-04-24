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
        <div key={card.label} style={S.card}>
          <div style={S.cardLabel}>{card.label}</div>
          <div
            style={{
              ...S.statValue,
              color: card.valueColor,
            }}
          >
            {card.displayValue}
          </div>
          <div
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
