'use client'

import { useParams } from 'next/navigation'
import { EstimateV2SummaryPageContent } from './_components/EstimateV2SummaryPageContent'

export default function EstimateSummaryPage() {
  const params = useParams<{ id: string }>()
  const estimateId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? ''

  return <EstimateV2SummaryPageContent estimateId={estimateId} />
}
