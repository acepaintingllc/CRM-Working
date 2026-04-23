'use client'

import type { EstimatePublicSnapshot } from '@/lib/customer-estimates/types'
import { PublicEstimatePortal } from '@/lib/customer-estimates/PublicEstimatePortal'
import { quotePortalCopy } from './quotePortalCopy'

export default function QuotePortalClient({
  snapshot,
  printMode = false,
}: {
  snapshot: EstimatePublicSnapshot
  printMode?: boolean
}) {
  return (
    <PublicEstimatePortal
      initialSnapshot={snapshot}
      printMode={printMode}
      apiBasePath="/api/quote-public"
      copy={quotePortalCopy}
    />
  )
}
