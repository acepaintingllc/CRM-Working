import type { QuoteRatesTopTab } from '../_hooks/quoteRatesPageConfig'

export function getRatesTabLabel(tab: QuoteRatesTopTab) {
  if (tab === 'room_defaults') return 'Room Defaults'
  if (tab === 'assumptions') return 'Assumptions'
  if (tab === 'flags') return 'Flags'
  return 'Rates'
}

export function getRatesRowStatusLabel(active: boolean) {
  return active ? 'ACTIVE' : 'ARCHIVED'
}
