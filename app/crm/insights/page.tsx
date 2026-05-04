import { Suspense } from 'react'
import { InsightsPageContent } from './InsightsPageContent'

export default function InsightsPage() {
  return (
    <Suspense fallback={null}>
      <InsightsPageContent />
    </Suspense>
  )
}
