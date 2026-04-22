import { EstimateV2SummaryPageContent } from '@/app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent'
import { quoteRouteFamily } from '@/app/crm/estimates/[id]/estimateRouteFamily'

export default async function QuoteSummaryPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  return <EstimateV2SummaryPageContent estimateId={resolved.id} routeFamily={quoteRouteFamily} />
}
