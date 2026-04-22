import type { RatesFlagsTab } from '@/types/estimator/ratesFlags'

export function getRatesTabLabel(tab: RatesFlagsTab) {
  if (tab === 'room_defaults') return 'Room Defaults'
  if (tab === 'flags') return 'Flags'
  return 'Rates'
}

export function getRatesRowStatusLabel(active: boolean) {
  return active ? 'ACTIVE' : 'ARCHIVED'
}
