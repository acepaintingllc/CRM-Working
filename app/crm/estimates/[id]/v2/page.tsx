'use client'

import { useParams } from 'next/navigation'
import { EstimateV2ErrorBoundary } from './_components/EstimateV2ErrorBoundary'
import { EstimateV2EditorPageContent } from './_components/EstimateV2EditorPageContent'

export default function EstimateV2WallsPage() {
  const params = useParams<{ id: string }>()
  const estimateId = Array.isArray(params?.id) ? params.id[0] : params?.id
  return (
    <EstimateV2ErrorBoundary>
      <EstimateV2EditorPageContent estimateId={estimateId} />
    </EstimateV2ErrorBoundary>
  )
}
