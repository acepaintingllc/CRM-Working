'use client'

import { S } from './quoteHomeStyles'
import {
  QUOTES_HOME_SUMMARY_DEFAULT_SUBTEXT_COLOR,
  QUOTES_HOME_SUMMARY_DEFAULT_VALUE_COLOR,
  QUOTES_HOME_SUMMARY_LOADING_VALUE,
} from './quoteHomePresentation'
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
          <div
            style={{
              ...S.statValue,
              color: card.valueColor ?? QUOTES_HOME_SUMMARY_DEFAULT_VALUE_COLOR,
            }}
          >
            {loading ? QUOTES_HOME_SUMMARY_LOADING_VALUE : card.value}
          </div>
          <div
            style={{
              ...S.statSub,
              color:
                card.subtextColor ??
                QUOTES_HOME_SUMMARY_DEFAULT_SUBTEXT_COLOR,
            }}
          >
            {card.subtext}
          </div>
        </div>
      ))}
    </div>
  )
}
