import { EstimateV2ErrorBoundary } from '@/app/crm/estimates/[id]/v2/_components/EstimateV2ErrorBoundary'
import { EstimateV2EditorPageContent } from '@/app/crm/estimates/[id]/v2/_components/EstimateV2EditorPageContent'
import { quoteRouteFamily } from '@/app/crm/estimates/[id]/estimateRouteFamily'

export default async function QuoteWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  return (
    <EstimateV2ErrorBoundary>
      <EstimateV2EditorPageContent estimateId={resolved.id} routeFamily={quoteRouteFamily} />
    </EstimateV2ErrorBoundary>
  )
}
