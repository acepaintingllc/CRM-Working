'use client'

import { useParams } from 'next/navigation'
import { EstimateV2SummaryPageContent } from './_components/EstimateV2SummaryPageContent'

export default function QuoteSummaryPage() {
  const params = useParams<{ id: string }>()
  const quoteId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? ''

  return <EstimateV2SummaryPageContent estimateId={quoteId} />
}
