'use client'

import { useParams } from 'next/navigation'
import { EstimateV2ErrorBoundary } from '../../estimates/[id]/v2/_components/EstimateV2ErrorBoundary'
import { EstimateV2EditorPageContent } from '../../estimates/[id]/v2/_components/EstimateV2EditorPageContent'

export default function QuoteWorkspacePage() {
  const params = useParams<{ id: string }>()
  const quoteId = Array.isArray(params?.id) ? params.id[0] : params?.id

  return (
    <EstimateV2ErrorBoundary>
      <EstimateV2EditorPageContent estimateId={quoteId} />
    </EstimateV2ErrorBoundary>
  )
}
